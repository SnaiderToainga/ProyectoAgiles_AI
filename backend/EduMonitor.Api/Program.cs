using System.Text;
using EduMonitor.Api;
using EduMonitor.Infrastructure.Moodle;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// DbContext SQL Server Express
builder.Services.AddDbContext<EduMonitorDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddDbContext<AcademicoDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("AcademicoConnection")));

// Servicios de Catálogo y Sincronización Moodle
builder.Services.AddScoped<CatalogoService>();
builder.Services.AddScoped<MoodleSyncService>();

// Servicios de Estiven: Cálculo Ponderado e Inferencia IA
builder.Services.AddScoped<ICalculoPonderadoService, CalculoPonderadoService>();
builder.Services.AddHttpClient(IaInferenciaService.ClientName, client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddScoped<IIaInferenciaService, IaInferenciaService>();

builder.Services.AddExceptionHandler<AcademicExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddOptions<MoodleOptions>().BindConfiguration(MoodleOptions.Section)
    .Validate(o => Uri.TryCreate(o.BaseUrl, UriKind.Absolute, out var uri) && (uri.Scheme == "http" || uri.Scheme == "https"), "URL Moodle inválida")
    .Validate(o => o.TimeoutSeconds is >= 1 and <= 120 && o.MaxRetries is >= 0 and <= 3, "Límites Moodle inválidos")
    .ValidateOnStart();

builder.Services.AddHttpClient(MoodleService.ClientName, (sp, client) =>
{
    var o = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<MoodleOptions>>().Value;
    var baseUri = new Uri(o.BaseUrl.TrimEnd('/') + "/");
    client.BaseAddress = baseUri;
    if (baseUri.Host.Equals("host.docker.internal", StringComparison.OrdinalIgnoreCase))
        client.DefaultRequestHeaders.Host = baseUri.IsDefaultPort ? "localhost" : $"localhost:{baseUri.Port}";
    client.Timeout = TimeSpan.FromSeconds(o.TimeoutSeconds);
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });

builder.Services.AddScoped<IMoodleService, MoodleService>();

// Inyección de Servicios de Snaider
builder.Services.AddScoped<IPasswordHasher, PasswordHasher>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IIndicadoresService, IndicadoresService>();
builder.Services.AddScoped<GestionUsuariosService>();

// Autenticación JWT Bearer
var jwtKey = builder.Configuration["Jwt:Key"] ?? "EduMonitorAI_Secret_Key_FISEI_UTA_2026_SecureKey_MustBeLong!";
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

// CORS para React (Cesar)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddControllers();

var app = builder.Build();

// Migraciones automaticas opcionales (despliegue con Docker Compose)
if (builder.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<EduMonitorDbContext>().Database.Migrate();
    scope.ServiceProvider.GetRequiredService<AcademicoDbContext>().Database.Migrate();
}

// Inicializador de contraseñas reales con Salt PBKDF2
if (app.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("Development:ResetExamplePasswords"))
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<EduMonitorDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

    var proano = context.Usuarios.FirstOrDefault(u => u.Email == "d.proano@uta.edu.ec");
    if (proano != null && !hasher.VerifyPassword("Admin123!", proano.PasswordHash))
    {
        proano.PasswordHash = hasher.HashPassword("Admin123!");
        proano.Status = 1;
        proano.IntentosFallidos = 0;
    }

    var snaider = context.Usuarios.FirstOrDefault(u => u.Email == "s.toainga@uta.edu.ec");
    if (snaider != null && !hasher.VerifyPassword("Admin123!", snaider.PasswordHash))
    {
        snaider.PasswordHash = hasher.HashPassword("Admin123!");
        snaider.Status = 1;
        snaider.IntentosFallidos = 0;
    }

    context.SaveChanges();

    if (proano != null)
    {
        var academicContext = scope.ServiceProvider.GetRequiredService<AcademicoDbContext>();
        await AcademicoSeeder.Seed(academicContext, proano.Id, proano.NombreCompleto, proano.Email);
        var moodleDocenteId = builder.Configuration.GetValue<int?>("Development:MoodleDocenteId");
        if (moodleDocenteId is > 0)
        {
            var docente = await academicContext.Docentes.FirstOrDefaultAsync(d => d.UsuarioId == proano.Id);
            if (docente != null && docente.MoodleUserId is null)
            {
                docente.MoodleUserId = moodleDocenteId;
                await academicContext.SaveChangesAsync();
            }
        }
    }
}

app.UseExceptionHandler();
app.UseCors("AllowReactApp");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

public partial class Program { }