namespace EduMonitor.Core.Entities;

public class Docente
{
    public int Id { get; set; }
    public int? UsuarioId { get; set; }
    public int? MoodleUserId { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Correo { get; set; } = string.Empty;
    public string ClaveHash { get; set; } = string.Empty;
    public string Rol { get; set; } = "Docente";
    public bool Activo { get; set; } = true;

    public ICollection<Curso> Cursos { get; set; } = new List<Curso>();
}
