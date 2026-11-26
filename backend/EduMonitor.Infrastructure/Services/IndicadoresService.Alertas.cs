using System.Globalization;
using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.DTOs.Calculo;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Enums;

namespace EduMonitor.Infrastructure.Services;

/// <summary>
/// Indicadores de progreso (RF-05/RF-06) y reglas de alerta configurables (RF-07).
/// Todo es determinista: el agente de IA solo explica estos resultados (sección 7).
/// </summary>
public partial class IndicadoresService
{
    private const int MaximoActividadesEvidencia = 5;
    private static readonly CultureInfo Cultura = CultureInfo.InvariantCulture;

    public IndicadoresProgresoDto CalcularProgreso(IEnumerable<Calificacion> calificaciones, int totalActividades)
    {
        var lista = calificaciones.ToList();
        var calificadas = lista.Count(c => c.Nota.HasValue);
        var sinEntrega = lista.Count(c => !c.Nota.HasValue && c.Estado == EstadoCalificacion.SinEntrega);
        // Una entrega registrada sin nota también está pendiente de calificar.
        var pendientesCalificar = lista.Count(c => !c.Nota.HasValue &&
            c.Estado is EstadoCalificacion.PendienteCalificar or EstadoCalificacion.Entregado);
        var pendientesEntrega = lista.Count(c => !c.Nota.HasValue && c.Estado == EstadoCalificacion.PendienteEntrega);
        var total = Math.Max(totalActividades, lista.Count);
        var sinDato = total - calificadas - sinEntrega - pendientesCalificar - pendientesEntrega;
        return Construir(total, calificadas, sinEntrega, pendientesCalificar, pendientesEntrega, sinDato);
    }

    public static IndicadoresProgresoDto Sumar(IEnumerable<IndicadoresProgresoDto> indicadores)
    {
        var lista = indicadores.ToList();
        return Construir(lista.Sum(i => i.TotalActividades), lista.Sum(i => i.Calificadas), lista.Sum(i => i.SinEntrega),
            lista.Sum(i => i.PendientesCalificar), lista.Sum(i => i.PendientesEntrega), lista.Sum(i => i.SinDato));
    }

    public List<AlertaAcademicaDto> EvaluarAlertas(
        ResumenAcademicoEstudianteDto resumen,
        IReadOnlyList<Calificacion> calificaciones,
        IndicadoresProgresoDto indicadores,
        ConfiguracionAlertasDto config)
    {
        var alertas = new List<AlertaAcademicaDto>();
        var ordenadas = calificaciones
            .Where(c => c.ItemEvaluacion is not null)
            .OrderBy(c => c.ItemEvaluacion.Orden).ThenBy(c => c.ItemEvaluacion.Id)
            .ToList();

        if (config.RendimientoActivo && !resumen.SinEvaluaciones && resumen.NotaFinalParcial < config.RendimientoUmbral)
        {
            var bajas = ordenadas.Where(c => c.Nota.HasValue && c.Nota < config.RendimientoUmbral)
                .Select(c => $"{c.ItemEvaluacion.Nombre} ({F(c.Nota!.Value)})").Take(MaximoActividadesEvidencia).ToList();
            var provisional = resumen.CalculoProvisional ? " Cálculo provisional: aún faltan componentes por evaluar." : "";
            alertas.Add(new AlertaAcademicaDto(ReglasAlerta.Rendimiento, "Rendimiento bajo el umbral",
                $"Nota del parcial {F(resumen.NotaFinalParcial)} / 10, menor que el umbral configurado de {F(config.RendimientoUmbral)}.{provisional}",
                bajas));
        }

        if (config.DescensoActivo)
        {
            // Secuencia evaluada en el orden del curso; una entrega vencida sin envío cuenta como 0.
            var secuencia = ordenadas
                .Where(c => c.Nota.HasValue || c.Estado == EstadoCalificacion.SinEntrega)
                .Select(c => (Nombre: c.ItemEvaluacion.Nombre, Valor: c.Nota ?? 0m))
                .ToList();
            if (secuencia.Count > config.DescensoUltimas)
            {
                var recientes = secuencia.TakeLast(config.DescensoUltimas).ToList();
                var anteriores = secuencia.Take(secuencia.Count - config.DescensoUltimas).ToList();
                var promedioReciente = Math.Round(recientes.Average(x => x.Valor), 2);
                var promedioAnterior = Math.Round(anteriores.Average(x => x.Valor), 2);
                var caida = promedioAnterior - promedioReciente;
                if (caida >= config.DescensoPuntos)
                {
                    alertas.Add(new AlertaAcademicaDto(ReglasAlerta.Descenso, "Descenso en las últimas evaluaciones",
                        $"Promedio de las últimas {recientes.Count} evaluaciones: {F(promedioReciente)}, frente a {F(promedioAnterior)} " +
                        $"en las {anteriores.Count} anteriores (baja de {F(caida)} puntos; umbral {F(config.DescensoPuntos)}).",
                        recientes.Select(x => $"{x.Nombre} ({F(x.Valor)})").ToList()));
                }
            }
        }

        var vencidas = ordenadas
            .Where(c => !c.Nota.HasValue && c.Estado == EstadoCalificacion.SinEntrega)
            .Select(c => c.ItemEvaluacion.Nombre).ToList();
        if (config.AtrasosActivo && vencidas.Count >= config.AtrasosMinimo)
        {
            alertas.Add(new AlertaAcademicaDto(ReglasAlerta.Atrasos, "Actividades vencidas sin entrega",
                $"{vencidas.Count} actividades vencieron sin entrega (umbral configurado: {config.AtrasosMinimo}).",
                vencidas.Take(MaximoActividadesEvidencia).ToList()));
        }

        // Con una sola actividad exigible el porcentaje no es representativo.
        if (config.FinalizacionActivo && indicadores.Exigibles >= 2 &&
            indicadores.PorcentajeFinalizacion is decimal pct && pct < config.FinalizacionMinimaPct)
        {
            alertas.Add(new AlertaAcademicaDto(ReglasAlerta.Finalizacion, "Baja finalización de actividades",
                $"Completó {indicadores.Completadas} de {indicadores.Exigibles} actividades exigibles ({pct.ToString("0.#", Cultura)} %), " +
                $"por debajo del {config.FinalizacionMinimaPct.ToString("0.#", Cultura)} % configurado.",
                vencidas.Take(MaximoActividadesEvidencia).ToList()));
        }

        return alertas;
    }

    private static IndicadoresProgresoDto Construir(int total, int calificadas, int sinEntrega, int pendientesCalificar,
        int pendientesEntrega, int sinDato)
    {
        var completadas = calificadas + pendientesCalificar;
        var exigibles = completadas + sinEntrega;
        decimal? porcentaje = exigibles > 0 ? Math.Round(completadas * 100m / exigibles, 1) : null;
        return new IndicadoresProgresoDto(total, calificadas, sinEntrega, pendientesCalificar, pendientesEntrega,
            Math.Max(sinDato, 0), completadas, exigibles, porcentaje);
    }

    private static string F(decimal valor) => valor.ToString("0.00", Cultura);
}
