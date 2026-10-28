using EduMonitor.Core.Entities;
using EduMonitor.Core.Entities.Auth;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Infrastructure.Data;

public class EduMonitorDbContext : DbContext
{
    public EduMonitorDbContext(DbContextOptions<EduMonitorDbContext> options) : base(options)
    {
    }

    public DbSet<Docente> Docentes => Set<Docente>();
    public DbSet<Curso> Cursos => Set<Curso>();
    public DbSet<Estudiante> Estudiantes => Set<Estudiante>();
    public DbSet<Matricula> Matriculas => Set<Matricula>();
    public DbSet<ItemEvaluacion> ItemsEvaluacion => Set<ItemEvaluacion>();
    public DbSet<Calificacion> Calificaciones => Set<Calificacion>();
    public DbSet<LogSincronizacion> LogsSincronizacion => Set<LogSincronizacion>();

    // Tablas de Seguridad y Auditoría (AuthDB)
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<LogAcceso> LogsAcceso => Set<LogAcceso>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        AcademicModelConfiguration.Configure(modelBuilder);

        // Mapeo Usuarios
        modelBuilder.Entity<Usuario>(entity =>
        {
            entity.ToTable("Usuarios");
            entity.HasKey(u => u.Id);
            entity.Property(u => u.Email).IsRequired().HasMaxLength(150);
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Username).IsRequired().HasMaxLength(100);
            entity.Property(u => u.NombreCompleto).IsRequired().HasMaxLength(150);
            entity.Property(u => u.Rol).IsRequired().HasMaxLength(50);
        });

        // Mapeo LogsAcceso
        modelBuilder.Entity<LogAcceso>(entity =>
        {
            entity.ToTable("LogsAcceso");
            entity.HasKey(l => l.Id);
            entity.Property(l => l.Detalle).HasMaxLength(500);
            entity.Property(l => l.IpOrigen).HasMaxLength(50);
        });

        // Datos Semilla oficiales de la FISEI (Password por defecto: Admin123!)
        string defaultHash = "E4A5C1B2D3E4F5A6B7C8D9E0F1A2B3C4-1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1A2B";

        modelBuilder.Entity<Usuario>().HasData(
            new Usuario
            {
                Id = 1,
                Username = "dproano",
                Email = "d.proano@uta.edu.ec",
                NombreCompleto = "Ing. Diego Proaño",
                PasswordHash = defaultHash,
                Rol = "Docente",
                Status = 1,
                IntentosFallidos = 0
            },
            new Usuario
            {
                Id = 2,
                Username = "stoainga",
                Email = "s.toainga@uta.edu.ec",
                NombreCompleto = "Toainga Snaider Alexander",
                PasswordHash = defaultHash,
                Rol = "Administrador",
                Status = 1,
                IntentosFallidos = 0
            },
            new Usuario
            {
                Id = 3,
                Username = "pruebabloqueo",
                Email = "prueba.bloqueo@uta.edu.ec",
                NombreCompleto = "Usuario Prueba Bloqueado",
                PasswordHash = defaultHash,
                Rol = "Docente",
                Status = 0, // Inicia bloqueado para demostrar CA-01.3
                IntentosFallidos = 3
            }
        );
    }
}
