using EduMonitor.Core.DTOs;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Infrastructure.Moodle;

public sealed partial class MoodleSyncService
{
    public const int MaximoLogs = 100;

    // Estado verificado contra Moodle en cada consulta; nunca se informa "en línea" sin respuesta real.
    public async Task<EstadoMoodleDto> Estado(CancellationToken ct = default)
    {
        var config = options.Value;
        var cursos = await db.Cursos.AsNoTracking().CountAsync(c => c.MoodleCourseId > 0, ct);
        var docentes = await db.Docentes.AsNoTracking().CountAsync(d => d.Activo && d.MoodleUserId > 0, ct);
        var ultima = await db.LogsSincronizacion.AsNoTracking().Where(l => l.Exitoso)
            .OrderByDescending(l => l.Fecha).Select(l => (DateTime?)l.Fecha).FirstOrDefaultAsync(ct);
        ultima = ultima is { } f ? DateTime.SpecifyKind(f, DateTimeKind.Utc) : null;
        var tokenConfigurado = !string.IsNullOrWhiteSpace(config.MoodleToken);

        MoodleSitioDto? sitio = null;
        string? codigo = null, error = null;
        try
        {
            sitio = await moodle.ObtenerInfoSitio(ct);
        }
        catch (MoodleException ex)
        {
            codigo = ex.Code;
            error = ex.Message;
        }
        return new EstadoMoodleDto(sitio is not null, config.BaseUrl, tokenConfigurado, sitio?.Sitename,
            sitio?.Release, sitio?.Username, codigo, error, cursos, docentes, ultima, DateTime.UtcNow);
    }

    public async Task<List<LogSincronizacionDto>> Logs(int usuarioId, bool admin, int limite, CancellationToken ct = default)
    {
        limite = Math.Clamp(limite, 1, MaximoLogs);
        var query = db.LogsSincronizacion.AsNoTracking();
        if (!admin)
        {
            var docente = await catalogo.Docente(usuarioId, ct);
            query = query.Where(l => l.DocenteId == docente.Id);
        }
        var logs = await query.OrderByDescending(l => l.Fecha).ThenByDescending(l => l.Id).Take(limite)
            .Select(l => new
            {
                l.Id, l.Fecha, l.Operacion, l.Estado, l.Exitoso, l.TotalRegistros, l.MensajeError,
                Curso = l.Curso == null ? null : l.Curso.Codigo + " " + l.Curso.Nombre,
                Docente = db.Docentes.Where(d => d.Id == l.DocenteId).Select(d => d.Nombre).FirstOrDefault(),
            }).ToListAsync(ct);
        return logs.Select(l => new LogSincronizacionDto(l.Id, DateTime.SpecifyKind(l.Fecha, DateTimeKind.Utc),
            l.Operacion, l.Estado, l.Exitoso, l.TotalRegistros, l.Curso, l.Docente, l.MensajeError)).ToList();
    }
}
