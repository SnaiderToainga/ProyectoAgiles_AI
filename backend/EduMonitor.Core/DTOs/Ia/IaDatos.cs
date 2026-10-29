using System.Text.Json.Serialization;

namespace EduMonitor.Core.DTOs.Ia;

// Payload enviado a la IA (Completamente anonimizado)
public record IaDiagnosticoRequest(
    [property: JsonPropertyName("materia")] string Materia,
    [property: JsonPropertyName("parcial")] int Parcial,
    [property: JsonPropertyName("promedioPonderado")] decimal PromedioPonderado,
    [property: JsonPropertyName("componentesDeficientes")] List<ComponenteDeficienteDto> ComponentesDeficientes,
    [property: JsonPropertyName("temasCriticos")] List<string> TemasCriticos
);

public record ComponenteDeficienteDto(
    [property: JsonPropertyName("componente")] string Componente,
    [property: JsonPropertyName("nota")] decimal Nota,
    [property: JsonPropertyName("ponderacion")] decimal Ponderacion
);

// Contrato estricto que la IA debe devolver en formato JSON
public record IaDiagnosticoResponse(
    [property: JsonPropertyName("nivelRiesgo")] string NivelRiesgo,
    [property: JsonPropertyName("diagnosticoCualitativo")] string DiagnosticoCualitativo,
    [property: JsonPropertyName("temasRefuerzo")] List<TemaRefuerzoDto> TemasRefuerzo
);

public record TemaRefuerzoDto(
    [property: JsonPropertyName("tema")] string Tema,
    [property: JsonPropertyName("recomendacion")] string Recomendacion,
    [property: JsonPropertyName("prioridad")] string Prioridad
);