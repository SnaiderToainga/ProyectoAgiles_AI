namespace EduMonitor.Core.Entities;

public class Estudiante
{
    public int Id { get; set; }
    public int MoodleUserId { get; set; }
    public string Nombres { get; set; } = string.Empty;
    public string Apellidos { get; set; } = string.Empty;
    public string Correo { get; set; } = string.Empty;

    public string NombreCompleto => $"{Nombres} {Apellidos}".Trim();

    public ICollection<Matricula> Matriculas { get; set; } = new List<Matricula>();
    public ICollection<Calificacion> Calificaciones { get; set; } = new List<Calificacion>();
}
