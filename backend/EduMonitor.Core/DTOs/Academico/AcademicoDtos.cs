using System.ComponentModel.DataAnnotations;
using EduMonitor.Core.DTOs.Calculo;
using EduMonitor.Core.Enums;

namespace EduMonitor.Core.DTOs.Academico;

public record TemaRequest(
    [Range(1, int.MaxValue)] int UnidadId,
    [Required, StringLength(200, MinimumLength = 1)] string Nombre,
    [StringLength(1000)] string Descripcion = ""
);

public record EvaluacionRequest(
    [Range(1, int.MaxValue)] int ParcialId,
    [Required, StringLength(200, MinimumLength = 1)] string Nombre,
    TipoItemEvaluacion Tipo,
    [Required, MinLength(1)] int[] TemaIds
);

public record ClasificarRequest(
    [Range(1, int.MaxValue)] int ParcialId,
    TipoItemEvaluacion Tipo,
    [Required, MinLength(1)] int[] TemaIds
);

public record TemaDto(int Id, string Nombre, string Descripcion);
public record UnidadDto(int Id, int Numero, string Nombre, List<TemaDto> Temas);
public record ParcialDto(int Id, int Numero, List<UnidadDto> Unidades);
public record MateriaDto(int Id, string Codigo, string Nombre, string Semestre, List<ParcialDto> Parciales);
public record EvaluacionDto(int Id, int? ParcialId, string Nombre, TipoItemEvaluacion Tipo, decimal Ponderacion, bool Publicado, int[] TemaIds);

public record CrearPlanRefuerzoRequest(
    [Range(1, int.MaxValue)] int EstudianteId,
    [Range(1, int.MaxValue)] int CursoId,
    [Required, StringLength(2000)] string DiagnosticoGeneral,
    [Required, StringLength(50)] string NivelRiesgo,
    bool EsFallback,
    [Required, MinLength(1)] List<CrearDetallePlanRequest> Detalles
);

public record CrearDetallePlanRequest(
    [Range(1, int.MaxValue)] int TemaId,
    [Required, StringLength(1000)] string ActividadSugerida,
    [Required, StringLength(50)] string Prioridad,
    [Range(1, 100)] int TiempoEstimadoHoras,
    [StringLength(500)] string RecursoRecomendado = ""
);

public record PlanRefuerzoDto(
    int Id,
    int EstudianteId,
    string EstudianteNombre,
    int CursoId,
    string DiagnosticoGeneral,
    string NivelRiesgo,
    bool EsFallback,
    DateTime FechaGeneracion,
    List<DetallePlanRefuerzoDto> Detalles
);

public record DetallePlanRefuerzoDto(
    int Id,
    int TemaId,
    string TemaNombre,
    string ActividadSugerida,
    string Prioridad,
    int TiempoEstimadoHoras,
    string RecursoRecomendado
);

public record MembreteInstitucionalDto(
    string Universidad,
    string Facultad,
    string Carrera,
    string Sistema,
    string TituloReporte,
    string MateriaCodigo,
    string MateriaNombre,
    string PeriodoLectivo,
    int ParcialId,
    int ParcialNumero,
    string DocenteTitular,
    string DocenteCorreo,
    DateTime FechaEmisionUtc
);

public record FirmaDocenteDto(
    string NombreDocente,
    string CorreoDocente,
    string Cargo,
    string EtiquetaCasillero,
    string LeyendaConformidad,
    string LineaFirma
);

public record PiePaginaReporteDto(
    string TextoInstitucional,
    string PlantillaNumeracion,
    string NumeracionInicial,
    int TotalPaginasEstimadas,
    int RegistrosPorPagina,
    List<string> Paginas,
    string CodigoDocumento,
    DateTime FechaEmisionUtc
);

public record ResumenEstadisticoReporteDto(
    int TotalEstudiantes,
    int TotalAprobados,
    int TotalEnRiesgo,
    decimal PorcentajeAprobados,
    decimal PorcentajeEnRiesgo,
    decimal PromedioGeneralCurso,
    decimal PromedioTareasCurso,
    decimal AporteTareasCurso,
    decimal PromedioApeCurso,
    decimal AporteApeCurso,
    decimal PromedioExamenCurso,
    decimal AporteExamenCurso,
    decimal UmbralAprobacion
);

public record FilaMatrizConsolidadaDto(
    int NumeroOrden,
    int EstudianteId,
    string Nombres,
    string Apellidos,
    string NombreCompleto,
    string Correo,
    string? FotoUrl,
    decimal PromedioTareas,
    decimal AporteTareas,
    decimal PromedioApe,
    decimal AporteApe,
    decimal PromedioExamen,
    decimal AporteExamen,
    decimal NotaFinalParcial,
    bool EnRiesgo,
    string EstadoAcademico,
    List<ComponentePonderadoDto> Componentes,
    List<TemaCriticoDto> TemasDeficientes,
    PlanRefuerzoDto? PlanRefuerzoVigente
);

public record ReporteConsolidadoCursoDto(
    int CursoId,
    int ParcialId,
    int ParcialNumero,
    MembreteInstitucionalDto Membrete,
    ResumenEstadisticoReporteDto ResumenEstadistico,
    List<FilaMatrizConsolidadaDto> Estudiantes,
    FirmaDocenteDto BloqueFirma,
    PiePaginaReporteDto PiePagina
);

public record ReporteIndividualTutoriaDto(
    int CursoId,
    int ParcialId,
    int ParcialNumero,
    MembreteInstitucionalDto Membrete,
    FilaMatrizConsolidadaDto Estudiante,
    string CausaPrincipalRendimiento,
    PlanRefuerzoDto? PlanRefuerzo,
    FirmaDocenteDto BloqueFirma,
    PiePaginaReporteDto PiePagina
);

public sealed class AcademicoException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
