using EduMonitor.Core.Enums;

namespace EduMonitor.Core.DTOs.Calculo;

public record EvaluacionDetalleDto(
    int ItemEvaluacionId,
    string Nombre,
    TipoItemEvaluacion Tipo,
    decimal? Nota,
    bool EsDeficiente,
    List<TemaReferenciaDto> Temas,
    // Entregado (con nota), SinEntrega, PendienteCalificar, PendienteEntrega o NoDeterminado (RF-06).
    EstadoCalificacion Estado = EstadoCalificacion.NoDeterminado
);

public record TemaReferenciaDto(
    int TemaId,
    string Nombre
);

public record ComponentePonderadoDto(
    TipoItemEvaluacion Tipo,
    decimal Ponderacion,
    decimal PromedioComponente,
    decimal AporteFinal,
    bool EsDeficiente,
    List<EvaluacionDetalleDto> Evaluaciones,
    // false si el estudiante no tiene ninguna actividad evaluada en este componente: no se cuenta como 0.
    bool Evaluado = true
);

public record TemaCriticoDto(
    int TemaId,
    string NombreTema,
    string EvaluacionOrigen,
    decimal? NotaObtenida
);

public record ResumenAcademicoEstudianteDto(
    int EstudianteId,
    string Nombres,
    string Apellidos,
    string Correo,
    int CursoId,
    int ParcialId,
    decimal NotaFinalParcial,
    bool EnRiesgo,
    List<ComponentePonderadoDto> Componentes,
    List<TemaCriticoDto> TemasDeficientes,
    string? FotoUrl = null,
    // Sin ninguna actividad evaluada: la nota no es 0 ni implica riesgo.
    bool SinEvaluaciones = false,
    // La nota se calculó sobre una parte de la ponderación 30/30/40 (faltan componentes por evaluar).
    bool CalculoProvisional = false,
    decimal PonderacionEvaluada = 1.00m
);