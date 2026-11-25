namespace EduMonitor.Core.DTOs.Auth;

/// <summary>Alta de una cuenta por el administrador. MoodleUserId solo aplica al rol Docente.</summary>
public record CrearUsuarioRequest(
    string NombreCompleto,
    string Email,
    string Password,
    string Rol,
    string? Username = null,
    int? MoodleUserId = null
);

/// <summary>Enlace (o desenlace con null) de un docente con su usuario de Moodle.</summary>
public record VincularMoodleRequest(int? MoodleUserId);

public record UsuarioAdminDto(
    int Id,
    string Username,
    string Email,
    string NombreCompleto,
    string Rol,
    int Status,
    int IntentosFallidos,
    DateTime? FechaBloqueo,
    int? MoodleUserId
);

/// <summary>Resultado de verificar un usuario de Moodle con la cuenta de servicio.</summary>
public record VinculoMoodleDto(
    int UsuarioId,
    int? MoodleUserId,
    string? NombreMoodle,
    IReadOnlyList<string> CursosMoodle,
    string? Advertencia
);

public record CrearUsuarioResponse(UsuarioAdminDto Usuario, VinculoMoodleDto? Moodle);
