using EduMonitor.Core.DTOs;
using EduMonitor.Core.DTOs.Academico;
using EduMonitor.Core.DTOs.Auth;
using EduMonitor.Core.Services;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Moodle;
using EduMonitor.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Tests;

/// <summary>Alta de cuentas con contraseña cifrada y enlace de docentes con Moodle.</summary>
public class GestionUsuariosTests : IAsyncLifetime
{
    private const string PasswordValida = "Docente#2026x";
    private readonly SqliteConnection authConexion = new("Data Source=:memory:");
    private readonly SqliteConnection academicoConexion = new("Data Source=:memory:");
    private EduMonitorDbContext auth = null!;
    private AcademicoDbContext academico = null!;
    private readonly MoodleFalso moodle = new();
    private readonly PasswordHasher hasher = new();
    private GestionUsuariosService servicio = null!;

    public async Task InitializeAsync()
    {
        await authConexion.OpenAsync();
        await academicoConexion.OpenAsync();
        auth = new(new DbContextOptionsBuilder<EduMonitorDbContext>().UseSqlite(authConexion).Options);
        academico = new(new DbContextOptionsBuilder<AcademicoDbContext>().UseSqlite(academicoConexion).Options);
        await auth.Database.EnsureCreatedAsync();
        await academico.Database.EnsureCreatedAsync();
        servicio = new(auth, academico, hasher, moodle);
    }

    public async Task DisposeAsync()
    {
        await auth.DisposeAsync(); await academico.DisposeAsync();
        await authConexion.DisposeAsync(); await academicoConexion.DisposeAsync();
    }

    private static CrearUsuarioRequest Docente(string email = "nuevo.docente@uta.edu.ec", int? moodle = null) =>
        new("Ing. Nuevo Docente", email, PasswordValida, "Docente", MoodleUserId: moodle);

    [Fact]
    public async Task CrearDocenteGuardaHashPbkdf2YRegistroAcademico()
    {
        var resultado = await servicio.Crear(Docente(), administradorId: 2);

        var usuario = await auth.Usuarios.SingleAsync(u => u.Id == resultado.Usuario.Id);
        Assert.NotEqual(PasswordValida, usuario.PasswordHash);
        Assert.True(hasher.VerifyPassword(PasswordValida, usuario.PasswordHash));
        Assert.Equal("nuevo.docente", usuario.Username);
        Assert.Equal("Docente", usuario.Rol);

        var docente = await academico.Docentes.SingleAsync(d => d.UsuarioId == usuario.Id);
        Assert.Equal("nuevo.docente@uta.edu.ec", docente.Correo);
        Assert.Null(docente.MoodleUserId);
        Assert.Contains(await auth.LogsAcceso.ToListAsync(), l => l.UsuarioId == usuario.Id && l.Detalle.Contains("#2"));
    }

    [Fact]
    public async Task CrearAdministradorNoCreaDocenteAcademico()
    {
        var resultado = await servicio.Crear(new("Admin Nuevo", "admin.nuevo@uta.edu.ec", PasswordValida, "administrador"), 2);
        Assert.Equal("Administrador", resultado.Usuario.Rol);
        Assert.False(await academico.Docentes.AnyAsync());
    }

    [Theory]
    [InlineData("corta1!A")]
    [InlineData("sinmayuscula1!")]
    [InlineData("SINMINUSCULA1!")]
    [InlineData("SinNumeroAqui!")]
    [InlineData("SinSimbolo123A")]
    public async Task ContrasenaDebilEs400(string password)
    {
        var ex = await Assert.ThrowsAsync<AcademicoException>(() =>
            servicio.Crear(new("Ing. Nuevo Docente", "nuevo.docente@uta.edu.ec", password, "Docente"), 2));
        Assert.Equal(400, ex.Status);
        Assert.False(await auth.Usuarios.AnyAsync(u => u.Email == "nuevo.docente@uta.edu.ec"));
    }

    [Theory]
    [InlineData("Ing. Ok", "no-es-correo", "Docente")]
    [InlineData("Ing. Ok", "ok@uta.edu.ec", "Estudiante")]
    [InlineData("A", "ok@uta.edu.ec", "Docente")]
    public async Task DatosInvalidosSon400(string nombre, string email, string rol)
    {
        var ex = await Assert.ThrowsAsync<AcademicoException>(() => servicio.Crear(new(nombre, email, PasswordValida, rol), 2));
        Assert.Equal(400, ex.Status);
    }

    [Fact]
    public async Task CorreoDuplicadoEs409SinImportarMayusculas()
    {
        await servicio.Crear(Docente(), 2);
        var ex = await Assert.ThrowsAsync<AcademicoException>(() => servicio.Crear(Docente("NUEVO.Docente@uta.edu.ec"), 2));
        Assert.Equal(409, ex.Status);
        Assert.Equal(1, await auth.Usuarios.CountAsync(u => u.Email == "nuevo.docente@uta.edu.ec"));
    }

