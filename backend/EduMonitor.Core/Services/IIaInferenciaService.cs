using EduMonitor.Core.DTOs.Ia;

namespace EduMonitor.Core.Services;

public interface IIaInferenciaService
{
    Task<IaDiagnosticoResponse> GenerarDiagnosticoAsync(IaDiagnosticoRequest request, CancellationToken ct = default);
}