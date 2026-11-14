IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
CREATE TABLE [Docentes] (
    [Id] int NOT NULL IDENTITY,
    [UsuarioId] int NULL,
    [MoodleUserId] int NULL,
    [Nombre] nvarchar(150) NOT NULL,
    [Correo] nvarchar(150) NOT NULL,
    [ClaveHash] nvarchar(256) NOT NULL,
    [Rol] nvarchar(50) NOT NULL,
    [Activo] bit NOT NULL,
    CONSTRAINT [PK_Docentes] PRIMARY KEY ([Id])
);

CREATE TABLE [Estudiantes] (
    [Id] int NOT NULL IDENTITY,
    [MoodleUserId] int NOT NULL,
    [Nombres] nvarchar(100) NOT NULL,
    [Apellidos] nvarchar(100) NOT NULL,
    [Correo] nvarchar(150) NOT NULL,
    CONSTRAINT [PK_Estudiantes] PRIMARY KEY ([Id])
);

CREATE TABLE [Cursos] (
    [Id] int NOT NULL IDENTITY,
    [Codigo] nvarchar(40) NOT NULL,
    [MoodleCourseId] int NOT NULL,
    [Nombre] nvarchar(200) NOT NULL,
    [Periodo] nvarchar(50) NOT NULL,
    [DocenteId] int NOT NULL,
    CONSTRAINT [PK_Cursos] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Cursos_Docentes_DocenteId] FOREIGN KEY ([DocenteId]) REFERENCES [Docentes] ([Id]) ON DELETE NO ACTION
);

CREATE TABLE [LogsSincronizacion] (
    [Id] int NOT NULL IDENTITY,
    [CursoId] int NULL,
    [DocenteId] int NULL,
    [Operacion] nvarchar(50) NOT NULL,
    [Estado] nvarchar(30) NOT NULL,
    [Fecha] datetime2 NOT NULL,
    [TotalRegistros] int NOT NULL,
    [Exitoso] bit NOT NULL,
    [MensajeError] nvarchar(1000) NULL,
    CONSTRAINT [PK_LogsSincronizacion] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_LogsSincronizacion_Cursos_CursoId] FOREIGN KEY ([CursoId]) REFERENCES [Cursos] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [Matriculas] (
    [Id] int NOT NULL IDENTITY,
    [EstudianteId] int NOT NULL,
    [CursoId] int NOT NULL,
    [FechaMatricula] datetime2 NOT NULL,
    CONSTRAINT [PK_Matriculas] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Matriculas_Cursos_CursoId] FOREIGN KEY ([CursoId]) REFERENCES [Cursos] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Matriculas_Estudiantes_EstudianteId] FOREIGN KEY ([EstudianteId]) REFERENCES [Estudiantes] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [Parciales] (
    [Id] int NOT NULL IDENTITY,
    [CursoId] int NOT NULL,
    [Numero] int NOT NULL,
    CONSTRAINT [PK_Parciales] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Parciales_Cursos_CursoId] FOREIGN KEY ([CursoId]) REFERENCES [Cursos] ([Id]) ON DELETE NO ACTION
);

CREATE TABLE [ItemsEvaluacion] (
    [Id] int NOT NULL IDENTITY,
    [ParcialId] int NULL,
    [Publicado] bit NOT NULL,
    [MinimoMoodle] decimal(12,4) NULL,
    [MaximoMoodle] decimal(12,4) NULL,
    [CursoId] int NOT NULL,
    [MoodleItemId] int NOT NULL,
    [Nombre] nvarchar(200) NOT NULL,
    [Tipo] int NOT NULL,
    [CalificacionMaxima] decimal(12,4) NOT NULL,
    CONSTRAINT [PK_ItemsEvaluacion] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_ItemsEvaluacion_Cursos_CursoId] FOREIGN KEY ([CursoId]) REFERENCES [Cursos] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_ItemsEvaluacion_Parciales_ParcialId] FOREIGN KEY ([ParcialId]) REFERENCES [Parciales] ([Id]) ON DELETE NO ACTION
);

