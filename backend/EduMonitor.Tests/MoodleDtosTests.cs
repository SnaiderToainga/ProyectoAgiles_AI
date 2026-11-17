using System.Text.Json;
using System.Text.Json.Serialization;
using EduMonitor.Core.DTOs;

namespace EduMonitor.Tests;

public class MoodleDtosTests
{
    private static readonly JsonSerializerOptions Json =
        new(JsonSerializerDefaults.Web)
        {
            NumberHandling = JsonNumberHandling.AllowReadingFromString
        };

    [Fact]
    public void LeeSeccionConModulo()
    {
        const string json = """
        [
          {
            "id": 10,
            "name": "Unidad 1",
            "section": 1,
            "modules": [
              {
                "id": 20,
                "name": "Tarea de Scrum",
                "modname": "assign",
                "instance": 30,
                "url": "http://localhost:8080/mod/assign/view.php?id=20"
              }
            ]
          }
        ]
        """;

        var secciones =
            JsonSerializer.Deserialize<List<MoodleSeccionDto>>(json, Json);

        Assert.NotNull(secciones);
        var seccion = Assert.Single(secciones);

        Assert.Equal(10, seccion.Id);
        Assert.Equal("Unidad 1", seccion.Name);
        Assert.Equal(1, seccion.Section);

        var modulo = Assert.Single(seccion.Modules);

        Assert.Equal(20, modulo.Id);
        Assert.Equal("Tarea de Scrum", modulo.Name);
        Assert.Equal("assign", modulo.Modname);
        Assert.Equal(30, modulo.Instance);
        Assert.Equal(
            "http://localhost:8080/mod/assign/view.php?id=20",
            modulo.Url);
    }

    [Fact]
    public void LeeSeccionSinModulos()
    {
        const string json = """
        {
          "id": 11,
          "name": "Unidad sin actividades",
          "section": 2,
          "modules": []
        }
        """;

        var seccion =
            JsonSerializer.Deserialize<MoodleSeccionDto>(json, Json);

        Assert.NotNull(seccion);
        Assert.Equal(11, seccion.Id);
        Assert.NotNull(seccion.Modules);
        Assert.Empty(seccion.Modules);
    }

    [Fact]
    public void LeeModuloSinUrl()
    {
        const string json = """
        {
          "id": 21,
          "name": "Recurso sin enlace",
          "modname": "label",
          "instance": 31
        }
        """;

        var modulo =
            JsonSerializer.Deserialize<MoodleModuloDto>(json, Json);

        Assert.NotNull(modulo);
        Assert.Equal(21, modulo.Id);
        Assert.Equal("label", modulo.Modname);
        Assert.Equal(31, modulo.Instance);
        Assert.Null(modulo.Url);
    }

    [Fact]
    public void LeeParticipanteConFotografia()
    {
        const string json = """
        {
          "id": 40,
          "firstname": "Estudiante",
          "lastname": "Prueba",
          "fullname": "Estudiante Prueba",
          "email": "estudiante@example.invalid",
          "roles": [
            { "shortname": "student" }
          ],
          "profileimageurl": "http://localhost:8080/imagen-prueba.png"
        }
        """;

        var participante =
            JsonSerializer.Deserialize<MoodleParticipanteDto>(json, Json);

        Assert.NotNull(participante);
        Assert.Equal(40, participante.Id);
        Assert.Equal("student", Assert.Single(participante.Roles).Shortname);
        Assert.Equal(
            "http://localhost:8080/imagen-prueba.png",
            participante.Profileimageurl);
    }

    [Fact]
    public void LeeParticipanteSinFotografia()
    {
        const string json = """
        {
          "id": 41,
          "firstname": "Otro",
          "lastname": "Estudiante",
          "fullname": "Otro Estudiante",
          "email": null,
          "roles": [
            { "shortname": "student" }
          ]
        }
        """;

        var participante =
            JsonSerializer.Deserialize<MoodleParticipanteDto>(json, Json);

        Assert.NotNull(participante);
        Assert.Equal(41, participante.Id);
        Assert.Null(participante.Email);
        Assert.Null(participante.Profileimageurl);
    }
}