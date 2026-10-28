using System.ComponentModel.DataAnnotations;
using EduMonitor.Core.Enums;
namespace EduMonitor.Core.DTOs.Academico;
public record TemaRequest([Range(1,int.MaxValue)] int UnidadId,
    [Required,StringLength(200,MinimumLength=1)] string Nombre, [StringLength(1000)] string Descripcion = "");
public record EvaluacionRequest([Range(1,int.MaxValue)] int ParcialId,
    [Required,StringLength(200,MinimumLength=1)] string Nombre, TipoItemEvaluacion Tipo,
    [Required,MinLength(1)] int[] TemaIds);
public record ClasificarRequest([Range(1,int.MaxValue)] int ParcialId, TipoItemEvaluacion Tipo, [Required,MinLength(1)] int[] TemaIds);
public record TemaDto(int Id,string Nombre,string Descripcion);
public record UnidadDto(int Id,int Numero,string Nombre,List<TemaDto> Temas);
public record ParcialDto(int Id,int Numero,List<UnidadDto> Unidades);
public record MateriaDto(int Id,string Codigo,string Nombre,string Semestre,List<ParcialDto> Parciales);
public record EvaluacionDto(int Id,int? ParcialId,string Nombre,TipoItemEvaluacion Tipo,decimal Ponderacion,bool Publicado,int[] TemaIds);
public sealed class AcademicoException(int status,string message) : Exception(message)
{ public int Status {get;}=status; }
