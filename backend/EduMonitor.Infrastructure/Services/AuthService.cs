using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EduMonitor.Core.DTOs.Auth;
using EduMonitor.Core.Entities.Auth;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace EduMonitor.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly EduMonitorDbContext _context;
    private readonly IPasswordHasher _hasher;
    private readonly IConfiguration _config;
    private const int MaxIntentosPermitidos = 3;

    public AuthService(EduMonitorDbContext context, IPasswordHasher hasher, IConfiguration config)
    {
        _context = context;
        _hasher = hasher;
        _config = config;
    }

    public async Task<LoginResponseDto> LoginAsync(LoginRequestDto request, string ipOrigen)
    {
        var log = new LogAcceso
        {
            EmailIntentado = request.Email,
            FechaRegistro = DateTime.UtcNow,
            IpOrigen = ipOrigen
        };

        var usuario = await _context.Usuarios
            .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());

        // Escenario 1: El correo no existe
        if (usuario == null)
        {
            log.Exitoso = false;
            log.Detalle = "Fallo de autenticación: Usuario inexistente";
            _context.LogsAcceso.Add(log);
            await _context.SaveChangesAsync();

            return new LoginResponseDto(
                Exitoso: false,
                Mensaje: "Credenciales institucionales incorrectas.",
                Token: null,
                IntentosRestantes: null,
                CuentaBloqueada: false,
                Usuario: null
            );
        }

        log.UsuarioId = usuario.Id;

        // Escenario 2: La cuenta ya está bloqueada (Status = 0)
        if (usuario.Status == 0)
        {
            log.Exitoso = false;
            log.Detalle = "Acceso denegado: Cuenta bloqueada tras 3 fallos consecutivos";
            _context.LogsAcceso.Add(log);
            await _context.SaveChangesAsync();

            return new LoginResponseDto(
                Exitoso: false,
                Mensaje: "Cuenta bloqueada temporalmente. Ha superado los 3 intentos fallidos consecutivos. Comuníquese con soporte o solicite desbloqueo.",
                Token: null,
                IntentosRestantes: 0,
                CuentaBloqueada: true,
                Usuario: null
            );
        }

        // Escenario 3: Validar contraseña
        bool esValida = _hasher.VerifyPassword(request.Password, usuario.PasswordHash);

        if (!esValida)
        {
            usuario.IntentosFallidos++;

            if (usuario.IntentosFallidos >= MaxIntentosPermitidos)
            {
                // Regla CA-01.2: Bloqueo automático al 3er fallo consecutivo
                usuario.Status = 0;
                usuario.FechaBloqueo = DateTime.UtcNow;

                log.Exitoso = false;
                log.Detalle = "Tercer fallo consecutivo de contraseña. Cuenta bloqueada automáticamente (Status = 0).";
                _context.LogsAcceso.Add(log);
                await _context.SaveChangesAsync();

                return new LoginResponseDto(
                    Exitoso: false,
                    Mensaje: "Cuenta bloqueada temporalmente. Ha superado los 3 intentos fallidos consecutivos.",
                    Token: null,
                    IntentosRestantes: 0,
                    CuentaBloqueada: true,
                    Usuario: null
                );
            }
            else
            {
                int restantes = MaxIntentosPermitidos - usuario.IntentosFallidos;
                log.Exitoso = false;
                log.Detalle = $"Contraseña incorrecta. Intento fallido {usuario.IntentosFallidos} de {MaxIntentosPermitidos}.";
                _context.LogsAcceso.Add(log);
                await _context.SaveChangesAsync();

                return new LoginResponseDto(
                    Exitoso: false,
                    Mensaje: $"Contraseña incorrecta. Le quedan {restantes} intento(s) antes del bloqueo institucional.",
                    Token: null,
                    IntentosRestantes: restantes,
                    CuentaBloqueada: false,
                    Usuario: null
                );
            }
        }

        // Escenario 4: Autenticación Exitosa (CA-01.1)
        usuario.IntentosFallidos = 0; // Reinicio de fallos
        log.Exitoso = true;
        log.Detalle = "Autenticación exitosa y emisión de token JWT";
        _context.LogsAcceso.Add(log);
        await _context.SaveChangesAsync();

        string token = GenerarTokenJwt(usuario);

        return new LoginResponseDto(
            Exitoso: true,
            Mensaje: "Inicio de sesión exitoso.",
            Token: token,
            IntentosRestantes: MaxIntentosPermitidos,
            CuentaBloqueada: false,
            Usuario: new UsuarioInfoDto(usuario.Id, usuario.NombreCompleto, usuario.Email, usuario.Rol)
        );
    }

    public async Task<bool> DesbloquearCuentaAsync(int usuarioId)
    {
        var usuario = await _context.Usuarios.FindAsync(usuarioId);
        if (usuario == null) return false;

        usuario.Status = 1;
        usuario.IntentosFallidos = 0;
        usuario.FechaBloqueo = null;

        _context.LogsAcceso.Add(new LogAcceso
        {
            UsuarioId = usuario.Id,
            EmailIntentado = usuario.Email,
            Exitoso = true,
            Detalle = "Cuenta desbloqueada manualmente por el Administrador",
            FechaRegistro = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<LogAcceso>> ObtenerAuditoriaAsync()
    {
        return await _context.LogsAcceso
            .OrderByDescending(l => l.FechaRegistro)
            .Take(100)
            .ToListAsync();
    }

    private string GenerarTokenJwt(Usuario usuario)
    {
        var secretKey = _config["Jwt:Key"] ?? "EduMonitorAI_Secret_Key_FISEI_UTA_2026_SecureKey_MustBeLong!";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
            new Claim(ClaimTypes.Name, usuario.NombreCompleto),
            new Claim(ClaimTypes.Email, usuario.Email),
            new Claim(ClaimTypes.Role, usuario.Rol)
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "EduMonitorApi",
            audience: _config["Jwt:Audience"] ?? "EduMonitorClient",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(4),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
