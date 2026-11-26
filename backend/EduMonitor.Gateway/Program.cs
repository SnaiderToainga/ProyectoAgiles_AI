using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// 1. Cargar la configuración de YARP desde appsettings.json
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// 2. Configurar CORS para la SPA en React (Cesar Carrasco: http://localhost:5173)
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 3. Validación de JWT en la puerta de enlace: clave obligatoria, sin valor por defecto.
const string ClavePublicada = "EduMonitorAI_Secret_Key_FISEI_UTA_2026_SecureKey_MustBeLong!";
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32 || jwtKey == ClavePublicada)
{
    throw new InvalidOperationException(
        "Configure Jwt:Key (o la variable Jwt__Key / JWT_KEY) con la misma clave propia de la API, de al menos 32 caracteres. " +
        "La clave publicada en versiones anteriores del repositorio no se acepta.");
}
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "EduMonitorApi",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "EduMonitorClient",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

// 4. Puerto por defecto para ejecucion local; en Docker se define con ASPNETCORE_URLS
if (string.IsNullOrWhiteSpace(builder.Configuration["ASPNETCORE_URLS"]) && string.IsNullOrWhiteSpace(builder.Configuration["urls"]))
{
    builder.WebHost.UseUrls("http://localhost:5000");
}

var app = builder.Build();

app.UseCors("CorsPolicy");
app.UseAuthentication();
app.UseAuthorization();

// 5. Mapear el enrutador de YARP
app.MapReverseProxy();

app.Run();
