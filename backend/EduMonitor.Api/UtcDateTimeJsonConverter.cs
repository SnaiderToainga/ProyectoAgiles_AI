using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EduMonitor.Api;

/// <summary>
/// Todas las fechas se guardan en UTC, pero SQL Server las devuelve sin zona (Kind = Unspecified).
/// Sin este convertidor el JSON sale sin "Z" y el navegador las interpreta como hora local.
/// </summary>
public sealed class UtcDateTimeJsonConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var valor = reader.GetDateTime();
        return valor.Kind switch
        {
            DateTimeKind.Local => valor.ToUniversalTime(),
            DateTimeKind.Unspecified => DateTime.SpecifyKind(valor, DateTimeKind.Utc),
            _ => valor,
        };
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utc = value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : DateTime.SpecifyKind(value, DateTimeKind.Utc);
        writer.WriteStringValue(utc.ToString("O", CultureInfo.InvariantCulture));
    }
}
