using System.Text.Json.Serialization;
namespace EduMonitor.Core.DTOs;

public sealed record MoodleCursoDto(int Id, string Fullname, string Shortname);
public sealed record MoodleRolDto(string Shortname);
public sealed record MoodleParticipanteDto(int Id, string? Firstname, string? Lastname,
    string Fullname, string? Email, List<MoodleRolDto> Roles);
public sealed record MoodleCalificacionesDto(List<MoodleUsuarioNotasDto> Usergrades);
public sealed record MoodleUsuarioNotasDto(int Courseid, int Userid, List<MoodleItemDto> Gradeitems);
public sealed record MoodleItemDto(int Id, string? Itemname, string Itemtype, string? Itemmodule,
    int? Iteminstance, decimal? Graderaw, decimal? Grademin, decimal? Grademax,
    long? Gradedatesubmitted);
public sealed record MoodleTareasDto(List<MoodleCursoTareasDto> Courses);
public sealed record MoodleCursoTareasDto(int Id, List<MoodleTareaDto> Assignments);
public sealed record MoodleTareaDto(int Id, long Duedate, int Teamsubmission);
public sealed record MoodleEstadoEntregaDto(MoodleIntentoDto? Lastattempt);
public sealed record MoodleIntentoDto(MoodleEntregaDto? Submission, MoodleEntregaDto? Teamsubmission,
    long Extensionduedate, bool Submissionsenabled);
public sealed record MoodleEntregaDto(string Status, long Timemodified);
public sealed record SincronizacionDto(int LogId, string Operacion, int Cursos, int Estudiantes,
    int Items, int Calificaciones, int EstadosNoDeterminados, DateTime FechaUtc);
