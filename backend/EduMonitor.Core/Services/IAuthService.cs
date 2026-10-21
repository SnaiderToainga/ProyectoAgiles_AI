using EduMonitor.Core.DTOs.Auth;
using EduMonitor.Core.Entities.Auth;

namespace EduMonitor.Core.Services;

public interface IAuthService
{
    Task<LoginResponseDto> LoginAsync(LoginRequestDto request, string ipOrigen);
    Task<bool> DesbloquearCuentaAsync(int usuarioId);
    Task<List<LogAcceso>> ObtenerAuditoriaAsync();
}
