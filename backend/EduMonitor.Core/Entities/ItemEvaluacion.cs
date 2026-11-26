using EduMonitor.Core.Enums;

namespace EduMonitor.Core.Entities;

public class ItemEvaluacion
{
    public int Id { get; set; }
    public int? ParcialId { get; set; }
    public bool Publicado { get; set; }
    public decimal? MinimoMoodle { get; set; }
    public decimal? MaximoMoodle { get; set; }
    public int CursoId { get; set; }
    public Curso Curso { get; set; } = null!;

    public int MoodleItemId { get; set; }
    // ID del módulo del curso, distinto del ID del ítem del libro de notas.
    public int? MoodleModuleId { get; set; }
    // Posición de la actividad en el curso de Moodle (sección y orden): define la secuencia cronológica.
    public int Orden { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public TipoItemEvaluacion Tipo { get; set; }
    public decimal CalificacionMaxima { get; set; } = 10.00m;

    public ICollection<Calificacion> Calificaciones { get; set; } = new List<Calificacion>();
}
