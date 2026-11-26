using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.DTOs.Calculo;
using EduMonitor.Core.Entities.Academico;
using EduMonitor.Core.Enums;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Infrastructure.Services;

/// <summary>
/// Fuente de datos de las herramientas del agente pedagógico y registro de sus trazas.
/// Todo se lee de AcademicoDB con la identidad del docente, y se entrega seudonimizado.
/// </summary>
public sealed partial class AgenteService(AcademicoDbContext db, CatalogoService catalogo, ICalculoPonderadoService calculo)
{
    public const int MaximoTrazas = 100;
    public const string EstudianteNoEncontrado = "agente_estudiante_no_encontrado";
    public const string CodigoInvalido = "agente_codigo_invalido";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static string CodigoEstudiante(int estudianteId) =>
        $"EST-{estudianteId.ToString("D3", CultureInfo.InvariantCulture)}";

    [GeneratedRegex(@"^EST-(\d{1,9})$", RegexOptions.IgnoreCase)]
    private static partial Regex PatronCodigo();

    public async Task<DatosAgenteCursoDto> DatosCurso(int usuarioId, bool admin, int cursoId, int parcialId, CancellationToken ct = default)
    {
        await catalogo.ComprobarCurso(usuarioId, admin, cursoId, ct);
        var curso = await db.Cursos.AsNoTracking().SingleAsync(c => c.Id == cursoId, ct);
        var parcial = await db.Parciales.AsNoTracking().SingleOrDefaultAsync(p => p.Id == parcialId && p.CursoId == cursoId, ct)
            ?? throw new AcademicoException(404, "El parcial no pertenece a la materia.");

        var resumenes = await calculo.CalcularCursoAsync(cursoId, parcialId, ct);
        var evaluados = resumenes.Where(r => !r.SinEvaluaciones).ToList();
        var estudiantes = evaluados.OrderBy(r => r.EstudianteId).Select(Mapear).ToList();

        var componentes = new Dictionary<string, decimal>();
        foreach (var grupo in evaluados.SelectMany(r => r.Componentes).Where(c => c.Evaluado).GroupBy(c => c.Tipo))
            componentes[NombreComponente(grupo.Key)] = Math.Round(grupo.Average(c => c.PromedioComponente), 2);

        var ultima = await db.LogsSincronizacion.AsNoTracking()
            .Where(l => l.CursoId == cursoId && l.Exitoso && l.Operacion == "Notas")
            .OrderByDescending(l => l.Fecha).Select(l => (DateTime?)l.Fecha).FirstOrDefaultAsync(ct);

        var contexto = new ContextoAgenteDto(
            cursoId, parcialId, parcial.Numero, curso.Nombre, curso.Codigo, curso.Periodo,
            evaluados.Count > 0 ? Math.Round(evaluados.Average(r => r.NotaFinalParcial), 2) : 0m,
            evaluados.Count,
            evaluados.Count(r => r.EnRiesgo),
            evaluados.Count(r => !r.EnRiesgo),
            resumenes.Count - evaluados.Count,
            componentes,
            ultima is { } f ? DateTime.SpecifyKind(f, DateTimeKind.Utc) : null);
        return new DatosAgenteCursoDto(contexto, estudiantes);
    }

    public async Task<EstudianteAgenteDto> Estudiante(int usuarioId, bool admin, int cursoId, int parcialId, string codigo, CancellationToken ct = default)
    {
        var coincidencia = PatronCodigo().Match(codigo.Trim());
        if (!coincidencia.Success)
            throw new AcademicoException(400, "Código de estudiante inválido; use el formato EST-001.", CodigoInvalido);
        var datos = await DatosCurso(usuarioId, admin, cursoId, parcialId, ct);
        var normalizado = CodigoEstudiante(int.Parse(coincidencia.Groups[1].Value, CultureInfo.InvariantCulture));
        return datos.Estudiantes.SingleOrDefault(e => e.Codigo == normalizado)
            ?? throw new AcademicoException(404, "No hay un estudiante evaluado con ese código en la materia y parcial.", EstudianteNoEncontrado);
    }

