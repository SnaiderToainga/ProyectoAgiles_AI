using System.Net.Http.Json;
using System.Text.Json;
using EduMonitor.Core.DTOs.Ia;
using EduMonitor.Core.Services;

namespace EduMonitor.Infrastructure.Services;

public class IaInferenciaService(IHttpClientFactory httpClientFactory) : IIaInferenciaService
{
    public const string ClientName = "IaServiceClient";
    private const int MaxReintentos = 3;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<IaDiagnosticoResponse> GenerarDiagnosticoAsync(IaDiagnosticoRequest request, CancellationToken ct = default)
    {
        var client = httpClientFactory.CreateClient(ClientName);

        for (int intento = 1; intento <= MaxReintentos; intento++)
        {
            try
            {
                var response = await client.PostAsJsonAsync("api/inferencia/diagnostico", request, ct);

                if (response.IsSuccessStatusCode)
                {
                    var resultado = await response.Content.ReadFromJsonAsync<IaDiagnosticoResponse>(JsonOptions, ct);
                    if (resultado != null && !string.IsNullOrWhiteSpace(resultado.DiagnosticoCualitativo))
                    {
                        return resultado;
                    }
                }

                if ((int)response.StatusCode >= 500 && intento < MaxReintentos)
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(100 * Math.Pow(2, intento)), ct);
                    continue;
                }

                break;
            }
            catch (Exception) when (!ct.IsCancellationRequested)
            {
                if (intento < MaxReintentos)
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(100 * Math.Pow(2, intento)), ct);
                }
            }
        }

        // Activación de contingencia determinista ante fallos de red o indisponibilidad del servicio
        return FallbackDiagnosticoLocal(request);
    }

    private static IaDiagnosticoResponse FallbackDiagnosticoLocal(IaDiagnosticoRequest req)
    {
        var nivel = req.PromedioPonderado < 5.0m ? "Alto" : "Medio";
        var temas = req.TemasCriticos.Select(t => new TemaRefuerzoDto(
            t,
            $"Repasar conceptos teóricos y desarrollar ejercicios prácticos sobre: {t}.",
            nivel == "Alto" ? "Alta" : "Media"
        )).ToList();

        return new IaDiagnosticoResponse(
            nivel,
            $"El estudiante presenta riesgo formativo con un promedio ponderado de {req.PromedioPonderado:F2} en {req.Materia}. Requiere nivelación inmediata en los temas no consolidados.",
            temas
        );
    }
}