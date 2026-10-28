using EduMonitor.Core.Entities;
using Microsoft.EntityFrameworkCore;
namespace EduMonitor.Infrastructure.Data;
internal static class AcademicModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        // Docente
        modelBuilder.Entity<Docente>(entity =>
        {
            entity.ToTable("Docentes");
            entity.HasKey(d => d.Id);
            entity.Property(d => d.Nombre).IsRequired().HasMaxLength(150);
            entity.Property(d => d.Correo).IsRequired().HasMaxLength(150);
            entity.HasIndex(d => d.Correo).IsUnique();
            entity.HasIndex(d => d.UsuarioId).IsUnique().HasFilter("[UsuarioId] IS NOT NULL");
            entity.HasIndex(d => d.MoodleUserId).IsUnique().HasFilter("[MoodleUserId] IS NOT NULL");
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
            entity.HasIndex(c => c.MoodleCourseId).IsUnique().HasFilter("[MoodleCourseId] > 0");
            entity.Property(c => c.Codigo).HasMaxLength(40);
            entity.HasIndex(c => c.Codigo).IsUnique().HasFilter("[Codigo] <> ''");

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
            entity.Property(i => i.CalificacionMaxima).HasPrecision(12, 4);
            entity.Property(i => i.Tipo).HasConversion<int>();
            entity.HasIndex(i => new { i.CursoId, i.MoodleItemId }).IsUnique().HasFilter("[MoodleItemId] > 0");
            entity.Property(i => i.MinimoMoodle).HasPrecision(12, 4);
            entity.Property(i => i.MaximoMoodle).HasPrecision(12, 4);

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
            entity.Property(c => c.Nota).IsRequired(false).HasPrecision(12, 4);
            entity.Property(c => c.NotaMoodle).HasPrecision(12, 4);
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
            entity.Property(l => l.Operacion).HasMaxLength(50);
            entity.Property(l => l.Estado).HasMaxLength(30);

            entity.HasOne(l => l.Curso)
                  .WithMany(c => c.LogsSincronizacion)
                  .HasForeignKey(l => l.CursoId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
