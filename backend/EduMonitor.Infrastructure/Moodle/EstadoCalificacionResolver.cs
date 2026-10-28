using EduMonitor.Core.DTOs;
using EduMonitor.Core.Enums;
namespace EduMonitor.Infrastructure.Moodle;
public static class EstadoCalificacionResolver
{
    public static EstadoCalificacion Resolver(MoodleItemDto item, MoodleTareaDto? tarea,
        MoodleEstadoEntregaDto? estado, DateTimeOffset now, bool courseDueDatesAreAuthoritative = false)
    {
        if (item.Graderaw.HasValue) return EstadoCalificacion.Entregado; // Incluye 0.0.
        var intento = estado?.Lastattempt;
        var entrega = tarea?.Teamsubmission == 1 ? intento?.Teamsubmission : intento?.Submission;
        if (entrega?.Status == "submitted" || (item.Gradedatesubmitted > 0 && item.Itemmodule != "assign"))
            return EstadoCalificacion.PendienteCalificar;
        if (tarea is null || intento is null || !intento.Submissionsenabled)
            return EstadoCalificacion.NoDeterminado;
        if (entrega is not null && entrega.Status is not ("new" or "draft" or "reopened"))
            return EstadoCalificacion.NoDeterminado;
        // La API no garantiza fecha límite efectiva de overrides de usuario/grupo.
        // Sin fecha efectiva verificada no se presupone vencimiento: extensión sí es individual.
        if (intento.Extensionduedate <= 0 && !courseDueDatesAreAuthoritative) return EstadoCalificacion.NoDeterminado;
        var due = intento.Extensionduedate > 0 ? intento.Extensionduedate : tarea.Duedate;
        if (due == 0) return EstadoCalificacion.PendienteEntrega;
        return due < now.ToUnixTimeSeconds() ? EstadoCalificacion.SinEntrega : EstadoCalificacion.PendienteEntrega;
    }
}
