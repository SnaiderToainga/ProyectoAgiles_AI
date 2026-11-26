namespace EduMonitor.Core.Entities.Academico;

/// <summary>
/// Reglas de alerta académica configurables por materia (RF-07). Si una materia no tiene fila,
/// se aplican los valores predeterminados de <see cref="EduMonitor.Core.DTOs.Academico.ConfiguracionAlertasDto"/>.
/// </summary>
public class ConfiguracionAlertas
{
    public int CursoId { get; set; }

    public bool RendimientoActivo { get; set; } = true;
    public decimal RendimientoUmbral { get; set; } = 7.00m;

    public bool DescensoActivo { get; set; } = true;
    public int DescensoUltimas { get; set; } = 2;
    public decimal DescensoPuntos { get; set; } = 1.50m;

    public bool AtrasosActivo { get; set; } = true;
    public int AtrasosMinimo { get; set; } = 2;

    public bool FinalizacionActivo { get; set; } = true;
    public decimal FinalizacionMinimaPct { get; set; } = 60m;

    public DateTime FechaActualizacion { get; set; } = DateTime.UtcNow;
    public int? ActualizadoPorUsuarioId { get; set; }
}
