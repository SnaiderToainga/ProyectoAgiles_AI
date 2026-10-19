namespace EduMonitor.Core.Entities;

public class LogSincronizacion
{
    public int Id { get; set; }
    public int CursoId { get; set; }
    public Curso Curso { get; set; } = null!;

    public DateTime Fecha { get; set; } = DateTime.UtcNow;
    public int TotalRegistros { get; set; }
    public bool Exitoso { get; set; }
    public string? MensajeError { get; set; }
}
