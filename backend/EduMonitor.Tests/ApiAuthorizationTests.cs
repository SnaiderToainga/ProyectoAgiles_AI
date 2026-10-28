using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using EduMonitor.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;

namespace EduMonitor.Tests;
public class ApiAuthorizationTests
{
    private sealed class Factory : WebApplicationFactory<Program>
    {
        public const string Key="SyntheticTestKeyOnly_NotForDeployment_0123456789";
        private readonly SqliteConnection db=new("Data Source=:memory:");
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            db.Open();builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration((_,c)=>c.AddInMemoryCollection(new Dictionary<string,string?>{
                ["Jwt:Key"]=Key,["Jwt:Issuer"]="EduMonitorApi",["Jwt:Audience"]="EduMonitorClient"}));
            builder.ConfigureServices(s=>{
                s.PostConfigure<Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerOptions>("Bearer",o=>{
                    o.TokenValidationParameters.IssuerSigningKey=new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Key));
                    o.TokenValidationParameters.ValidIssuer="EduMonitorApi";
                    o.TokenValidationParameters.ValidAudience="EduMonitorClient";
                });
                s.RemoveAll<DbContextOptions<AcademicoDbContext>>();
                s.RemoveAll<IDbContextOptionsConfiguration<AcademicoDbContext>>();
                s.AddDbContext<AcademicoDbContext>(o=>o.UseSqlite(db));
            });
        }
        protected override void Dispose(bool disposing){base.Dispose(disposing);if(disposing)db.Dispose();}
    }
    [Theory]
    [InlineData("/api/academico/materias")]
    [InlineData("/api/auth/auditoria")]
    public async Task SinJwtEs401(string path)
    {using var f=new Factory();using var c=f.CreateClient();Assert.Equal(HttpStatusCode.Unauthorized,(await c.GetAsync(path)).StatusCode);}
    [Fact] public async Task SyncSinJwtEs401()
    {using var f=new Factory();using var c=f.CreateClient();Assert.Equal(HttpStatusCode.Unauthorized,(await c.PostAsync("/api/moodle/sync-cursos",null)).StatusCode);}
    [Fact] public async Task JwtRealDistingueRolYDocenteVinculado()
    {
        using var f=new Factory();using var c=f.CreateClient();
        using(var scope=f.Services.CreateScope())
        {var db=scope.ServiceProvider.GetRequiredService<AcademicoDbContext>();await db.Database.EnsureCreatedAsync();await AcademicoSeeder.Seed(db,77,"Docente","docente@example.invalid");}
        c.DefaultRequestHeaders.Authorization=new("Bearer",Token("Estudiante",77));
        Assert.Equal(HttpStatusCode.Forbidden,(await c.GetAsync("/api/academico/materias")).StatusCode);
        c.DefaultRequestHeaders.Authorization=new("Bearer",Token("Docente",88));
        Assert.Equal(HttpStatusCode.Forbidden,(await c.GetAsync("/api/academico/materias")).StatusCode);
        c.DefaultRequestHeaders.Authorization=new("Bearer",Token("Docente",77));
        Assert.Equal(HttpStatusCode.OK,(await c.GetAsync("/api/academico/materias")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await c.GetAsync("/api/auth/auditoria")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/academico/evaluaciones",new{parcialId=1,nombre="Sin temas",tipo=1,temaIds=Array.Empty<int>()})).StatusCode);
    }
    private static string Token(string role,int user)=>new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
        "EduMonitorApi","EduMonitorClient",[new(ClaimTypes.NameIdentifier,user.ToString()),new(ClaimTypes.Role,role)],
        expires:DateTime.UtcNow.AddMinutes(5),signingCredentials:new(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Factory.Key)),SecurityAlgorithms.HmacSha256)));
}
