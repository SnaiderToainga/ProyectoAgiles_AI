using System.Text.RegularExpressions;
using System.Net;
using EduMonitor.Core.Enums;

namespace EduMonitor.Infrastructure.Moodle;

public static class MoodleCurriculoResolver
{
    public static TipoItemEvaluacion ResolverTipo(string? nombre)
    {
        const RegexOptions flags = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;
        var titulo = nombre ?? "";
        if (Regex.IsMatch(titulo, @"\b(APE|Laboratorio|Taller)\b", flags)) return TipoItemEvaluacion.APE;
        if (Regex.IsMatch(titulo, @"\b(Examen|Autónomo|Autonomo|AA)\b", flags)) return TipoItemEvaluacion.Examen;
        if (Regex.IsMatch(titulo, @"\b(Evaluación|Evaluacion|Tarea|ACD)\b", flags)) return TipoItemEvaluacion.Tarea;
        return TipoItemEvaluacion.SinClasificar;
    }

    public static IReadOnlyList<string> ExtraerTemas(string? summary)
    {
        // Conservar los separadores antes de retirar el HTML; decodificar &amp;, &nbsp;, etc.
        var texto = Regex.Replace(summary ?? "", @"<(script|style)\b[^>]*>[\s\S]*?</\1>", "", RegexOptions.IgnoreCase);
        texto = Regex.Replace(texto, @"<br\s*/?>|</(?:p|div|li|h[1-6])\s*>", "\n", RegexOptions.IgnoreCase);
        texto = WebUtility.HtmlDecode(Regex.Replace(texto, "<[^>]*>", ""));
        return texto.Split([',', '\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }
    public static int? ResolverParcial(int numeroSeccion, string? nombre)
    {
        // La sección general no participa en la evaluación.
        if (numeroSeccion <= 0)
            return null;

        var titulo = nombre ?? "";

        const RegexOptions opciones =
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;

        var primero = Regex.IsMatch(
            titulo,
            @"\b(PRIMER\s+PARCIAL|PARCIAL\s+1|1P)\b",
            opciones);

        var segundo = Regex.IsMatch(
            titulo,
            @"\b(SEGUNDO\s+PARCIAL|PARCIAL\s+2|2P)\b",
            opciones);

        // Un título contradictorio requiere revisión.
        if (primero && segundo)
            return null;

        // El nombre explícito tiene prioridad.
        if (primero)
            return 1;

        if (segundo)
            return 2;

        // Convención acordada para nombres genéricos.
        return numeroSeccion switch
        {
            1 or 2 => 1,
            3 or 4 => 2,
            _ => null
        };
    }
}
