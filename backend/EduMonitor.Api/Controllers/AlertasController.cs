using System.Security.Claims;
using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduMonitor.Api.Controllers;

/// <summary>Indicadores de progreso y alertas académicas configurables (RF-05, RF-07).</summary>
[ApiController, Route("api/academico/materias/{cursoId:int}"), Authorize(Roles = "Docente,Administrador")]
public class AlertasController(AlertasService alertas) : ControllerBase
{
    private int UsuarioId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) && id > 0
        ? id : throw new AcademicoException(403, "Identidad sin identificador válido.");
    private bool Admin => User.IsInRole("Administrador");

    [HttpGet("parciales/{parcialId:int}/alertas")]
    public async Task<IActionResult> Alertas(int cursoId, int parcialId, CancellationToken ct) =>
        Ok(await alertas.Alertas(UsuarioId, Admin, cursoId, parcialId, ct));

    [HttpGet("configuracion-alertas")]
    public async Task<IActionResult> Configuracion(int cursoId, CancellationToken ct) =>
        Ok(await alertas.Configuracion(UsuarioId, Admin, cursoId, ct));

    [HttpPut("configuracion-alertas")]
    public async Task<IActionResult> GuardarConfiguracion(int cursoId, ConfiguracionAlertasDto config, CancellationToken ct) =>
        Ok(await alertas.GuardarConfiguracion(UsuarioId, Admin, cursoId, config, ct));
}
