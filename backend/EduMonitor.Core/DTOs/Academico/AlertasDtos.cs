using System.ComponentModel.DataAnnotations;

namespace EduMonitor.Core.DTOs.Academico;

/// <summary>Reglas de alerta de una materia (RF-07). Los rangos evitan configuraciones sin sentido.</summary>
public record ConfiguracionAlertasDto(
    bool RendimientoActivo,
    [Range(typeof(decimal), "1", "10")] decimal RendimientoUmbral,
    bool DescensoActivo,
    [Range(1, 5)] int DescensoUltimas,
    [Range(typeof(decimal), "0.5", "10")] decimal DescensoPuntos,
    bool AtrasosActivo,
    [Range(1, 20)] int AtrasosMinimo,
    bool FinalizacionActivo,
    [Range(typeof(decimal), "1", "100")] decimal FinalizacionMinimaPct)
{
    public static ConfiguracionAlertasDto Predeterminada { get; } = new(true, 7.00m, true, 2, 1.50m, true, 2, true, 60m);
}

/// <summary>Progreso de un estudiante (RF-05) diferenciando cada estado de actividad (RF-06).</summary>
public record IndicadoresProgresoDto(
    int TotalActividades,
    int Calificadas,
    int SinEntrega,
    int PendientesCalificar,
    int PendientesEntrega,
    int SinDato,
    // Calificadas + entregadas pendientes de calificar.
    int Completadas,
    // Actividades que ya debían entregarse (excluye las que aún no vencen y las de estado desconocido).
    int Exigibles,
    // Completadas / exigibles; null si todavía no hay actividades exigibles.
    decimal? PorcentajeFinalizacion);

public static class ReglasAlerta
{
    public const string Rendimiento = "rendimiento";
    public const string Descenso = "descenso";
    public const string Atrasos = "atrasos";
    public const string Finalizacion = "finalizacion";
}

/// <summary>Alerta explicable: indica qué regla se activó y con qué evidencia, sin etiquetas definitivas.</summary>
public record AlertaAcademicaDto(string Regla, string Titulo, string Evidencia, List<string> Actividades);

public record AlertasEstudianteDto(
    int EstudianteId,
    string Nombres,
    string Apellidos,
    decimal NotaFinalParcial,
    bool SinEvaluaciones,
    IndicadoresProgresoDto Indicadores,
    List<AlertaAcademicaDto> Alertas);

public record AlertasCursoDto(
    int CursoId,
    int ParcialId,
    ConfiguracionAlertasDto Configuracion,
    bool ConfiguracionPersonalizada,
    IndicadoresProgresoDto ProgresoCurso,
    int EstudiantesConAlertas,
    List<AlertasEstudianteDto> Estudiantes);
