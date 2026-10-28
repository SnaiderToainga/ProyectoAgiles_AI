BEGIN TRANSACTION;
ALTER TABLE [Calificaciones] DROP CONSTRAINT [FK_Calificaciones_Estudiantes_EstudianteId];

ALTER TABLE [Cursos] DROP CONSTRAINT [FK_Cursos_Docentes_DocenteId];

DROP INDEX [IX_Matriculas_EstudianteId] ON [Matriculas];

DROP INDEX [IX_ItemsEvaluacion_CursoId] ON [ItemsEvaluacion];

DROP INDEX [IX_Calificaciones_ItemEvaluacionId] ON [Calificaciones];

DECLARE @var nvarchar(max);
SELECT @var = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[LogsSincronizacion]') AND [c].[name] = N'MensajeError');
IF @var IS NOT NULL EXEC(N'ALTER TABLE [LogsSincronizacion] DROP CONSTRAINT ' + @var + ';');
ALTER TABLE [LogsSincronizacion] ALTER COLUMN [MensajeError] nvarchar(1000) NULL;

DECLARE @var1 nvarchar(max);
SELECT @var1 = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[LogsSincronizacion]') AND [c].[name] = N'CursoId');
IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [LogsSincronizacion] DROP CONSTRAINT ' + @var1 + ';');
ALTER TABLE [LogsSincronizacion] ALTER COLUMN [CursoId] int NULL;

ALTER TABLE [LogsSincronizacion] ADD [DocenteId] int NULL;

ALTER TABLE [LogsSincronizacion] ADD [Estado] nvarchar(30) NOT NULL DEFAULT N'';

ALTER TABLE [LogsSincronizacion] ADD [Operacion] nvarchar(50) NOT NULL DEFAULT N'';

DECLARE @var2 nvarchar(max);
SELECT @var2 = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ItemsEvaluacion]') AND [c].[name] = N'Nombre');
IF @var2 IS NOT NULL EXEC(N'ALTER TABLE [ItemsEvaluacion] DROP CONSTRAINT ' + @var2 + ';');
ALTER TABLE [ItemsEvaluacion] ALTER COLUMN [Nombre] nvarchar(200) NOT NULL;

DECLARE @var3 nvarchar(max);
SELECT @var3 = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ItemsEvaluacion]') AND [c].[name] = N'CalificacionMaxima');
IF @var3 IS NOT NULL EXEC(N'ALTER TABLE [ItemsEvaluacion] DROP CONSTRAINT ' + @var3 + ';');
ALTER TABLE [ItemsEvaluacion] ALTER COLUMN [CalificacionMaxima] decimal(12,4) NOT NULL;

ALTER TABLE [ItemsEvaluacion] ADD [MaximoMoodle] decimal(12,4) NULL;

ALTER TABLE [ItemsEvaluacion] ADD [MinimoMoodle] decimal(12,4) NULL;

ALTER TABLE [ItemsEvaluacion] ADD [ParcialId] int NULL;

ALTER TABLE [ItemsEvaluacion] ADD [Publicado] bit NOT NULL DEFAULT CAST(0 AS bit);

DECLARE @var4 nvarchar(max);
SELECT @var4 = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Estudiantes]') AND [c].[name] = N'Nombres');
IF @var4 IS NOT NULL EXEC(N'ALTER TABLE [Estudiantes] DROP CONSTRAINT ' + @var4 + ';');
ALTER TABLE [Estudiantes] ALTER COLUMN [Nombres] nvarchar(100) NOT NULL;

DECLARE @var5 nvarchar(max);
SELECT @var5 = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Estudiantes]') AND [c].[name] = N'Correo');
IF @var5 IS NOT NULL EXEC(N'ALTER TABLE [Estudiantes] DROP CONSTRAINT ' + @var5 + ';');
ALTER TABLE [Estudiantes] ALTER COLUMN [Correo] nvarchar(150) NOT NULL;

DECLARE @var6 nvarchar(max);
SELECT @var6 = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Estudiantes]') AND [c].[name] = N'Apellidos');
IF @var6 IS NOT NULL EXEC(N'ALTER TABLE [Estudiantes] DROP CONSTRAINT ' + @var6 + ';');
ALTER TABLE [Estudiantes] ALTER COLUMN [Apellidos] nvarchar(100) NOT NULL;

DECLARE @var7 nvarchar(max);
SELECT @var7 = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Docentes]') AND [c].[name] = N'Rol');
IF @var7 IS NOT NULL EXEC(N'ALTER TABLE [Docentes] DROP CONSTRAINT ' + @var7 + ';');
ALTER TABLE [Docentes] ALTER COLUMN [Rol] nvarchar(50) NOT NULL;

