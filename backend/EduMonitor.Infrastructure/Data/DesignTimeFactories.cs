using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace EduMonitor.Infrastructure.Data;
// No ejecutan Program.cs ni inicializan cuentas al generar migraciones.
public sealed class AcademicoDesignFactory : IDesignTimeDbContextFactory<AcademicoDbContext>
{
    public AcademicoDbContext CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<AcademicoDbContext>()
        .UseSqlServer(Environment.GetEnvironmentVariable("ConnectionStrings__AcademicoConnection") ??
        "Server=(localdb)\\MSSQLLocalDB;Database=AcademicoDB_Cristian_Sprint1;Trusted_Connection=True;TrustServerCertificate=True").Options);
}
public sealed class AuthDesignFactory : IDesignTimeDbContextFactory<EduMonitorDbContext>
{
    public EduMonitorDbContext CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<EduMonitorDbContext>()
        .UseSqlServer(Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection") ??
        "Server=(localdb)\\MSSQLLocalDB;Database=EduMonitorAuth_Cristian_Sprint1;Trusted_Connection=True;TrustServerCertificate=True").Options);
}
