using EduMonitor.Core.Entities.Auth;
using EduMonitor.Infrastructure.Data;
using EduMonitor.Infrastructure.Services;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

var password=Environment.GetEnvironmentVariable("EDUMONITOR_DEMO_PASSWORD")
    ?? throw new InvalidOperationException("Defina EDUMONITOR_DEMO_PASSWORD (no se imprime ni versiona).");
if(password.Length<12)throw new InvalidOperationException("Contraseña de prueba de al menos 12 caracteres.");
var authString=Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
    ?? "Server=(localdb)\\MSSQLLocalDB;Database=EduMonitorAuth_Cristian_Sprint1;Trusted_Connection=True;TrustServerCertificate=True";
var academicString=Environment.GetEnvironmentVariable("ConnectionStrings__AcademicoConnection")
    ?? "Server=(localdb)\\MSSQLLocalDB;Database=AcademicoDB_Cristian_Sprint1;Trusted_Connection=True;TrustServerCertificate=True";
foreach(var (connection,name) in new[]{(authString,"EduMonitorAuth_Cristian_Sprint1"),(academicString,"AcademicoDB_Cristian_Sprint1")})
{
    var parsed=new SqlConnectionStringBuilder(connection);
    if(parsed.InitialCatalog!=name || !parsed.DataSource.Equals("(localdb)\\MSSQLLocalDB",StringComparison.OrdinalIgnoreCase))
        throw new InvalidOperationException("Este inicializador solo opera en las dos bases LocalDB de demostración.");
}
await using var auth=new EduMonitorDbContext(new DbContextOptionsBuilder<EduMonitorDbContext>().UseSqlServer(authString).Options);
await using var academic=new AcademicoDbContext(new DbContextOptionsBuilder<AcademicoDbContext>().UseSqlServer(academicString).Options);
if(args.Contains("--verify"))
{
    var counts = new[] {await academic.Cursos.CountAsync(), await academic.Estudiantes.CountAsync(), await academic.Matriculas.CountAsync(), await academic.ItemsEvaluacion.CountAsync(i=>i.MoodleItemId>0), await academic.Calificaciones.CountAsync(), await academic.Calificaciones.CountAsync(g=>g.Nota==0), await academic.Calificaciones.CountAsync(g=>g.Nota==8), await academic.Calificaciones.CountAsync(g=>g.Nota==null)};
    if(!counts.SequenceEqual(new[]{2,3,6,6,18,6,6,6}))throw new InvalidOperationException("Conteos piloto inesperados: " + string.Join(",",counts));
    if(await academic.Calificaciones.AnyAsync(g=>g.Nota==8 && g.NotaMoodle!=80))throw new InvalidOperationException("Conversión no trazable.");
    Console.WriteLine("SQL real verificado: 2 cursos, 3 estudiantes, 6 matrículas, 6 ítems Moodle, 18 notas (6 cero, 6 ocho, 6 null), sin duplicados.");
    return;
}
await auth.Database.MigrateAsync();await academic.Database.MigrateAsync();
const string email="docente.sprint1@example.invalid";
var user=await auth.Usuarios.SingleOrDefaultAsync(u=>u.Email==email);
if(user is null)
{
    user=new Usuario{Username="docente.sprint1",Email=email,NombreCompleto="Docente ficticio Sprint 1",Rol="Docente",PasswordHash=new PasswordHasher().HashPassword(password)};
    auth.Usuarios.Add(user);await auth.SaveChangesAsync();
}
await AcademicoSeeder.Seed(academic,user.Id,user.NombreCompleto,user.Email);
var moodleId=Environment.GetEnvironmentVariable("EDUMONITOR_MOODLE_DOCENTE_ID");
if(int.TryParse(moodleId,out var id) && id>0)
{
    var docente=await academic.Docentes.SingleAsync(d=>d.UsuarioId==user.Id);
    if(docente.MoodleUserId.HasValue && docente.MoodleUserId!=id)throw new InvalidOperationException("Existe otra vinculación Moodle; revisar manualmente.");
    docente.MoodleUserId=id;await academic.SaveChangesAsync();
}
Console.WriteLine($"Seeds verificados: Usuario.Id={user.Id}; materias={await academic.Cursos.CountAsync()}; parciales={await academic.Parciales.CountAsync()}; unidades={await academic.Unidades.CountAsync()}; temas={await academic.Temas.CountAsync()}.");
