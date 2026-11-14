namespace EduMonitor.Core.Entities.Auth;
public class Usuario
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string NombreCompleto { get; set; } = string.Empty;
    public string Rol { get; set; } = "Docente"; // 'Docente' o 'Administrador'
    
    /// <summary>
    /// Regla institucional FISEI:
    /// 1 = Cuenta Activa
    /// 0 = Cuenta Bloqueada por 3 intentos fallidos consecutivos
    /// </summary>
    public int Status { get; set; } = 1;
    
    public int IntentosFallidos { get; set; } = 0;
    public DateTime? FechaBloqueo { get; set; }
}
