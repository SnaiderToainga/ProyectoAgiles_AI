using EduMonitor.Core.Entities;
namespace EduMonitor.Core.Entities.Academico;
public class Parcial
{
    public int Id { get; set; }
    public int CursoId { get; set; }
    public Curso Curso { get; set; } = null!;
    public int Numero { get; set; }
    public ICollection<Unidad> Unidades { get; set; } = new List<Unidad>();
}
public class Unidad
{
    public int Id { get; set; }
    public int ParcialId { get; set; }
    public Parcial Parcial { get; set; } = null!;
    public int Numero { get; set; }
    public string Nombre { get; set; } = "";
    public ICollection<Tema> Temas { get; set; } = new List<Tema>();
}
public class Tema
{
    public int Id { get; set; }
    public int UnidadId { get; set; }
    public Unidad Unidad { get; set; } = null!;
    public string Nombre { get; set; } = "";
    public string Descripcion { get; set; } = "";
}
public class EvaluacionTema
{
    public int ItemEvaluacionId { get; set; }
    public ItemEvaluacion Evaluacion { get; set; } = null!;
    public int TemaId { get; set; }
    public Tema Tema { get; set; } = null!;
}
