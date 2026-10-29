using EduMonitor.Core.DTOs.Ia;
using EduMonitor.Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduMonitor.Api.Controllers;

[ApiController]
[Route("api/agent")]
[Authorize(Roles = "Docente,Administrador")]
public class IaController(IIaInferenciaService iaService) : ControllerBase
{
    [HttpPost("diagnostico-prueba")]
    public async Task<IActionResult> GenerarDiagnosticoPrueba([FromBody] IaDiagnosticoRequest request, CancellationToken ct)
    {
        if (request.TemasCriticos == null || request.TemasCriticos.Count == 0)
        {
            return BadRequest(new { mensaje = "Debe proporcionar al menos un tema crítico para el diagnóstico." });
        }

        var resultado = await iaService.GenerarDiagnosticoAsync(request, ct);
        return Ok(resultado);
    }
}