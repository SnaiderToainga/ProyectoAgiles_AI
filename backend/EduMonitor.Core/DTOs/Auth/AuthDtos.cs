namespace EduMonitor.Core.DTOs.Auth;

public record LoginRequestDto(string Email, string Password);

public record LoginResponseDto(
    bool Exitoso,
    string Mensaje,
    string? Token,
    int? IntentosRestantes,
    bool CuentaBloqueada,
    UsuarioInfoDto? Usuario
);

public record UsuarioInfoDto(
    int Id,
    string NombreCompleto,
    string Email,
    string Rol
);
