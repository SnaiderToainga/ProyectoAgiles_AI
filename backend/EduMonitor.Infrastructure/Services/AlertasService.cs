using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.Entities.Academico;
using EduMonitor.Core.Enums;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Infrastructure.Services;

/// <summary>Indicadores de progreso y alertas académicas configurables por materia (RF-05, RF-06, RF-07).</summary>
public sealed class AlertasService(
    AcademicoDbContext db,
    CatalogoService catalogo,
    ICalculoPonderadoService calculo,
    IIndicadoresService indicadores)
{
    public async Task<ConfiguracionAlertasDto> Configuracion(int usuarioId, bool admin, int cursoId, CancellationToken ct = default)
    {
        await catalogo.ComprobarCurso(usuarioId, admin, cursoId, ct);
        var fila = await db.ConfiguracionesAlertas.AsNoTracking().SingleOrDefaultAsync(c => c.CursoId == cursoId, ct);
        return fila is null ? ConfiguracionAlertasDto.Predeterminada : Mapear(fila);
    }

    public async Task<ConfiguracionAlertasDto> GuardarConfiguracion(int usuarioId, bool admin, int cursoId,
        ConfiguracionAlertasDto config, CancellationToken ct = default)
    {
        await catalogo.ComprobarCurso(usuarioId, admin, cursoId, ct);
        var fila = await db.ConfiguracionesAlertas.SingleOrDefaultAsync(c => c.CursoId == cursoId, ct);
        if (fila is null)
        {
            fila = new ConfiguracionAlertas { CursoId = cursoId };
            db.ConfiguracionesAlertas.Add(fila);
        }
        fila.RendimientoActivo = config.RendimientoActivo;
        fila.RendimientoUmbral = config.RendimientoUmbral;
        fila.DescensoActivo = config.DescensoActivo;
        fila.DescensoUltimas = config.DescensoUltimas;
        fila.DescensoPuntos = config.DescensoPuntos;
        fila.AtrasosActivo = config.AtrasosActivo;
        fila.AtrasosMinimo = config.AtrasosMinimo;
        fila.FinalizacionActivo = config.FinalizacionActivo;
        fila.FinalizacionMinimaPct = config.FinalizacionMinimaPct;
        fila.FechaActualizacion = DateTime.UtcNow;
        fila.ActualizadoPorUsuarioId = usuarioId;
        await db.SaveChangesAsync(ct);
        return Mapear(fila);
    }

    public async Task<AlertasCursoDto> Alertas(int usuarioId, bool admin, int cursoId, int parcialId, CancellationToken ct = default)
    {
        await catalogo.ComprobarCurso(usuarioId, admin, cursoId, ct);
        if (!await db.Parciales.AnyAsync(p => p.Id == parcialId && p.CursoId == cursoId, ct))
            throw new AcademicoException(404, "El parcial no pertenece a la materia.");

        var fila = await db.ConfiguracionesAlertas.AsNoTracking().SingleOrDefaultAsync(c => c.CursoId == cursoId, ct);
        var config = fila is null ? ConfiguracionAlertasDto.Predeterminada : Mapear(fila);

        var resumenes = await calculo.CalcularCursoAsync(cursoId, parcialId, ct);
        // Mismo universo de actividades que el cálculo ponderado: publicadas y clasificadas del parcial.
        var itemIds = await db.ItemsEvaluacion.AsNoTracking()
            .Where(i => i.CursoId == cursoId && i.ParcialId == parcialId && i.Publicado && i.Tipo != TipoItemEvaluacion.SinClasificar)
            .Select(i => i.Id).ToListAsync(ct);
        var calificaciones = await db.Calificaciones.AsNoTracking()
            .Include(c => c.ItemEvaluacion)
            .Where(c => itemIds.Contains(c.ItemEvaluacionId))
            .ToListAsync(ct);
        var porEstudiante = calificaciones.GroupBy(c => c.EstudianteId).ToDictionary(g => g.Key, g => g.ToList());

        var estudiantes = resumenes.Select(r =>
        {
            var propias = porEstudiante.GetValueOrDefault(r.EstudianteId) ?? [];
            var progreso = indicadores.CalcularProgreso(propias, itemIds.Count);
            var alertas = indicadores.EvaluarAlertas(r, propias, progreso, config);
            return new AlertasEstudianteDto(r.EstudianteId, r.Nombres, r.Apellidos, r.NotaFinalParcial, r.SinEvaluaciones, progreso, alertas);
        })
        .OrderByDescending(e => e.Alertas.Count)
        .ThenBy(e => e.SinEvaluaciones)
        .ThenBy(e => e.NotaFinalParcial)
        .ToList();

        return new AlertasCursoDto(cursoId, parcialId, config, fila is not null,
            IndicadoresService.Sumar(estudiantes.Select(e => e.Indicadores)),
            estudiantes.Count(e => e.Alertas.Count > 0),
            estudiantes);
    }

    private static ConfiguracionAlertasDto Mapear(ConfiguracionAlertas c) => new(
        c.RendimientoActivo, c.RendimientoUmbral, c.DescensoActivo, c.DescensoUltimas, c.DescensoPuntos,
        c.AtrasosActivo, c.AtrasosMinimo, c.FinalizacionActivo, c.FinalizacionMinimaPct);
}
