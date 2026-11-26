using System.ComponentModel.DataAnnotations;

namespace EduMonitor.Core.DTOs.Academico;

// Datos que el backend entrega al agente: sin nombres, correos ni fotos (RNF-02).
// Los estudiantes se identifican con un código seudónimo estable (EST-<id interno>).
public record ContextoAgenteDto(
    int CursoId,
    int ParcialId,
    int ParcialNumero,
    string Materia,
    string Codigo,
    string Semestre,
    decimal PromedioGeneral,
    int TotalEstudiantes,
    int EstudiantesEnRiesgo,
    int Aprobados,
    int SinEvaluaciones,
    Dictionary<string, decimal> ComponentesPromedios,
    DateTime? UltimaSincronizacionUtc);

public record EvaluacionAgenteDto(string Nombre, string Componente, decimal Nota, string Estado, List<string> Temas);

public record EstudianteAgenteDto(
    string Codigo,
    decimal NotaFinal,
    bool EnRiesgo,
    bool CalculoProvisional,
    Dictionary<string, decimal> Componentes,
    List<string> TemasDeficientes,
    List<EvaluacionAgenteDto> Evaluaciones);

public record DatosAgenteCursoDto(ContextoAgenteDto Contexto, List<EstudianteAgenteDto> Estudiantes);

public record EstudianteAlertasAgenteDto(string Codigo, decimal NotaFinal, IndicadoresProgresoDto Progreso, List<AlertaAcademicaDto> Alertas);

// Resultado de las reglas deterministas (RF-07) para que el agente lo explique; solo códigos seudónimos.
public record AlertasAgenteDto(
    ConfiguracionAlertasDto Reglas,
    IndicadoresProgresoDto ProgresoCurso,
    int EstudiantesConAlertas,
    List<EstudianteAlertasAgenteDto> Estudiantes);

public record PasoTrazaAgenteDto(
    [Required, StringLength(80)] string Herramienta,
    [StringLength(2000)] string? Parametros,
    [StringLength(2000)] string? Resultado,
    bool Exito,
    [StringLength(500)] string? Error,
    [Range(0, int.MaxValue)] int DuracionMs);

public record RegistrarTrazaAgenteRequest(
    [Range(1, int.MaxValue)] int? CursoId,
    [Range(1, int.MaxValue)] int? ParcialId,
    [Required, RegularExpression("^(curso|estudiante)$")] string Modo,
    [Required, StringLength(2000)] string Consulta,
    [StringLength(80)] string? Modelo,
    bool EsFallback,
    bool Exitoso,
    [StringLength(500)] string? Error,
    [Range(0, int.MaxValue)] int DuracionMs,
    [MaxLength(20)] List<PasoTrazaAgenteDto> Pasos);

public record TrazaAgenteDto(
    int Id,
    DateTime Fecha,
    int UsuarioId,
    string? Usuario,
    string? Curso,
    string Modo,
    string Consulta,
    string? Modelo,
    bool EsFallback,
    bool Exitoso,
    string? Error,
    int DuracionMs,
    List<PasoTrazaAgenteDto> Pasos);
