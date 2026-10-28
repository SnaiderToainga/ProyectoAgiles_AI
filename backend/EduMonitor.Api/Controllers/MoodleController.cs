using System.Security.Claims;
using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Infrastructure.Moodle;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace EduMonitor.Api.Controllers;
[ApiController,Route("api/moodle"),Authorize(Roles="Docente,Administrador")]
public class MoodleController(MoodleSyncService sync) : ControllerBase
{
    private int UsuarioId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier),out var id) && id>0
        ? id : throw new AcademicoException(403,"Identidad inválida.");
    [HttpPost("sync-cursos")]
    public async Task<IActionResult> Cursos(CancellationToken ct)=>Ok(await sync.Cursos(UsuarioId,ct));
    [HttpPost("sync-notas/{cursoId:int}")]
    public async Task<IActionResult> Notas(int cursoId,CancellationToken ct)=>Ok(await sync.Notas(UsuarioId,cursoId,ct));
}
