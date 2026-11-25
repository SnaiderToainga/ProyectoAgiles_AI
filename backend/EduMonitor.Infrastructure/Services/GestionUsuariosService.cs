using System.Net.Mail;
using System.Text.RegularExpressions;
using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.DTOs.Auth;
using EduMonitor.Core.Entities;
using EduMonitor.Core.Entities.Auth;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Moodle;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Infrastructure.Services;

/// <summary>
/// Administración de cuentas: alta de usuarios con contraseña cifrada (PBKDF2) y enlace de docentes
/// con su usuario de Moodle. Las cuentas viven en EduMonitorDB y el docente en AcademicoDB.
/// </summary>
public sealed partial class GestionUsuariosService(
    EduMonitorDbContext auth,
    AcademicoDbContext academico,
    IPasswordHasher hasher,
    IMoodleService moodle)
{
    public const string RolDocente = "Docente";
    public const string RolAdministrador = "Administrador";
    private const int LongitudMinimaPassword = 10;

    public async Task<List<UsuarioAdminDto>> Listar(CancellationToken ct = default)
    {
        var usuarios = await auth.Usuarios.AsNoTracking().OrderBy(u => u.Id).ToListAsync(ct);
        var enlaces = await academico.Docentes.AsNoTracking()
            .Where(d => d.UsuarioId != null)
            .ToDictionaryAsync(d => d.UsuarioId!.Value, d => d.MoodleUserId, ct);
        return usuarios.Select(u => ADto(u, enlaces.GetValueOrDefault(u.Id))).ToList();
    }

    public async Task<CrearUsuarioResponse> Crear(CrearUsuarioRequest request, int administradorId, CancellationToken ct = default)
    {
        var nombre = (request.NombreCompleto ?? "").Trim();
        var email = (request.Email ?? "").Trim().ToLowerInvariant();
        var rol = NormalizarRol(request.Rol);
        var username = string.IsNullOrWhiteSpace(request.Username) ? email.Split('@')[0] : request.Username.Trim();

        if (nombre.Length is < 3 or > 150) throw new AcademicoException(400, "El nombre debe tener entre 3 y 150 caracteres.");
        if (!EmailValido(email)) throw new AcademicoException(400, "El correo institucional no es válido.");
        if (username.Length is < 3 or > 100 || !UsernameRegex().IsMatch(username))
            throw new AcademicoException(400, "El usuario debe tener entre 3 y 100 caracteres (letras, números, punto, guion o guion bajo).");
        ValidarPassword(request.Password, email);
        if (request.MoodleUserId is not null && rol != RolDocente)
            throw new AcademicoException(400, "Solo las cuentas con rol Docente se enlazan con Moodle.");

        if (await auth.Usuarios.AnyAsync(u => u.Email.ToLower() == email, ct))
            throw new AcademicoException(409, "Ya existe una cuenta con ese correo.");
        if (await auth.Usuarios.AnyAsync(u => u.Username.ToLower() == username.ToLower(), ct))
            throw new AcademicoException(409, "Ya existe una cuenta con ese nombre de usuario.");
        if (rol == RolDocente && await academico.Docentes.AnyAsync(d => d.Correo.ToLower() == email, ct))
            throw new AcademicoException(409, "Ya existe un docente académico con ese correo.");

        // Se verifica en Moodle antes de escribir nada, para no dejar cuentas a medio crear.
        VinculoMoodleDto? vinculo = null;
        if (request.MoodleUserId is int moodleUserId)
        {
            await ComprobarMoodleLibre(moodleUserId, docenteId: null, ct);
            vinculo = await VerificarEnMoodle(0, moodleUserId, ct);
        }

        var usuario = new Usuario
        {
            Username = username,
            Email = email,
            NombreCompleto = nombre,
            Rol = rol,
            PasswordHash = hasher.HashPassword(request.Password),
            Status = 1,
            IntentosFallidos = 0,
        };
        auth.Usuarios.Add(usuario);
        await auth.SaveChangesAsync(ct);

        if (rol == RolDocente)
        {
            try
            {
                academico.Docentes.Add(new Docente
                {
                    UsuarioId = usuario.Id,
                    Nombre = nombre,
                    Correo = email,
                    ClaveHash = "EXTERNAL_AUTH_NO_LOCAL_LOGIN",
                    Rol = RolDocente,
                    MoodleUserId = request.MoodleUserId,
                });
                await academico.SaveChangesAsync(ct);
            }
            catch
            {
                // Son dos bases distintas: si falla el registro académico se deshace la cuenta creada.
                auth.Usuarios.Remove(usuario);
                await auth.SaveChangesAsync(CancellationToken.None);
                throw new AcademicoException(409, "No se pudo registrar el docente académico; no se creó la cuenta.");
            }
        }

        auth.LogsAcceso.Add(new LogAcceso
        {
            UsuarioId = usuario.Id,
            EmailIntentado = email,
            Exitoso = true,
            Detalle = $"Cuenta {rol} creada por el administrador #{administradorId}.",
            FechaRegistro = DateTime.UtcNow,
        });
        await auth.SaveChangesAsync(ct);

        return new CrearUsuarioResponse(ADto(usuario, request.MoodleUserId), vinculo is null ? null : vinculo with { UsuarioId = usuario.Id });
    }

    public async Task<VinculoMoodleDto> VincularMoodle(int usuarioId, int? moodleUserId, int administradorId, CancellationToken ct = default)
    {
        var usuario = await auth.Usuarios.SingleOrDefaultAsync(u => u.Id == usuarioId, ct)
            ?? throw new AcademicoException(404, "Usuario no encontrado.");
        if (usuario.Rol != RolDocente) throw new AcademicoException(400, "Solo las cuentas con rol Docente se enlazan con Moodle.");
        if (moodleUserId is <= 0) throw new AcademicoException(400, "El ID de usuario de Moodle debe ser un número positivo.");

        var docente = await academico.Docentes.SingleOrDefaultAsync(d => d.UsuarioId == usuarioId, ct);
        if (docente is null)
        {
            if (await academico.Docentes.AnyAsync(d => d.Correo.ToLower() == usuario.Email.ToLower(), ct))
                throw new AcademicoException(409, "Ya existe un docente académico con ese correo y otra cuenta.");
            docente = new Docente
            {
                UsuarioId = usuario.Id, Nombre = usuario.NombreCompleto, Correo = usuario.Email,
                ClaveHash = "EXTERNAL_AUTH_NO_LOCAL_LOGIN", Rol = RolDocente,
            };
            academico.Docentes.Add(docente);
        }

        VinculoMoodleDto resultado;
        if (moodleUserId is int nuevo)
        {
            await ComprobarMoodleLibre(nuevo, docente.Id == 0 ? null : docente.Id, ct);
            resultado = await VerificarEnMoodle(usuarioId, nuevo, ct);
        }
        else
        {
            resultado = new VinculoMoodleDto(usuarioId, null, null, [], "Cuenta desenlazada de Moodle: ya no podrá sincronizar sus cursos.");
        }

        docente.MoodleUserId = moodleUserId;
        await academico.SaveChangesAsync(ct);

        auth.LogsAcceso.Add(new LogAcceso
        {
            UsuarioId = usuario.Id,
            EmailIntentado = usuario.Email,
            Exitoso = true,
            Detalle = moodleUserId is null
                ? $"Enlace con Moodle retirado por el administrador #{administradorId}."
                : $"Enlazado con el usuario {moodleUserId} de Moodle por el administrador #{administradorId}.",
            FechaRegistro = DateTime.UtcNow,
        });
        await auth.SaveChangesAsync(ct);
        return resultado;
    }

    private async Task ComprobarMoodleLibre(int moodleUserId, int? docenteId, CancellationToken ct)
    {
        if (moodleUserId <= 0) throw new AcademicoException(400, "El ID de usuario de Moodle debe ser un número positivo.");
        if (await academico.Docentes.AnyAsync(d => d.MoodleUserId == moodleUserId && d.Id != docenteId, ct))
            throw new AcademicoException(409, "Ese usuario de Moodle ya está enlazado con otra cuenta.");
    }

    /// <summary>Consulta con la cuenta de servicio en qué cursos del período es docente el usuario de Moodle.</summary>
    private async Task<VinculoMoodleDto> VerificarEnMoodle(int usuarioId, int moodleUserId, CancellationToken ct)
    {
        IReadOnlyList<Core.DTOs.MoodleCursoDto> cursos;
        string? nombre = null;
        try
        {
            cursos = await moodle.ObtenerCursosPorDocente(moodleUserId, ct);
            if (cursos.Count > 0)
            {
                var participante = (await moodle.ObtenerParticipantes(cursos[0].Id, ct)).FirstOrDefault(p => p.Id == moodleUserId);
                nombre = participante is null ? null : $"{participante.Firstname} {participante.Lastname}".Trim();
            }
        }
        catch (MoodleException ex)
        {
            throw new AcademicoException(503, $"No se pudo verificar el usuario en Moodle: {ex.Message}");
        }

        var advertencia = cursos.Count == 0
            ? "Moodle no muestra cursos del período donde este usuario sea profesor. Matricúlelo con rol Profesor y sincronice."
            : null;
        return new VinculoMoodleDto(usuarioId, moodleUserId, nombre, cursos.Select(c => $"{c.Shortname} · {c.Fullname}").ToList(), advertencia);
    }

    private static string NormalizarRol(string? rol) => (rol ?? "").Trim().ToLowerInvariant() switch
    {
        "docente" => RolDocente,
        "administrador" => RolAdministrador,
        _ => throw new AcademicoException(400, "El rol debe ser Docente o Administrador."),
    };

    private static void ValidarPassword(string? password, string email)
    {
        if (string.IsNullOrEmpty(password) || password.Length < LongitudMinimaPassword
            || !password.Any(char.IsUpper) || !password.Any(char.IsLower)
            || !password.Any(char.IsDigit) || password.All(char.IsLetterOrDigit))
            throw new AcademicoException(400,
                $"La contraseña debe tener al menos {LongitudMinimaPassword} caracteres, con mayúscula, minúscula, número y símbolo.");
        if (password.Contains(email.Split('@')[0], StringComparison.OrdinalIgnoreCase))
            throw new AcademicoException(400, "La contraseña no puede contener el nombre del correo.");
    }

    private static bool EmailValido(string email)
    {
        if (email.Length is < 6 or > 150) return false;
        try { return new MailAddress(email).Address == email; }
        catch (FormatException) { return false; }
    }

    private static UsuarioAdminDto ADto(Usuario u, int? moodleUserId) =>
        new(u.Id, u.Username, u.Email, u.NombreCompleto, u.Rol, u.Status, u.IntentosFallidos, u.FechaBloqueo, moodleUserId);

    [GeneratedRegex(@"^[A-Za-z0-9._-]+$")]
    private static partial Regex UsernameRegex();
}
