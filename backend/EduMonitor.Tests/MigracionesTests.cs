using EduMonitor.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace EduMonitor.Tests;

/// <summary>
/// La API aplica las migraciones al arrancar y EF Core aborta si el modelo tiene cambios sin migración.
/// Las pruebas con SQLite usan EnsureCreated y no lo detectan; esta prueba sí.
/// </summary>
public class MigracionesTests
{
    private const string ConexionFicticia = "Server=localhost;Database=Ficticia;Trusted_Connection=True;TrustServerCertificate=True";

    [Fact]
    public void AcademicoDb_NoTieneCambiosDeModeloSinMigracion()
    {
        using var db = new AcademicoDbContext(new DbContextOptionsBuilder<AcademicoDbContext>().UseSqlServer(ConexionFicticia).Options);
        Assert.False(db.Database.HasPendingModelChanges());
    }

    [Fact]
    public void EduMonitorDb_NoTieneCambiosDeModeloSinMigracion()
    {
        using var db = new EduMonitorDbContext(new DbContextOptionsBuilder<EduMonitorDbContext>().UseSqlServer(ConexionFicticia).Options);
        Assert.False(db.Database.HasPendingModelChanges());
    }
}
