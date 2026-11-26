using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using EduMonitor.Core.Entities.Academico;
using EduMonitor.Core.Enums;

namespace EduMonitor.Infrastructure.Moodle;

public static class MoodleCurriculoResolver
{
    private static readonly HashSet<string> PalabrasVacias = new(StringComparer.OrdinalIgnoreCase)
    {
        "de", "del", "la", "el", "las", "los", "un", "una", "unos", "unas", "para", "por",
        "con", "sin", "sobre", "a", "al", "e", "y", "o", "u", "en", "1", "2", "3", "4",
        "evaluacion", "taller", "ape", "examen", "tarea", "practico", "practica",
        "autonomo", "teorico", "tema", "actividad", "modelo", "guia", "semana", "parcial"
    };

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

    public static IReadOnlyList<int> ResolverTemasEvaluacion(
        string? nombreEvaluacion,
        TipoItemEvaluacion tipo,
        int moduloInstance,
        IReadOnlyList<Tema> temasUnidad)
    {
        if (temasUnidad is null || temasUnidad.Count == 0)
            return Array.Empty<int>();

        var titulo = nombreEvaluacion ?? "";
        var tituloNorm = NormalizarTexto(titulo);

        // 1. Coincidencia semántica/léxica con palabras clave significativas del tema
        var coincidentes = new List<Tema>();
        foreach (var tema in temasUnidad)
        {
            if (CoincideTema(tituloNorm, tema.Nombre))
            {
                coincidentes.Add(tema);
            }
        }

        if (coincidentes.Count > 0)
        {
            return coincidentes.Select(t => t.Id).Distinct().ToArray();
        }

        // 2. Si es examen o evaluación integradora del parcial, vincular a todos los temas de la unidad
        if (tipo == TipoItemEvaluacion.Examen || Regex.IsMatch(titulo, @"\b(Examen|Integral|Parcial)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
        {
            return temasUnidad.Select(t => t.Id).Distinct().ToArray();
        }

        // 3. Fallback determinista para actividades sin palabras clave específicas:
        // Distribuir equitativamente entre los temas de la sección según la instancia del módulo
        var indice = Math.Abs(moduloInstance) % temasUnidad.Count;
        return [temasUnidad[indice].Id];
    }

    private static bool CoincideTema(string tituloEvaluacionNorm, string nombreTema)
    {
        var temaNorm = NormalizarTexto(nombreTema);
        if (string.IsNullOrWhiteSpace(temaNorm)) return false;

        // Si el nombre normalizado del tema está completamente contenido en el título de la evaluación
        if (tituloEvaluacionNorm.Contains(temaNorm))
            return true;

        // O si alguna palabra significativa del tema (longitud >= 3 y no vacía) coincide
        var palabrasTema = Regex.Split(temaNorm, @"[^\p{L}\p{Nd}]+")
            .Where(p => p.Length >= 3 && !PalabrasVacias.Contains(p))
            .ToList();

        if (palabrasTema.Count == 0) return false;

        var palabrasEval = Regex.Split(tituloEvaluacionNorm, @"[^\p{L}\p{Nd}]+")
            .Where(p => p.Length >= 3 && !PalabrasVacias.Contains(p))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return palabrasTema.Any(p => palabrasEval.Contains(p));
    }

    public static string NormalizarTexto(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return "";
        var normalizado = texto.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in normalizado)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }
}
