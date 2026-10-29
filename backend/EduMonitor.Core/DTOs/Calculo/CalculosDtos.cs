using EduMonitor.Core.Enums;

namespace EduMonitor.Core.DTOs.Calculo;

public record EvaluacionDetalleDto(
    int ItemEvaluacionId,
    string Nombre,
    TipoItemEvaluacion Tipo,
    decimal? Nota,
    bool EsDeficiente,
    List<TemaReferenciaDto> Temas
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
    List<EvaluacionDetalleDto> Evaluaciones
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
    List<TemaCriticoDto> TemasDeficientes
);