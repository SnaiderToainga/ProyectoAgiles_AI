namespace EduMonitor.Core.Entities.Auth;
public class LogAcceso
{
    public int Id { get; set; }
    public int? UsuarioId { get; set; }
    public string EmailIntentado { get; set; } = string.Empty;
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;
    public bool Exitoso { get; set; }
    public string Detalle { get; set; } = string.Empty;
    public string IpOrigen { get; set; } = "127.0.0.1";
}
