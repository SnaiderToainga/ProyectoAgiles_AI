using System.Security.Claims;
using EduMonitor.Core.DTOs.Auth;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace EduMonitor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
    {
        string ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var resultado = await _authService.LoginAsync(request, ip);

        if (!resultado.Exitoso)
        {
            if (resultado.CuentaBloqueada)
            {
                // Código HTTP 423 Locked para cuenta bloqueada por 3 fallos
                return StatusCode(StatusCodes.Status423Locked, resultado);
            }
            return Unauthorized(resultado);
        }

        return Ok(resultado);
    }

    [Authorize(Roles="Administrador")]
    [HttpGet("auditoria")]
    public async Task<IActionResult> ObtenerAuditoria()
    {
        var logs = await _authService.ObtenerAuditoriaAsync();
        return Ok(logs);
    }

    [Authorize(Roles="Administrador")]
    [HttpGet("usuarios")]
    public async Task<IActionResult> ObtenerUsuarios([FromServices] GestionUsuariosService gestion, CancellationToken ct) =>
        Ok(await gestion.Listar(ct));

    /// <summary>Crea una cuenta con contraseña cifrada; si es Docente, también su registro académico.</summary>
    [Authorize(Roles="Administrador")]
    [HttpPost("usuarios")]
    public async Task<IActionResult> CrearUsuario([FromBody] CrearUsuarioRequest request,
        [FromServices] GestionUsuariosService gestion, CancellationToken ct)
    {
        var resultado = await gestion.Crear(request, AdministradorId, ct);
        return StatusCode(StatusCodes.Status201Created, resultado);
    }

    /// <summary>Enlaza (o desenlaza con null) la cuenta de un docente con su usuario de Moodle.</summary>
    [Authorize(Roles="Administrador")]
    [HttpPut("usuarios/{usuarioId:int}/moodle")]
    public async Task<IActionResult> VincularMoodle(int usuarioId, [FromBody] VincularMoodleRequest request,
        [FromServices] GestionUsuariosService gestion, CancellationToken ct) =>
        Ok(await gestion.VincularMoodle(usuarioId, request.MoodleUserId, AdministradorId, ct));

    private int AdministradorId =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

    [Authorize(Roles="Administrador")]
    [HttpPut("desbloquear/{usuarioId}")]
    public async Task<IActionResult> DesbloquearCuenta(int usuarioId)
    {
        var exito = await _authService.DesbloquearCuentaAsync(usuarioId);
        if (!exito) return NotFound(new { Mensaje = "Usuario no encontrado." });

        return Ok(new { Mensaje = "Cuenta desbloqueada con éxito." });
    }
}
