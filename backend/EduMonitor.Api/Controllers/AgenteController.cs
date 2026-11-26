using System.Security.Claims;
using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EduMonitor.Api.Controllers;

/// <summary>
/// Herramientas del agente pedagógico. El servicio de IA las invoca con el JWT del docente,
/// por lo que solo ve las materias que ese docente puede consultar.
/// </summary>
[ApiController, Route("api/academico/agente"), Authorize(Roles = "Docente,Administrador")]
public class AgenteController(AgenteService agente) : ControllerBase
{
    private int UsuarioId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) && id > 0
        ? id : throw new AcademicoException(403, "Identidad sin identificador válido.");
    private bool Admin => User.IsInRole("Administrador");

    [HttpGet("materias/{cursoId:int}/parciales/{parcialId:int}/estudiantes")]
    public async Task<IActionResult> Estudiantes(int cursoId, int parcialId, CancellationToken ct) =>
        Ok(await agente.DatosCurso(UsuarioId, Admin, cursoId, parcialId, ct));

    [HttpGet("materias/{cursoId:int}/parciales/{parcialId:int}/estudiantes/{codigo}")]
    public async Task<IActionResult> Estudiante(int cursoId, int parcialId, string codigo, CancellationToken ct) =>
        Ok(await agente.Estudiante(UsuarioId, Admin, cursoId, parcialId, codigo, ct));

    [HttpGet("materias/{cursoId:int}/parciales/{parcialId:int}/alertas")]
    public async Task<IActionResult> Alertas(int cursoId, int parcialId, CancellationToken ct) =>
        Ok(await agente.Alertas(UsuarioId, Admin, cursoId, parcialId, ct));

    [HttpPost("trazas")]
    public async Task<IActionResult> RegistrarTraza(RegistrarTrazaAgenteRequest request, CancellationToken ct) =>
        StatusCode(201, new { id = await agente.RegistrarTraza(UsuarioId, Admin, request, ct) });

    [HttpGet("trazas")]
    public async Task<IActionResult> Trazas([FromQuery] int limite = 30, CancellationToken ct = default) =>
        Ok(await agente.Trazas(UsuarioId, Admin, limite, ct));
}