DECLARE @var8 nvarchar(max);
SELECT @var8 = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Docentes]') AND [c].[name] = N'Nombre');
IF @var8 IS NOT NULL EXEC(N'ALTER TABLE [Docentes] DROP CONSTRAINT ' + @var8 + ';');
ALTER TABLE [Docentes] ALTER COLUMN [Nombre] nvarchar(150) NOT NULL;

DECLARE @var9 nvarchar(max);
SELECT @var9 = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Docentes]') AND [c].[name] = N'Correo');
IF @var9 IS NOT NULL EXEC(N'ALTER TABLE [Docentes] DROP CONSTRAINT ' + @var9 + ';');
ALTER TABLE [Docentes] ALTER COLUMN [Correo] nvarchar(150) NOT NULL;

DECLARE @var10 nvarchar(max);
SELECT @var10 = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Docentes]') AND [c].[name] = N'ClaveHash');
IF @var10 IS NOT NULL EXEC(N'ALTER TABLE [Docentes] DROP CONSTRAINT ' + @var10 + ';');
ALTER TABLE [Docentes] ALTER COLUMN [ClaveHash] nvarchar(256) NOT NULL;

ALTER TABLE [Docentes] ADD [MoodleUserId] int NULL;

ALTER TABLE [Docentes] ADD [UsuarioId] int NULL;

DECLARE @var11 nvarchar(max);
SELECT @var11 = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Cursos]') AND [c].[name] = N'Periodo');
IF @var11 IS NOT NULL EXEC(N'ALTER TABLE [Cursos] DROP CONSTRAINT ' + @var11 + ';');
ALTER TABLE [Cursos] ALTER COLUMN [Periodo] nvarchar(50) NOT NULL;

DECLARE @var12 nvarchar(max);
SELECT @var12 = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Cursos]') AND [c].[name] = N'Nombre');
IF @var12 IS NOT NULL EXEC(N'ALTER TABLE [Cursos] DROP CONSTRAINT ' + @var12 + ';');
ALTER TABLE [Cursos] ALTER COLUMN [Nombre] nvarchar(200) NOT NULL;

ALTER TABLE [Cursos] ADD [Codigo] nvarchar(40) NOT NULL DEFAULT N'';

DECLARE @var13 nvarchar(max);
SELECT @var13 = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Calificaciones]') AND [c].[name] = N'Nota');
IF @var13 IS NOT NULL EXEC(N'ALTER TABLE [Calificaciones] DROP CONSTRAINT ' + @var13 + ';');
ALTER TABLE [Calificaciones] ALTER COLUMN [Nota] decimal(12,4) NULL;

ALTER TABLE [Calificaciones] ADD [NotaMoodle] decimal(12,4) NULL;

CREATE UNIQUE INDEX [IX_Matriculas_EstudianteId_CursoId] ON [Matriculas] ([EstudianteId], [CursoId]);

CREATE UNIQUE INDEX [IX_ItemsEvaluacion_CursoId_MoodleItemId] ON [ItemsEvaluacion] ([CursoId], [MoodleItemId]) WHERE [MoodleItemId] > 0;

CREATE UNIQUE INDEX [IX_Estudiantes_MoodleUserId] ON [Estudiantes] ([MoodleUserId]);

CREATE UNIQUE INDEX [IX_Docentes_Correo] ON [Docentes] ([Correo]);

CREATE UNIQUE INDEX [IX_Docentes_MoodleUserId] ON [Docentes] ([MoodleUserId]) WHERE [MoodleUserId] IS NOT NULL;

CREATE UNIQUE INDEX [IX_Docentes_UsuarioId] ON [Docentes] ([UsuarioId]) WHERE [UsuarioId] IS NOT NULL;

CREATE UNIQUE INDEX [IX_Cursos_Codigo] ON [Cursos] ([Codigo]) WHERE [Codigo] <> '';

CREATE UNIQUE INDEX [IX_Cursos_MoodleCourseId] ON [Cursos] ([MoodleCourseId]) WHERE [MoodleCourseId] > 0;

CREATE UNIQUE INDEX [IX_Calificaciones_ItemEvaluacionId_EstudianteId] ON [Calificaciones] ([ItemEvaluacionId], [EstudianteId]);

ALTER TABLE [Calificaciones] ADD CONSTRAINT [FK_Calificaciones_Estudiantes_EstudianteId] FOREIGN KEY ([EstudianteId]) REFERENCES [Estudiantes] ([Id]) ON DELETE NO ACTION;

ALTER TABLE [Cursos] ADD CONSTRAINT [FK_Cursos_Docentes_DocenteId] FOREIGN KEY ([DocenteId]) REFERENCES [Docentes] ([Id]) ON DELETE NO ACTION;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20261028011428_RestaurarRestriccionesAcademicas', N'10.0.13');

COMMIT;
GO
