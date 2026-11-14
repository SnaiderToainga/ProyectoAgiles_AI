using System.Net;
using EduMonitor.Core.DTOs.Ia;
using EduMonitor.Infrastructure.Services;

namespace EduMonitor.Tests;

public class IaInferenciaTests
{
    private sealed class SyntheticHandler(string respuestaJson, bool forzarError = false) : HttpMessageHandler, IHttpClientFactory
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (forzarError)
            {
                throw new HttpRequestException("Servicio de inferencia no disponible.");
            }

            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(respuestaJson, System.Text.Encoding.UTF8, "application/json")
            };
            return Task.FromResult(response);
        }

        public HttpClient CreateClient(string name) => new(this, false)
        {
            BaseAddress = new Uri("http://localhost:5000/")
        };
    }

    [Fact]
    public async Task GenerarDiagnostico_DeserializaJsonValidoCorrectamente()
    {
        var jsonRespuesta = """
        {
          "nivelRiesgo": "Alto",
          "diagnosticoCualitativo": "Vacíos críticos en árboles binarios y balanceo.",
          "temasRefuerzo": [
            {
              "tema": "Árboles AVL",
              "recomendacion": "Realizar ejercicios prácticos de balanceo e inserción.",
              "prioridad": "Alta"
            }
          ]
        }
        """;

        var fakeFactory = new SyntheticHandler(jsonRespuesta);
        var service = new IaInferenciaService(fakeFactory);

        var request = new IaDiagnosticoRequest(
            "Estructuras de Datos",
            1,
            4.80m,
            new List<ComponenteDeficienteDto> { new("Examen", 4.0m, 0.40m) },
            new List<string> { "Árboles AVL" }
        );

        var resultado = await service.GenerarDiagnosticoAsync(request);

        Assert.NotNull(resultado);
        Assert.Equal("Alto", resultado.NivelRiesgo);
        Assert.Single(resultado.TemasRefuerzo);
        Assert.Equal("Árboles AVL", resultado.TemasRefuerzo[0].Tema);
    }

    [Fact]
    public async Task GenerarDiagnostico_ActivaFallbackDeterminista_CuandoFallaRed()
    {
        var fakeFactory = new SyntheticHandler("", forzarError: true);
        var service = new IaInferenciaService(fakeFactory);

        var request = new IaDiagnosticoRequest(
            "Metodologías Ágiles",
            1,
            5.20m,
            new List<ComponenteDeficienteDto> { new("Tareas", 5.0m, 0.30m) },
            new List<string> { "Historias de Usuario" }
        );

        var resultado = await service.GenerarDiagnosticoAsync(request);

        Assert.NotNull(resultado);
        Assert.Equal("Medio", resultado.NivelRiesgo);
        Assert.Contains("Metodologías Ágiles", resultado.DiagnosticoCualitativo);
        Assert.Single(resultado.TemasRefuerzo);
    }
}