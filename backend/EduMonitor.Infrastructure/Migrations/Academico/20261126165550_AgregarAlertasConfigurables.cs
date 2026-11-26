using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduMonitor.Infrastructure.Migrations.Academico
{
    /// <inheritdoc />
    public partial class AgregarAlertasConfigurables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Orden",
                table: "ItemsEvaluacion",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "ConfiguracionesAlertas",
                columns: table => new
                {
                    CursoId = table.Column<int>(type: "int", nullable: false),
                    RendimientoActivo = table.Column<bool>(type: "bit", nullable: false),
                    RendimientoUmbral = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    DescensoActivo = table.Column<bool>(type: "bit", nullable: false),
                    DescensoUltimas = table.Column<int>(type: "int", nullable: false),
                    DescensoPuntos = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    AtrasosActivo = table.Column<bool>(type: "bit", nullable: false),
                    AtrasosMinimo = table.Column<int>(type: "int", nullable: false),
                    FinalizacionActivo = table.Column<bool>(type: "bit", nullable: false),
                    FinalizacionMinimaPct = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    FechaActualizacion = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ActualizadoPorUsuarioId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConfiguracionesAlertas", x => x.CursoId);
                    table.ForeignKey(
                        name: "FK_ConfiguracionesAlertas_Cursos_CursoId",
                        column: x => x.CursoId,
                        principalTable: "Cursos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConfiguracionesAlertas");

            migrationBuilder.DropColumn(
                name: "Orden",
                table: "ItemsEvaluacion");
        }
    }
}
