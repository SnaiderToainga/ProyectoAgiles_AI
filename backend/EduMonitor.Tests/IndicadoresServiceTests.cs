using EduMonitor.Core.Entities;
using EduMonitor.Core.Enums;
using EduMonitor.Infrastructure.Services;
using Xunit;

namespace EduMonitor.Tests;

public class IndicadoresServiceTests
{
    private readonly IndicadoresService _servicio = new();

    [Fact]
    public void PromedioGeneral_DebeIgnorarValoresNulosYSinEntrega()
    {
        var calificaciones = new List<Calificacion>
        {
            new() { Estado = EstadoCalificacion.Entregado, Nota = 9.0m },
            new() { Estado = EstadoCalificacion.SinEntrega, Nota = null },
            new() { Estado = EstadoCalificacion.PendienteCalificar, Nota = null }
        };

        var resultado = _servicio.CalcularPromedioGeneralEvaluado(calificaciones);
        Assert.Equal(9.00m, resultado);
    }

    [Fact]
    public void PromedioGeneral_DebeProcesarNotaCeroLegitima()
    {
        var calificaciones = new List<Calificacion>
        {
            new() { Estado = EstadoCalificacion.Entregado, Nota = 0.0m },
            new() { Estado = EstadoCalificacion.Entregado, Nota = 10.0m }
        };

        var resultado = _servicio.CalcularPromedioGeneralEvaluado(calificaciones);
        Assert.Equal(5.00m, resultado);
    }

    [Fact]
    public void PromedioPonderadoUta_DebeRespetar30_30_40()
    {
        var itemTarea = new ItemEvaluacion { Tipo = TipoItemEvaluacion.Tarea };
        var itemApe = new ItemEvaluacion { Tipo = TipoItemEvaluacion.APE };
        var itemExamen = new ItemEvaluacion { Tipo = TipoItemEvaluacion.Examen };

        var calificaciones = new List<Calificacion>
        {
            new() { ItemEvaluacion = itemTarea, Estado = EstadoCalificacion.Entregado, Nota = 10.0m },
            new() { ItemEvaluacion = itemApe, Estado = EstadoCalificacion.Entregado, Nota = 8.0m },
            new() { ItemEvaluacion = itemExamen, Estado = EstadoCalificacion.Entregado, Nota = 7.0m }
        };

        var resultado = _servicio.CalcularPromedioPonderadoUta(calificaciones);
        Assert.Equal(8.20m, resultado);
    }

    [Fact]
    public void Progreso_DebeCalcularPorcentajeCorrectamente()
    {
        var calificaciones = new List<Calificacion>
        {
            new() { Estado = EstadoCalificacion.Entregado, Nota = 8.5m },
            new() { Estado = EstadoCalificacion.PendienteCalificar, Nota = null },
            new() { Estado = EstadoCalificacion.SinEntrega, Nota = null }
        };

        var resultado = _servicio.CalcularPorcentajeProgreso(calificaciones, totalActividadesCurso: 4);
        Assert.Equal(50.00m, resultado);
    }
}
