using EduMonitor.Infrastructure.Moodle;
using EduMonitor.Core.Enums;

namespace EduMonitor.Tests;

public class MoodleCurriculoResolverTests
{
    [Theory]
    [InlineData("Taller Práctico APE 1", TipoItemEvaluacion.APE)]
    [InlineData("Laboratorio 2", TipoItemEvaluacion.APE)]
    [InlineData("APE: Simulación", TipoItemEvaluacion.APE)]
    [InlineData("Examen Primer Parcial", TipoItemEvaluacion.Examen)]
    [InlineData("Trabajo Autónomo 1", TipoItemEvaluacion.Examen)]
    [InlineData("Trabajo Autonomo 2", TipoItemEvaluacion.Examen)]
    [InlineData("AA: Investigación", TipoItemEvaluacion.Examen)]
    [InlineData("Evaluación 1.1", TipoItemEvaluacion.Tarea)]
    [InlineData("Evaluacion 2.1", TipoItemEvaluacion.Tarea)]
    [InlineData("Tarea de Scrum", TipoItemEvaluacion.Tarea)]
    [InlineData("ACD: Actividad", TipoItemEvaluacion.Tarea)]
    [InlineData("Configuración de Kanban", TipoItemEvaluacion.SinClasificar)]
    [InlineData("", TipoItemEvaluacion.SinClasificar)]
    [InlineData(null, TipoItemEvaluacion.SinClasificar)]
    public void ClasificaActividadPorNombre(string? nombre, TipoItemEvaluacion esperado) =>
        Assert.Equal(esperado, MoodleCurriculoResolver.ResolverTipo(nombre));

    [Fact]
    public void TemasDecodificanHtmlConservanSaltosYNoDuplican()
    {
        Assert.Equal(new[] { "Pilas", "colas", "Árboles & grafos", "Listas" },
            MoodleCurriculoResolver.ExtraerTemas("<p>Pilas, colas</p><p>Árboles &amp; grafos<br>Listas, PILAS</p><script>no crear</script>"));
        Assert.Empty(MoodleCurriculoResolver.ExtraerTemas(null));
    }
    [Theory]
    [InlineData(1, "Tema 1", 1)]
    [InlineData(2, "Tema 2", 1)]
    [InlineData(3, "Tema 3", 2)]
    [InlineData(4, "Tema 4", 2)]
    [InlineData(2, "SEGUNDO PARCIAL: Calidad", 2)]
    [InlineData(3, "PRIMER PARCIAL: Scrum", 1)]
    [InlineData(2, "2P: Actividades", 2)]
    [InlineData(4, "1P: Actividades", 1)]
    [InlineData(1, "parcial 2: examen", 2)]
    [InlineData(2, null, 1)]
    public void ResuelveParcialConPrioridadDelNombre(
        int seccion,
        string? nombre,
        int esperado)
    {
        var resultado =
            MoodleCurriculoResolver.ResolverParcial(seccion, nombre);

        Assert.Equal(esperado, resultado);
    }

    [Theory]
    [InlineData(0, "General")]
    [InlineData(0, "PRIMER PARCIAL")]
    [InlineData(5, "Contenido adicional")]
    [InlineData(1, "PRIMER PARCIAL y SEGUNDO PARCIAL")]
    public void NoAsignaParcialCuandoNoCorrespondeOEsAmbiguo(
        int seccion,
        string nombre)
    {
        var resultado =
            MoodleCurriculoResolver.ResolverParcial(seccion, nombre);

        Assert.Null(resultado);
    }
}
