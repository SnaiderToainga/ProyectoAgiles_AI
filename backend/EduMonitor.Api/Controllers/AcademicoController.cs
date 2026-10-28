using System.Security.Claims;
using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace EduMonitor.Api.Controllers;
[ApiController, Route("api/academico"), Authorize(Roles="Docente,Administrador")]
public class AcademicoController(CatalogoService catalogo) : ControllerBase
{
    private int UsuarioId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier),out var id) && id>0
        ? id : throw new AcademicoException(403,"Identidad sin identificador válido.");
    private bool Admin => User.IsInRole("Administrador");
    [HttpGet("materias")]
    public async Task<IActionResult> Materias(CancellationToken ct) => Ok(await catalogo.Materias(UsuarioId,Admin,ct));
    [HttpPost("temas")]
    public async Task<IActionResult> Tema(TemaRequest request,CancellationToken ct) => StatusCode(201,await catalogo.CrearTema(UsuarioId,Admin,request,ct));
    [HttpGet("materias/{cursoId:int}/evaluaciones")]
    public async Task<IActionResult> Evaluaciones(int cursoId,CancellationToken ct) => Ok(await catalogo.Evaluaciones(UsuarioId,Admin,cursoId,ct));
    [HttpPost("evaluaciones")]
    public async Task<IActionResult> Evaluacion(EvaluacionRequest request,CancellationToken ct) => StatusCode(201,new {id=await catalogo.CrearEvaluacion(UsuarioId,Admin,request,ct)});
    [HttpPut("evaluaciones/{id:int}/clasificacion")]
    public async Task<IActionResult> Clasificar(int id,ClasificarRequest request,CancellationToken ct)
    {await catalogo.Clasificar(UsuarioId,Admin,id,request,ct);return NoContent();}
}
