using EduMonitor.Core.DTOs.Calculo;

namespace EduMonitor.Core.Services;

public interface ICalculoPonderadoService
{
    Task<ResumenAcademicoEstudianteDto> CalcularEstudianteAsync(
        int cursoId,
        int parcialId,
        int estudianteId,
        CancellationToken ct = default);

    Task<List<ResumenAcademicoEstudianteDto>> CalcularCursoAsync(
        int cursoId,
        int parcialId,
        CancellationToken ct = default);
}