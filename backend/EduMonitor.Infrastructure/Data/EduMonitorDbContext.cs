using EduMonitor.Core.Entities;
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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Docente
        modelBuilder.Entity<Docente>(entity =>
        {
            entity.ToTable("Docentes");
            entity.HasKey(d => d.Id);
            entity.Property(d => d.Nombre).IsRequired().HasMaxLength(150);
            entity.Property(d => d.Correo).IsRequired().HasMaxLength(150);
            entity.HasIndex(d => d.Correo).IsUnique();
            entity.Property(d => d.ClaveHash).IsRequired().HasMaxLength(256);
            entity.Property(d => d.Rol).IsRequired().HasMaxLength(50);
        });

        // Curso
        modelBuilder.Entity<Curso>(entity =>
        {
            entity.ToTable("Cursos");
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Nombre).IsRequired().HasMaxLength(200);
            entity.Property(c => c.Periodo).IsRequired().HasMaxLength(50);
            entity.HasIndex(c => c.MoodleCourseId);

            entity.HasOne(c => c.Docente)
                  .WithMany(d => d.Cursos)
                  .HasForeignKey(c => c.DocenteId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Estudiante
        modelBuilder.Entity<Estudiante>(entity =>
        {
            entity.ToTable("Estudiantes");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Nombres).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Apellidos).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Correo).IsRequired().HasMaxLength(150);
            entity.HasIndex(e => e.MoodleUserId).IsUnique();
        });

        // Matricula
        modelBuilder.Entity<Matricula>(entity =>
        {
            entity.ToTable("Matriculas");
            entity.HasKey(m => m.Id);
            entity.HasIndex(m => new { m.EstudianteId, m.CursoId }).IsUnique();

            entity.HasOne(m => m.Estudiante)
                  .WithMany(e => e.Matriculas)
                  .HasForeignKey(m => m.EstudianteId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(m => m.Curso)
                  .WithMany(c => c.Matriculas)
                  .HasForeignKey(m => m.CursoId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ItemEvaluacion
        modelBuilder.Entity<ItemEvaluacion>(entity =>
        {
            entity.ToTable("ItemsEvaluacion");
            entity.HasKey(i => i.Id);
            entity.Property(i => i.Nombre).IsRequired().HasMaxLength(200);
            entity.Property(i => i.CalificacionMaxima).HasPrecision(5, 2);
            entity.Property(i => i.Tipo).HasConversion<int>();
            entity.HasIndex(i => new { i.CursoId, i.MoodleItemId });

            entity.HasOne(i => i.Curso)
                  .WithMany(c => c.ItemsEvaluacion)
                  .HasForeignKey(i => i.CursoId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Calificacion (Nota nullable para distinguir SinEntrega de 0.0)
        modelBuilder.Entity<Calificacion>(entity =>
        {
            entity.ToTable("Calificaciones");
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Nota).IsRequired(false).HasPrecision(5, 2);
            entity.Property(c => c.Estado).HasConversion<int>().IsRequired();
            entity.HasIndex(c => new { c.ItemEvaluacionId, c.EstudianteId }).IsUnique();

            entity.HasOne(c => c.ItemEvaluacion)
                  .WithMany(i => i.Calificaciones)
                  .HasForeignKey(c => c.ItemEvaluacionId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(c => c.Estudiante)
                  .WithMany(e => e.Calificaciones)
                  .HasForeignKey(c => c.EstudianteId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // LogSincronizacion
        modelBuilder.Entity<LogSincronizacion>(entity =>
        {
            entity.ToTable("LogsSincronizacion");
            entity.HasKey(l => l.Id);
            entity.Property(l => l.MensajeError).HasMaxLength(1000);

            entity.HasOne(l => l.Curso)
                  .WithMany(c => c.LogsSincronizacion)
                  .HasForeignKey(l => l.CursoId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
