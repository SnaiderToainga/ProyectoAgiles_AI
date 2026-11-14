using EduMonitor.Core.DTOs;
namespace EduMonitor.Core.Services;
public interface IMoodleService
{
    Task<IReadOnlyList<MoodleCursoDto>> ObtenerCursosPorDocente(int docenteMoodleId, CancellationToken ct = default);
    Task<MoodleCalificacionesDto> ObtenerCalificacionesPorCurso(int cursoMoodleId, CancellationToken ct = default);
    Task<IReadOnlyList<MoodleParticipanteDto>> ObtenerParticipantes(int cursoMoodleId, CancellationToken ct = default);
    Task<MoodleTareasDto> ObtenerTareas(int cursoMoodleId, CancellationToken ct = default);
    Task<MoodleEstadoEntregaDto> ObtenerEstadoEntrega(int tareaId, int usuarioId, CancellationToken ct = default);
}
