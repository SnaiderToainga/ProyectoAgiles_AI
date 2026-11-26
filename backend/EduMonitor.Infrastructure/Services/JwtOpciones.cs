using System.Diagnostics.CodeAnalysis;
using System.Text;

namespace EduMonitor.Infrastructure.Services;

/// <summary>
/// Configuración de firma JWT (sección "Jwt"). La clave no tiene valor por defecto: se toma de
/// variables de entorno o de configuración local no versionada, y se valida al arrancar.
/// </summary>
public sealed class JwtOpciones
{
    public const string Seccion = "Jwt";
    public const int LongitudMinimaBytes = 32;

    /// <summary>Clave que estuvo publicada en el repositorio; nunca debe aceptarse.</summary>
    public const string ClavePublicada = "EduMonitorAI_Secret_Key_FISEI_UTA_2026_SecureKey_MustBeLong!";

    public string Key { get; set; } = string.Empty;
    public string Issuer { get; set; } = "EduMonitorApi";
    public string Audience { get; set; } = "EduMonitorClient";

    public static bool ClaveValida([NotNullWhen(true)] string? clave) =>
        !string.IsNullOrWhiteSpace(clave)
        && Encoding.UTF8.GetByteCount(clave) >= LongitudMinimaBytes
        && clave != ClavePublicada;

    public const string MensajeClaveInvalida =
        "Configure Jwt:Key (o la variable Jwt__Key / JWT_KEY) con una clave propia de al menos 32 caracteres. " +
        "La clave publicada en versiones anteriores del repositorio no se acepta.";
}
