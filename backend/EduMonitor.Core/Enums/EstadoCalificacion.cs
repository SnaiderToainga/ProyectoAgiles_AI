namespace EduMonitor.Core.Enums;

public enum EstadoCalificacion
{
    Entregado = 1,          // Asentada con nota numerica
    SinEntrega = 2,         // Plazo vencido sin entrega (Nota es null)
    PendienteCalificar = 3  // Entregada por el alumno, pendiente de calificar
}
