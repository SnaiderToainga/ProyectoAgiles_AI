using EduMonitor.Core.DTOs;
namespace EduMonitor.Core.Services;
public interface IMoodleService
{
    Task<IReadOnlyList<MoodleCursoDto>> ObtenerCursosPorDocente(int docenteMoodleId, CancellationToken ct = default);
    Task<MoodleCalificacionesDto> ObtenerCalificacionesPorCurso(int cursoMoodleId, CancellationToken ct = default);
    Task<IReadOnlyList<MoodleParticipanteDto>> ObtenerParticipantes(int cursoMoodleId, CancellationToken ct = default);
    Task<MoodleTareasDto> ObtenerTareas(int cursoMoodleId, CancellationToken ct = default);
    Task<MoodleEstadoEntregaDto> ObtenerEstadoEntrega(int tareaId, int usuarioId, CancellationToken ct = default);
    Task<IReadOnlyList<MoodleSeccionDto>> ObtenerContenidoCurso(int cursoMoodleId,CancellationToken ct = default);
    // Comprobación de conectividad real (core_webservice_get_site_info).
    Task<MoodleSitioDto> ObtenerInfoSitio(CancellationToken ct = default) =>
        throw new NotSupportedException("La fuente Moodle no expone información del sitio.");
}
