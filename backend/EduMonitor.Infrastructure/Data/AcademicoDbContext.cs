using EduMonitor.Core.Entities;
using EduMonitor.Core.Entities.Academico;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Infrastructure.Data;

public class AcademicoDbContext(DbContextOptions<AcademicoDbContext> options) : DbContext(options)
{
    public DbSet<Docente> Docentes => Set<Docente>();
    public DbSet<Curso> Cursos => Set<Curso>();
    public DbSet<Estudiante> Estudiantes => Set<Estudiante>();
    public DbSet<Matricula> Matriculas => Set<Matricula>();
    public DbSet<ItemEvaluacion> ItemsEvaluacion => Set<ItemEvaluacion>();
    public DbSet<Calificacion> Calificaciones => Set<Calificacion>();
    public DbSet<LogSincronizacion> LogsSincronizacion => Set<LogSincronizacion>();
    public DbSet<Parcial> Parciales => Set<Parcial>();
    public DbSet<Unidad> Unidades => Set<Unidad>();
    public DbSet<Tema> Temas => Set<Tema>();
    public DbSet<EvaluacionTema> EvaluacionTemas => Set<EvaluacionTema>();
    public DbSet<PlanRefuerzo> PlanesRefuerzo => Set<PlanRefuerzo>();
    public DbSet<DetallePlanRefuerzo> DetallesPlanRefuerzo => Set<DetallePlanRefuerzo>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        AcademicModelConfiguration.Configure(model);
        model.Entity<Parcial>().HasIndex(p => new { p.CursoId, p.Numero }).IsUnique();
        model.Entity<Parcial>().HasOne(p => p.Curso).WithMany().OnDelete(DeleteBehavior.Restrict);
        model.Entity<Unidad>().HasIndex(u => new { u.ParcialId, u.Numero }).IsUnique();
        model.Entity<Unidad>().Property(u => u.Nombre).HasMaxLength(200);
        model.Entity<Tema>().Property(t => t.Nombre).HasMaxLength(200);
        model.Entity<Tema>().Property(t => t.Descripcion).HasMaxLength(1000);
        model.Entity<Tema>().HasIndex(t => new { t.UnidadId, t.Nombre }).IsUnique();
        model.Entity<EvaluacionTema>().HasKey(x => new { x.ItemEvaluacionId, x.TemaId });
        model.Entity<EvaluacionTema>().HasOne(x => x.Evaluacion).WithMany().HasForeignKey(x => x.ItemEvaluacionId).OnDelete(DeleteBehavior.Cascade);
        model.Entity<EvaluacionTema>().HasOne(x => x.Tema).WithMany().HasForeignKey(x => x.TemaId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<ItemEvaluacion>().HasOne<Parcial>().WithMany().HasForeignKey(i => i.ParcialId).OnDelete(DeleteBehavior.Restrict);

        model.Entity<PlanRefuerzo>(entity =>
        {
            entity.HasOne(p => p.Estudiante)
                .WithMany()
                .HasForeignKey(p => p.EstudianteId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(p => p.Curso)
                .WithMany()
                .HasForeignKey(p => p.CursoId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.Property(p => p.DiagnosticoGeneral).HasMaxLength(2000);
            entity.Property(p => p.NivelRiesgo).HasMaxLength(50);
        });

        model.Entity<DetallePlanRefuerzo>(entity =>
        {
            entity.HasOne(d => d.PlanRefuerzo)
                .WithMany(p => p.Detalles)
                .HasForeignKey(d => d.PlanRefuerzoId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(d => d.Tema)
                .WithMany()
                .HasForeignKey(d => d.TemaId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.Property(d => d.ActividadSugerida).HasMaxLength(1000);
            entity.Property(d => d.Prioridad).HasMaxLength(50);
            entity.Property(d => d.RecursoRecomendado).HasMaxLength(500);
        });
    }
}
