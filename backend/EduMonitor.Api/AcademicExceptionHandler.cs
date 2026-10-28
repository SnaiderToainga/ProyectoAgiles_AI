using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Infrastructure.Moodle;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
namespace EduMonitor.Api;
public sealed class AcademicExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context,Exception exception,CancellationToken ct)
    {
        var status=exception switch {AcademicoException e=>e.Status,MoodleException e=>e.HttpStatus,_=>0};
        if(status==0)return false;
        context.Response.StatusCode=status;
        await context.Response.WriteAsJsonAsync(new ProblemDetails{Status=status,Title=exception.Message,
            Extensions={ ["code"]=exception is MoodleException m?m.Code:"academic_validation" }},ct);
        return true;
    }
}