CREATE TABLE [Unidades] (
    [Id] int NOT NULL IDENTITY,
    [ParcialId] int NOT NULL,
    [Numero] int NOT NULL,
    [Nombre] nvarchar(200) NOT NULL,
    CONSTRAINT [PK_Unidades] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Unidades_Parciales_ParcialId] FOREIGN KEY ([ParcialId]) REFERENCES [Parciales] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [Calificaciones] (
    [Id] int NOT NULL IDENTITY,
    [ItemEvaluacionId] int NOT NULL,
    [EstudianteId] int NOT NULL,
    [Nota] decimal(12,4) NULL,
    [NotaMoodle] decimal(12,4) NULL,
    [Estado] int NOT NULL,
    [FechaEntrega] datetime2 NULL,
    CONSTRAINT [PK_Calificaciones] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Calificaciones_Estudiantes_EstudianteId] FOREIGN KEY ([EstudianteId]) REFERENCES [Estudiantes] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Calificaciones_ItemsEvaluacion_ItemEvaluacionId] FOREIGN KEY ([ItemEvaluacionId]) REFERENCES [ItemsEvaluacion] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [Temas] (
    [Id] int NOT NULL IDENTITY,
    [UnidadId] int NOT NULL,
    [Nombre] nvarchar(200) NOT NULL,
    [Descripcion] nvarchar(1000) NOT NULL,
    CONSTRAINT [PK_Temas] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Temas_Unidades_UnidadId] FOREIGN KEY ([UnidadId]) REFERENCES [Unidades] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [EvaluacionTemas] (
    [ItemEvaluacionId] int NOT NULL,
    [TemaId] int NOT NULL,
    CONSTRAINT [PK_EvaluacionTemas] PRIMARY KEY ([ItemEvaluacionId], [TemaId]),
    CONSTRAINT [FK_EvaluacionTemas_ItemsEvaluacion_ItemEvaluacionId] FOREIGN KEY ([ItemEvaluacionId]) REFERENCES [ItemsEvaluacion] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_EvaluacionTemas_Temas_TemaId] FOREIGN KEY ([TemaId]) REFERENCES [Temas] ([Id]) ON DELETE NO ACTION
);

CREATE INDEX [IX_Calificaciones_EstudianteId] ON [Calificaciones] ([EstudianteId]);

CREATE UNIQUE INDEX [IX_Calificaciones_ItemEvaluacionId_EstudianteId] ON [Calificaciones] ([ItemEvaluacionId], [EstudianteId]);

CREATE UNIQUE INDEX [IX_Cursos_Codigo] ON [Cursos] ([Codigo]) WHERE [Codigo] <> '';

CREATE INDEX [IX_Cursos_DocenteId] ON [Cursos] ([DocenteId]);

CREATE UNIQUE INDEX [IX_Cursos_MoodleCourseId] ON [Cursos] ([MoodleCourseId]) WHERE [MoodleCourseId] > 0;

CREATE UNIQUE INDEX [IX_Docentes_Correo] ON [Docentes] ([Correo]);

CREATE UNIQUE INDEX [IX_Docentes_MoodleUserId] ON [Docentes] ([MoodleUserId]) WHERE [MoodleUserId] IS NOT NULL;

CREATE UNIQUE INDEX [IX_Docentes_UsuarioId] ON [Docentes] ([UsuarioId]) WHERE [UsuarioId] IS NOT NULL;

CREATE UNIQUE INDEX [IX_Estudiantes_MoodleUserId] ON [Estudiantes] ([MoodleUserId]);

CREATE INDEX [IX_EvaluacionTemas_TemaId] ON [EvaluacionTemas] ([TemaId]);

CREATE UNIQUE INDEX [IX_ItemsEvaluacion_CursoId_MoodleItemId] ON [ItemsEvaluacion] ([CursoId], [MoodleItemId]) WHERE [MoodleItemId] > 0;

CREATE INDEX [IX_ItemsEvaluacion_ParcialId] ON [ItemsEvaluacion] ([ParcialId]);

CREATE INDEX [IX_LogsSincronizacion_CursoId] ON [LogsSincronizacion] ([CursoId]);

CREATE INDEX [IX_Matriculas_CursoId] ON [Matriculas] ([CursoId]);

CREATE UNIQUE INDEX [IX_Matriculas_EstudianteId_CursoId] ON [Matriculas] ([EstudianteId], [CursoId]);

CREATE UNIQUE INDEX [IX_Parciales_CursoId_Numero] ON [Parciales] ([CursoId], [Numero]);

CREATE UNIQUE INDEX [IX_Temas_UnidadId_Nombre] ON [Temas] ([UnidadId], [Nombre]);

CREATE UNIQUE INDEX [IX_Unidades_ParcialId_Numero] ON [Unidades] ([ParcialId], [Numero]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20261028011423_InicialAcademicoSprint1', N'10.0.13');

COMMIT;
GO
