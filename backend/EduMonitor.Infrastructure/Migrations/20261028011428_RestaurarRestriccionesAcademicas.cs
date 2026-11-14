using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduMonitor.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RestaurarRestriccionesAcademicas : Migration
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

            migrationBuilder.AlterColumn<int>(
                name: "CursoId",
                table: "LogsSincronizacion",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<int>(
                name: "DocenteId",
                table: "LogsSincronizacion",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Estado",
                table: "LogsSincronizacion",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Operacion",
                table: "LogsSincronizacion",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

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
                type: "decimal(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)");

            migrationBuilder.AddColumn<decimal>(
                name: "MaximoMoodle",
                table: "ItemsEvaluacion",
                type: "decimal(12,4)",
                precision: 12,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MinimoMoodle",
                table: "ItemsEvaluacion",
                type: "decimal(12,4)",
                precision: 12,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ParcialId",
                table: "ItemsEvaluacion",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Publicado",
                table: "ItemsEvaluacion",
                type: "bit",
                nullable: false,
                defaultValue: false);

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

            migrationBuilder.AddColumn<int>(
                name: "MoodleUserId",
                table: "Docentes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UsuarioId",
                table: "Docentes",
                type: "int",
                nullable: true);

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

            migrationBuilder.AddColumn<string>(
                name: "Codigo",
                table: "Cursos",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<decimal>(
                name: "Nota",
                table: "Calificaciones",
                type: "decimal(12,4)",
                precision: 12,
                scale: 4,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)",
                oldNullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "NotaMoodle",
                table: "Calificaciones",
                type: "decimal(12,4)",
                precision: 12,
                scale: 4,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Matriculas_EstudianteId_CursoId",
                table: "Matriculas",
                columns: new[] { "EstudianteId", "CursoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ItemsEvaluacion_CursoId_MoodleItemId",
                table: "ItemsEvaluacion",
                columns: new[] { "CursoId", "MoodleItemId" },
                unique: true,
                filter: "[MoodleItemId] > 0");

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
                name: "IX_Docentes_MoodleUserId",
                table: "Docentes",
                column: "MoodleUserId",
                unique: true,
                filter: "[MoodleUserId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Docentes_UsuarioId",
                table: "Docentes",
                column: "UsuarioId",
                unique: true,
                filter: "[UsuarioId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Cursos_Codigo",
                table: "Cursos",
                column: "Codigo",
                unique: true,
                filter: "[Codigo] <> ''");

            migrationBuilder.CreateIndex(
                name: "IX_Cursos_MoodleCourseId",
                table: "Cursos",
                column: "MoodleCourseId",
                unique: true,
                filter: "[MoodleCourseId] > 0");

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
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
                name: "IX_Docentes_MoodleUserId",
                table: "Docentes");

            migrationBuilder.DropIndex(
                name: "IX_Docentes_UsuarioId",
                table: "Docentes");

            migrationBuilder.DropIndex(
                name: "IX_Cursos_Codigo",
                table: "Cursos");

            migrationBuilder.DropIndex(
                name: "IX_Cursos_MoodleCourseId",
                table: "Cursos");

            migrationBuilder.DropIndex(
                name: "IX_Calificaciones_ItemEvaluacionId_EstudianteId",
                table: "Calificaciones");

            migrationBuilder.DropColumn(
                name: "DocenteId",
                table: "LogsSincronizacion");

            migrationBuilder.DropColumn(
                name: "Estado",
                table: "LogsSincronizacion");

            migrationBuilder.DropColumn(
                name: "Operacion",
                table: "LogsSincronizacion");

            migrationBuilder.DropColumn(
                name: "MaximoMoodle",
                table: "ItemsEvaluacion");

            migrationBuilder.DropColumn(
                name: "MinimoMoodle",
                table: "ItemsEvaluacion");

            migrationBuilder.DropColumn(
                name: "ParcialId",
                table: "ItemsEvaluacion");

            migrationBuilder.DropColumn(
                name: "Publicado",
                table: "ItemsEvaluacion");

            migrationBuilder.DropColumn(
                name: "MoodleUserId",
                table: "Docentes");

            migrationBuilder.DropColumn(
                name: "UsuarioId",
                table: "Docentes");

            migrationBuilder.DropColumn(
                name: "Codigo",
                table: "Cursos");

            migrationBuilder.DropColumn(
                name: "NotaMoodle",
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

            migrationBuilder.AlterColumn<int>(
                name: "CursoId",
                table: "LogsSincronizacion",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
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
                oldType: "decimal(12,4)",
                oldPrecision: 12,
                oldScale: 4);

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
                oldType: "decimal(12,4)",
                oldPrecision: 12,
                oldScale: 4,
                oldNullable: true);

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
    }
}