    [Fact]
    public async Task CrearConMoodleVerificaCursosYGuardaEnlace()
    {
        moodle.CursosPorDocente[42] = [new(7, "Redes de Computadoras", "SOF-403")];
        moodle.Participantes[7] = [new(42, "Ana", "Pérez", "Ana Pérez", "ana@uta.edu.ec", [new("editingteacher")], null)];

        var resultado = await servicio.Crear(Docente(moodle: 42), 2);

        Assert.Equal(42, resultado.Usuario.MoodleUserId);
        Assert.Equal("Ana Pérez", resultado.Moodle!.NombreMoodle);
        Assert.Equal(["SOF-403 · Redes de Computadoras"], resultado.Moodle.CursosMoodle);
        Assert.Null(resultado.Moodle.Advertencia);
        Assert.Equal(42, (await academico.Docentes.SingleAsync()).MoodleUserId);
    }

    [Fact]
    public async Task MoodleNoDisponibleEs503YNoCreaNada()
    {
        moodle.Error = new MoodleException("moodle_network", "No se pudo establecer comunicación con Moodle.", 503);
        var ex = await Assert.ThrowsAsync<AcademicoException>(() => servicio.Crear(Docente(moodle: 42), 2));
        Assert.Equal(503, ex.Status);
        // EduMonitorDB trae cuentas semilla; se comprueba que no exista la cuenta nueva.
        Assert.False(await auth.Usuarios.AnyAsync(u => u.Email == "nuevo.docente@uta.edu.ec"));
        Assert.False(await academico.Docentes.AnyAsync());
    }

    [Fact]
    public async Task VincularSinCursosAdvierteYUsuarioMoodleNoSeRepite()
    {
        var a = await servicio.Crear(Docente("a.docente@uta.edu.ec"), 2);
        var b = await servicio.Crear(Docente("b.docente@uta.edu.ec"), 2);

        var vinculo = await servicio.VincularMoodle(a.Usuario.Id, 55, 2);
        Assert.Equal(55, vinculo.MoodleUserId);
        Assert.NotNull(vinculo.Advertencia);

        var ex = await Assert.ThrowsAsync<AcademicoException>(() => servicio.VincularMoodle(b.Usuario.Id, 55, 2));
        Assert.Equal(409, ex.Status);

        var listado = await servicio.Listar();
        Assert.Equal(55, listado.Single(u => u.Id == a.Usuario.Id).MoodleUserId);
        Assert.Null(listado.Single(u => u.Id == b.Usuario.Id).MoodleUserId);
    }

    [Fact]
    public async Task DesvincularYReglasDeRol()
    {
        var docente = await servicio.Crear(Docente(moodle: null), 2);
        await servicio.VincularMoodle(docente.Usuario.Id, 60, 2);
        var retiro = await servicio.VincularMoodle(docente.Usuario.Id, null, 2);
        Assert.Null(retiro.MoodleUserId);
        Assert.Null((await academico.Docentes.SingleAsync()).MoodleUserId);

        var admin = await servicio.Crear(new("Admin Dos", "admin.dos@uta.edu.ec", PasswordValida, "Administrador"), 2);
        Assert.Equal(400, (await Assert.ThrowsAsync<AcademicoException>(() => servicio.VincularMoodle(admin.Usuario.Id, 61, 2))).Status);
        Assert.Equal(404, (await Assert.ThrowsAsync<AcademicoException>(() => servicio.VincularMoodle(999, 61, 2))).Status);
        Assert.Equal(400, (await Assert.ThrowsAsync<AcademicoException>(() => servicio.VincularMoodle(docente.Usuario.Id, 0, 2))).Status);
    }

    [Fact]
    public async Task VincularDocenteSinRegistroAcademicoLoCrea()
    {
        // Cuentas Docente anteriores a este flujo pueden no tener registro en AcademicoDB.
        auth.Usuarios.Add(new() { Username = "legado", Email = "legado@uta.edu.ec", NombreCompleto = "Docente Legado",
            Rol = "Docente", PasswordHash = hasher.HashPassword(PasswordValida) });
        await auth.SaveChangesAsync();
        var id = (await auth.Usuarios.SingleAsync(u => u.Username == "legado")).Id;

        await servicio.VincularMoodle(id, 70, 2);

        var docente = await academico.Docentes.SingleAsync(d => d.UsuarioId == id);
        Assert.Equal(70, docente.MoodleUserId);
        Assert.Equal("legado@uta.edu.ec", docente.Correo);
    }

    private sealed class MoodleFalso : IMoodleService
    {
        public Dictionary<int, IReadOnlyList<MoodleCursoDto>> CursosPorDocente { get; } = [];
        public Dictionary<int, IReadOnlyList<MoodleParticipanteDto>> Participantes { get; } = [];
        public MoodleException? Error { get; set; }

        public Task<IReadOnlyList<MoodleCursoDto>> ObtenerCursosPorDocente(int docenteMoodleId, CancellationToken ct = default) =>
            Error is not null ? throw Error : Task.FromResult(CursosPorDocente.GetValueOrDefault(docenteMoodleId) ?? []);
        public Task<IReadOnlyList<MoodleParticipanteDto>> ObtenerParticipantes(int cursoMoodleId, CancellationToken ct = default) =>
            Task.FromResult(Participantes.GetValueOrDefault(cursoMoodleId) ?? []);
        public Task<MoodleCalificacionesDto> ObtenerCalificacionesPorCurso(int cursoMoodleId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<MoodleTareasDto> ObtenerTareas(int cursoMoodleId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<MoodleEstadoEntregaDto> ObtenerEstadoEntrega(int tareaId, int usuarioId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<MoodleSeccionDto>> ObtenerContenidoCurso(int cursoMoodleId, CancellationToken ct = default) => throw new NotSupportedException();
    }
}
