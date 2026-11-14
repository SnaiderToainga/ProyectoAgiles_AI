using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace EduMonitor.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgregarAuthYAuditoria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Calificaciones_Estudiantes_EstudianteId",
                table: "Calificaciones");

            migrationBuilder.DropForeignKey(
                name: "FK_Cursos_Docentes_DocenteId",
                table: "Cursos");

            migrationBuilder.DropIndex(
                name: "IX_Matriculas_EstudianteId_CursoId",
                table: "Matriculas");

            migrationBuilder.DropIndex(
                name: "IX_ItemsEvaluacion_CursoId_MoodleItemId",
                table: "ItemsEvaluacion");

            migrationBuilder.DropIndex(
                name: "IX_Estudiantes_MoodleUserId",
                table: "Estudiantes");

            migrationBuilder.DropIndex(
                name: "IX_Docentes_Correo",
                table: "Docentes");

            migrationBuilder.DropIndex(
                name: "IX_Cursos_MoodleCourseId",
                table: "Cursos");

            migrationBuilder.DropIndex(
                name: "IX_Calificaciones_ItemEvaluacionId_EstudianteId",
                table: "Calificaciones");

            migrationBuilder.AlterColumn<string>(
                name: "MensajeError",
                table: "LogsSincronizacion",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(1000)",
                oldMaxLength: 1000,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Nombre",
                table: "ItemsEvaluacion",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<decimal>(
                name: "CalificacionMaxima",
                table: "ItemsEvaluacion",
                type: "decimal(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(5,2)",
                oldPrecision: 5,
                oldScale: 2);

            migrationBuilder.AlterColumn<string>(
                name: "Nombres",
                table: "Estudiantes",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "Correo",
                table: "Estudiantes",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(150)",
                oldMaxLength: 150);

            migrationBuilder.AlterColumn<string>(
                name: "Apellidos",
                table: "Estudiantes",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "Rol",
                table: "Docentes",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "Nombre",
                table: "Docentes",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(150)",
                oldMaxLength: 150);

            migrationBuilder.AlterColumn<string>(
                name: "Correo",
                table: "Docentes",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(150)",
                oldMaxLength: 150);

            migrationBuilder.AlterColumn<string>(
                name: "ClaveHash",
                table: "Docentes",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(256)",
                oldMaxLength: 256);

            migrationBuilder.AlterColumn<string>(
                name: "Periodo",
                table: "Cursos",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "Nombre",
                table: "Cursos",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<decimal>(
                name: "Nota",
                table: "Calificaciones",
                type: "decimal(18,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(5,2)",
                oldPrecision: 5,
                oldScale: 2,
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "LogsAcceso",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UsuarioId = table.Column<int>(type: "int", nullable: true),
                    EmailIntentado = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FechaRegistro = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Exitoso = table.Column<bool>(type: "bit", nullable: false),
                    Detalle = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    IpOrigen = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LogsAcceso", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Usuarios",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Username = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    NombreCompleto = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Rol = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    IntentosFallidos = table.Column<int>(type: "int", nullable: false),
                    FechaBloqueo = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Usuarios", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "Usuarios",
                columns: new[] { "Id", "Email", "FechaBloqueo", "IntentosFallidos", "NombreCompleto", "PasswordHash", "Rol", "Status", "Username" },
                values: new object[,]
                {
                    { 1, "d.proano@uta.edu.ec", null, 0, "Ing. Diego Proaño", "E4A5C1B2D3E4F5A6B7C8D9E0F1A2B3C4-1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1A2B", "Docente", 1, "dproano" },
                    { 2, "s.toainga@uta.edu.ec", null, 0, "Toainga Snaider Alexander", "E4A5C1B2D3E4F5A6B7C8D9E0F1A2B3C4-1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1A2B", "Administrador", 1, "stoainga" },
                    { 3, "prueba.bloqueo@uta.edu.ec", null, 3, "Usuario Prueba Bloqueado", "E4A5C1B2D3E4F5A6B7C8D9E0F1A2B3C4-1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1A2B", "Docente", 0, "pruebabloqueo" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Matriculas_EstudianteId",
                table: "Matriculas",
                column: "EstudianteId");

            migrationBuilder.CreateIndex(
                name: "IX_ItemsEvaluacion_CursoId",
                table: "ItemsEvaluacion",
                column: "CursoId");

            migrationBuilder.CreateIndex(
                name: "IX_Calificaciones_ItemEvaluacionId",
                table: "Calificaciones",
                column: "ItemEvaluacionId");

            migrationBuilder.CreateIndex(
                name: "IX_Usuarios_Email",
                table: "Usuarios",
                column: "Email",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Calificaciones_Estudiantes_EstudianteId",
                table: "Calificaciones",
                column: "EstudianteId",
                principalTable: "Estudiantes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Cursos_Docentes_DocenteId",
                table: "Cursos",
                column: "DocenteId",
                principalTable: "Docentes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Calificaciones_Estudiantes_EstudianteId",
                table: "Calificaciones");

            migrationBuilder.DropForeignKey(
                name: "FK_Cursos_Docentes_DocenteId",
                table: "Cursos");

            migrationBuilder.DropTable(
                name: "LogsAcceso");

            migrationBuilder.DropTable(
                name: "Usuarios");

            migrationBuilder.DropIndex(
                name: "IX_Matriculas_EstudianteId",
                table: "Matriculas");

            migrationBuilder.DropIndex(
                name: "IX_ItemsEvaluacion_CursoId",
                table: "ItemsEvaluacion");

            migrationBuilder.DropIndex(
                name: "IX_Calificaciones_ItemEvaluacionId",
                table: "Calificaciones");

            migrationBuilder.AlterColumn<string>(
                name: "MensajeError",
                table: "LogsSincronizacion",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Nombre",
                table: "ItemsEvaluacion",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<decimal>(
                name: "CalificacionMaxima",
                table: "ItemsEvaluacion",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)");

            migrationBuilder.AlterColumn<string>(
                name: "Nombres",
                table: "Estudiantes",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Correo",
                table: "Estudiantes",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Apellidos",
                table: "Estudiantes",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Rol",
                table: "Docentes",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Nombre",
                table: "Docentes",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Correo",
                table: "Docentes",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "ClaveHash",
                table: "Docentes",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Periodo",
                table: "Cursos",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Nombre",
                table: "Cursos",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<decimal>(
                name: "Nota",
                table: "Calificaciones",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Matriculas_EstudianteId_CursoId",
                table: "Matriculas",
                columns: new[] { "EstudianteId", "CursoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ItemsEvaluacion_CursoId_MoodleItemId",
                table: "ItemsEvaluacion",
                columns: new[] { "CursoId", "MoodleItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_Estudiantes_MoodleUserId",
                table: "Estudiantes",
                column: "MoodleUserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Docentes_Correo",
                table: "Docentes",
                column: "Correo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Cursos_MoodleCourseId",
                table: "Cursos",
                column: "MoodleCourseId");

            migrationBuilder.CreateIndex(
                name: "IX_Calificaciones_ItemEvaluacionId_EstudianteId",
                table: "Calificaciones",
                columns: new[] { "ItemEvaluacionId", "EstudianteId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Calificaciones_Estudiantes_EstudianteId",
                table: "Calificaciones",
                column: "EstudianteId",
                principalTable: "Estudiantes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Cursos_Docentes_DocenteId",
                table: "Cursos",
                column: "DocenteId",
                principalTable: "Docentes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
