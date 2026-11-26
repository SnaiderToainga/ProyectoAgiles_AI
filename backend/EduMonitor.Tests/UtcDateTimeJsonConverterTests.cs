using System.Text.Json;
using EduMonitor.Api;

namespace EduMonitor.Tests;

public class UtcDateTimeJsonConverterTests
{
    private static readonly JsonSerializerOptions Opciones = new() { Converters = { new UtcDateTimeJsonConverter() } };

    [Fact]
    public void FechaSinZonaDeLaBase_SeEmiteComoUtc()
    {
        var leida = new DateTime(2026, 11, 20, 15, 30, 0, DateTimeKind.Unspecified);
        Assert.Equal("\"2026-11-20T15:30:00.0000000Z\"", JsonSerializer.Serialize(leida, Opciones));
    }

    [Fact]
    public void FechaSinZonaRecibida_SeInterpretaComoUtc()
    {
        var fecha = JsonSerializer.Deserialize<DateTime>("\"2026-11-20T15:30:00\"", Opciones);
        Assert.Equal(DateTimeKind.Utc, fecha.Kind);
        Assert.Equal(15, fecha.Hour);
    }
}
