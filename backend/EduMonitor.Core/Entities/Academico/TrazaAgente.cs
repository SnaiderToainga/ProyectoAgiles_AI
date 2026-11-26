namespace EduMonitor.Core.Entities.Academico;

/// <summary>
/// Traza auditable de una consulta al agente pedagógico (sección 7 / RF-12): la consulta anonimizada,
/// las herramientas que el agente invocó contra el backend con sus parámetros, el resultado y los fallos.
/// </summary>
public class TrazaAgente
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public int? CursoId { get; set; }
    public int? ParcialId { get; set; }
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
    public string Modo { get; set; } = "curso";
    public string Consulta { get; set; } = "";
    public string? Modelo { get; set; }
    public bool EsFallback { get; set; }
    public bool Exitoso { get; set; }
    public string? Error { get; set; }
    public int DuracionMs { get; set; }
    public string PasosJson { get; set; } = "[]";
}
