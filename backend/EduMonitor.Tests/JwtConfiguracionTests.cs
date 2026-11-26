using EduMonitor.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace EduMonitor.Tests;

/// <summary>La API no debe arrancar sin una clave JWT propia (sin valor por defecto ni la clave publicada).</summary>
public class JwtConfiguracionTests
{
    private sealed class Factory(string? clave) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = clave,
                ["Moodle:MoodleToken"] = "",
            }));
        }
    }

    [Theory]
    [InlineData("")]
    [InlineData("demasiado-corta")]
    [InlineData(JwtOpciones.ClavePublicada)]
    public void ClaveInvalidaImpideArrancar(string clave)
    {
        using var factory = new Factory(clave);
        var ex = Assert.Throws<OptionsValidationException>(() => factory.CreateClient());
        Assert.Contains("Jwt:Key", ex.Message);
    }

    [Fact]
    public void ClavePropiaPermiteArrancar()
    {
        using var factory = new Factory("Clave_Propia_De_Prueba_Con_Mas_De_32_Caracteres_0123");
        using var cliente = factory.CreateClient();
        Assert.NotNull(cliente);
    }

    [Theory]
    [InlineData(null, false)]
    [InlineData("   ", false)]
    [InlineData(JwtOpciones.ClavePublicada, false)]
    [InlineData("0123456789abcdef0123456789abcdef", true)]
    public void ValidacionDeClave(string? clave, bool esperado) =>
        Assert.Equal(esperado, JwtOpciones.ClaveValida(clave));
}
