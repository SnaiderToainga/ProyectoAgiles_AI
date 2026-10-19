using EduMonitor.Core.Enums;

namespace EduMonitor.Core.Entities;

public class ItemEvaluacion
{
    public int Id { get; set; }
    public int CursoId { get; set; }
    public Curso Curso { get; set; } = null!;

    public int MoodleItemId { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public TipoItemEvaluacion Tipo { get; set; }
    public decimal CalificacionMaxima { get; set; } = 10.00m;

    public ICollection<Calificacion> Calificaciones { get; set; } = new List<Calificacion>();
}
