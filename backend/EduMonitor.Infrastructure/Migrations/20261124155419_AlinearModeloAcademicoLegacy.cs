using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduMonitor.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AlinearModeloAcademicoLegacy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MoodleModuleId",
                table: "ItemsEvaluacion",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FotoUrl",
                table: "Estudiantes",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MoodleModuleId",
                table: "ItemsEvaluacion");

            migrationBuilder.DropColumn(
                name: "FotoUrl",
                table: "Estudiantes");
        }
    }
}
