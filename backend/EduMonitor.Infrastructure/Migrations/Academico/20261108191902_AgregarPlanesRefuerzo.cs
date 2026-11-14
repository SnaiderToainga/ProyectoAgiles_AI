using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduMonitor.Infrastructure.Migrations.Academico
{
    /// <inheritdoc />
    public partial class AgregarPlanesRefuerzo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlanesRefuerzo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EstudianteId = table.Column<int>(type: "int", nullable: false),
                    CursoId = table.Column<int>(type: "int", nullable: false),
                    DiagnosticoGeneral = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    NivelRiesgo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    EsFallback = table.Column<bool>(type: "bit", nullable: false),
                    FechaGeneracion = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlanesRefuerzo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlanesRefuerzo_Cursos_CursoId",
                        column: x => x.CursoId,
                        principalTable: "Cursos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PlanesRefuerzo_Estudiantes_EstudianteId",
                        column: x => x.EstudianteId,
                        principalTable: "Estudiantes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DetallesPlanRefuerzo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PlanRefuerzoId = table.Column<int>(type: "int", nullable: false),
                    TemaId = table.Column<int>(type: "int", nullable: false),
                    ActividadSugerida = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Prioridad = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TiempoEstimadoHoras = table.Column<int>(type: "int", nullable: false),
                    RecursoRecomendado = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DetallesPlanRefuerzo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DetallesPlanRefuerzo_PlanesRefuerzo_PlanRefuerzoId",
                        column: x => x.PlanRefuerzoId,
                        principalTable: "PlanesRefuerzo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DetallesPlanRefuerzo_Temas_TemaId",
                        column: x => x.TemaId,
                        principalTable: "Temas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DetallesPlanRefuerzo_PlanRefuerzoId",
                table: "DetallesPlanRefuerzo",
                column: "PlanRefuerzoId");

            migrationBuilder.CreateIndex(
                name: "IX_DetallesPlanRefuerzo_TemaId",
                table: "DetallesPlanRefuerzo",
                column: "TemaId");

            migrationBuilder.CreateIndex(
                name: "IX_PlanesRefuerzo_CursoId",
                table: "PlanesRefuerzo",
                column: "CursoId");

            migrationBuilder.CreateIndex(
                name: "IX_PlanesRefuerzo_EstudianteId",
                table: "PlanesRefuerzo",
                column: "EstudianteId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DetallesPlanRefuerzo");

            migrationBuilder.DropTable(
                name: "PlanesRefuerzo");
        }
    }
}
