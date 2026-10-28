using System.Globalization;
using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using EduMonitor.Core.DTOs;
using EduMonitor.Core.Services;
using Microsoft.Extensions.Options;

namespace EduMonitor.Infrastructure.Moodle;
public sealed class MoodleService(IHttpClientFactory factory, IOptions<MoodleOptions> options) : IMoodleService
{
    public const string ClientName = "Moodle";
    private readonly MoodleOptions config = options.Value;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    { NumberHandling = JsonNumberHandling.AllowReadingFromString };

    public async Task<IReadOnlyList<MoodleCursoDto>> ObtenerCursosPorDocente(int docenteMoodleId, CancellationToken ct = default)
    {
        var cursos = await Call<List<MoodleCursoDto>>("core_enrol_get_users_courses", Args("userid", docenteMoodleId), ct);
        var result = new List<MoodleCursoDto>();
        // La función devuelve todas las matrículas, también aquellas con rol estudiante.
        foreach (var curso in cursos)
        {
            var users = await ObtenerParticipantes(curso.Id, ct);
            if (users.Any(u => u.Id == docenteMoodleId && u.Roles.Any(r => config.TeacherRoles.Contains(r.Shortname))))
                result.Add(curso);
        }
        return result;
    }
    public Task<MoodleCalificacionesDto> ObtenerCalificacionesPorCurso(int cursoMoodleId, CancellationToken ct = default)
    {
        var args = Args("courseid", cursoMoodleId); args["userid"] = "0";
        return Call<MoodleCalificacionesDto>("gradereport_user_get_grade_items", args, ct);
    }
    public async Task<IReadOnlyList<MoodleParticipanteDto>> ObtenerParticipantes(int cursoMoodleId, CancellationToken ct = default)
    {
        var result = new List<MoodleParticipanteDto>();
        for (var offset = 0; ; offset += 200)
        {
            var args = Args("courseid", cursoMoodleId);
            args["options[0][name]"] = "limitfrom"; args["options[0][value]"] = offset.ToString(CultureInfo.InvariantCulture);
            args["options[1][name]"] = "limitnumber"; args["options[1][value]"] = "200";
            var page = await Call<List<MoodleParticipanteDto>>("core_enrol_get_enrolled_users", args, ct);
            result.AddRange(page);
            if (page.Count < 200) return result;
        }
    }
    public Task<MoodleTareasDto> ObtenerTareas(int cursoMoodleId, CancellationToken ct = default) =>
        Call<MoodleTareasDto>("mod_assign_get_assignments", Args("courseids[0]", cursoMoodleId), ct);
    public Task<MoodleEstadoEntregaDto> ObtenerEstadoEntrega(int tareaId, int usuarioId, CancellationToken ct = default)
    {
        var args = Args("assignid", tareaId); args["userid"] = usuarioId.ToString(CultureInfo.InvariantCulture);
        return Call<MoodleEstadoEntregaDto>("mod_assign_get_submission_status", args, ct);
    }
    private static Dictionary<string,string> Args(string name, int value)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(value);
        return new() { [name] = value.ToString(CultureInfo.InvariantCulture) };
    }
    private async Task<T> Call<T>(string function, Dictionary<string,string> args, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(config.MoodleToken))
            throw new MoodleException("moodle_not_configured", "Configure Moodle:MoodleToken en el servidor.", 503);
        args["wstoken"] = config.MoodleToken;
        args["wsfunction"] = function;
        args["moodlewsrestformat"] = "json";
        using var client = factory.CreateClient(ClientName);
        for (int attempt = 0; ; attempt++)
        {
            try
            {
                // El token va en el cuerpo, nunca en URL, errores ni logs.
                using var content = new FormUrlEncodedContent(args);
                using var response = await client.PostAsync("webservice/rest/server.php", content, ct);
                if ((response.StatusCode == HttpStatusCode.TooManyRequests || (int)response.StatusCode >= 500)
                    && attempt < config.MaxRetries)
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(250 * (1 << attempt)), ct);
                    continue;
                }
                if (!response.IsSuccessStatusCode)
                    throw new MoodleException("moodle_http_error", $"Moodle respondió HTTP {(int)response.StatusCode}.");
                using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
                var root = json.RootElement;
                if (root.ValueKind == JsonValueKind.Object)
                {
                    if (root.TryGetProperty("exception", out _) || root.TryGetProperty("errorcode", out _))
                    {
                        var invalid = root.TryGetProperty("errorcode", out var code) && code.GetString() == "invalidtoken";
                        throw new MoodleException(invalid ? "moodle_invalid_token" : "moodle_rejected",
                            invalid ? "El token de Moodle es inválido o ha caducado." : "Moodle rechazó la operación. Revise funciones y permisos del servicio.");
                    }
                    if (root.TryGetProperty("warnings", out var warnings) && warnings.GetArrayLength() > 0)
                        throw new MoodleException("moodle_incomplete", "Moodle devolvió advertencias; se canceló la sincronización para evitar datos parciales.");
                }
                return root.Deserialize<T>(Json) ?? throw new JsonException();
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                if (attempt >= config.MaxRetries) throw new MoodleException("moodle_timeout", "Moodle excedió el tiempo de espera.", 504);
            }
            catch (HttpRequestException)
            {
                if (attempt >= config.MaxRetries) throw new MoodleException("moodle_network", "No se pudo establecer comunicación con Moodle.", 503);
            }
            catch (JsonException)
            { throw new MoodleException("moodle_invalid_json", "La respuesta de Moodle no coincide con el contrato JSON esperado."); }
            await Task.Delay(TimeSpan.FromMilliseconds(250 * (1 << attempt)), ct);
        }
    }
}