    public async Task<int> RegistrarTraza(int usuarioId, bool admin, RegistrarTrazaAgenteRequest request, CancellationToken ct = default)
    {
        // Un intento sobre una materia inexistente o ajena también se audita, pero sin asociarlo a esa materia.
        var cursoValido = request.CursoId;
        if (cursoValido is int cursoId)
        {
            try { await catalogo.ComprobarCurso(usuarioId, admin, cursoId, ct); }
            catch (AcademicoException) { cursoValido = null; }
        }
        var traza = new TrazaAgente
        {
            UsuarioId = usuarioId,
            CursoId = cursoValido,
            ParcialId = cursoValido is null ? null : request.ParcialId,
            Modo = request.Modo,
            Consulta = request.Consulta,
            Modelo = request.Modelo,
            EsFallback = request.EsFallback,
            Exitoso = request.Exitoso,
            Error = request.Error,
            DuracionMs = request.DuracionMs,
            PasosJson = JsonSerializer.Serialize(request.Pasos ?? [], Json),
        };
        db.TrazasAgente.Add(traza);
        await db.SaveChangesAsync(ct);
        return traza.Id;
    }

    public async Task<List<TrazaAgenteDto>> Trazas(int usuarioId, bool admin, int limite, CancellationToken ct = default)
    {
        limite = Math.Clamp(limite, 1, MaximoTrazas);
        var query = db.TrazasAgente.AsNoTracking();
        if (!admin) query = query.Where(t => t.UsuarioId == usuarioId);
        var filas = await query.OrderByDescending(t => t.Fecha).ThenByDescending(t => t.Id).Take(limite)
            .Select(t => new
            {
                Traza = t,
                Usuario = db.Docentes.Where(d => d.UsuarioId == t.UsuarioId).Select(d => d.Nombre).FirstOrDefault(),
                Curso = db.Cursos.Where(c => c.Id == t.CursoId).Select(c => c.Codigo + " " + c.Nombre).FirstOrDefault(),
            }).ToListAsync(ct);
        return filas.Select(f => new TrazaAgenteDto(f.Traza.Id, DateTime.SpecifyKind(f.Traza.Fecha, DateTimeKind.Utc),
            f.Traza.UsuarioId, f.Usuario, f.Curso, f.Traza.Modo, f.Traza.Consulta, f.Traza.Modelo, f.Traza.EsFallback,
            f.Traza.Exitoso, f.Traza.Error, f.Traza.DuracionMs,
            JsonSerializer.Deserialize<List<PasoTrazaAgenteDto>>(f.Traza.PasosJson, Json) ?? [])).ToList();
    }

    private static EstudianteAgenteDto Mapear(ResumenAcademicoEstudianteDto r)
    {
        var evaluaciones = r.Componentes
            .SelectMany(c => c.Evaluaciones.Select(e => (Componente: c.Tipo, Evaluacion: e)))
            // Solo actividades evaluadas: con nota, o vencidas sin entrega (cuentan como 0). Las pendientes no.
            .Where(x => x.Evaluacion.Nota.HasValue || x.Evaluacion.Estado == EstadoCalificacion.SinEntrega)
            .Select(x => new EvaluacionAgenteDto(
                x.Evaluacion.Nombre,
                NombreComponente(x.Componente),
                Math.Round(x.Evaluacion.Nota ?? 0m, 2),
                x.Evaluacion.Nota.HasValue ? "Calificada" : "Sin entrega",
                x.Evaluacion.Temas.Select(t => t.Nombre).ToList()))
            .ToList();
        return new EstudianteAgenteDto(
            CodigoEstudiante(r.EstudianteId),
            Math.Round(r.NotaFinalParcial, 2),
            r.EnRiesgo,
            r.CalculoProvisional,
            r.Componentes.Where(c => c.Evaluado)
                .ToDictionary(c => NombreComponente(c.Tipo), c => Math.Round(c.PromedioComponente, 2)),
            r.TemasDeficientes.Select(t => t.NombreTema).Distinct().ToList(),
            evaluaciones);
    }

    private static string NombreComponente(TipoItemEvaluacion tipo) => tipo switch
    {
        TipoItemEvaluacion.Tarea => "Tareas",
        TipoItemEvaluacion.APE => "APE",
        TipoItemEvaluacion.Examen => "Examen",
        _ => "Sin clasificar",
    };
}
