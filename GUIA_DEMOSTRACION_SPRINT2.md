# SISRA / EduMonitor AI — Guía de Demostración y Defensa de Sprint 2
**Proyecto:** Sistema Inteligente de Seguimiento y Refuerzo Académico (SISRA)  
**Asignatura:** Metodologías Ágiles | **Docente:** Ing. Hernán Naranjo  
**Nivel:** 4to Semestre "B" — FISEI, Universidad Técnica de Ambato (UTA)  
**Período:** Octubre 2026 – Febrero 2027 | **Cierre Sprint 2:** 12 de Noviembre de 2026  

---

## 1. Guía Rápida de Correspondencia (Documento vs. Software en Vivo)

Cuando el docente revise el informe impreso o digital, irá contrastando los Criterios de Aceptación, Tablas y Casos de Prueba contra el sistema en ejecución. Utiliza este mapa directo:

| Sección en el Informe | Qué busca el Docente | Dónde mostrarlo en el Software | Acción en Vivo |
| :--- | :--- | :--- | :--- |
| **Sección 16.1 / 18.1**<br>HU-04A: Sincronización y Riesgo | CA-04A.1: Sincronización real Moodle -> SQL Server | Vista `/evaluaciones` | Clic en el botón **"Sincronizar con Moodle"**. Ver notificación verde de éxito y actualización de calificaciones. |
| **Sección 16.1 / 19.1**<br>Tabla 10 (CP-04A-01 a 04) | CA-04A.2: Escala 0–10 y distinción de 0.00 vs "Sin nota" | Vista `/evaluaciones` (Tabla de Estudiantes) | Mostrar que notas de Moodle (sobre 100) se convierten a escala UTA (0–10). Los ceros reales se ponderan como 0.00. |
| **Sección 16.1 / 18.1**<br>Figura 2 y 7 | CA-04A.3: Cálculo 30/30/40 y detección de riesgo (< 7.00) | Vista `/evaluaciones` y `/inicio` | Mostrar columna "Promedio", etiqueta roja **"En Riesgo"** (< 7.00) y enlace directo **"Diagnosticar IA →"**. |
| **Sección 16.1 / 17.4**<br>Riesgos y mitigación | CA-04A.4: Tolerancia si Moodle falla | Base de datos `AcademicoDB` | Mostrar tabla `LogsSincronizacion` que audita cada sincronización (éxito o error controlado). |
| **Sección 16.2 / 18.2**<br>HU-04B: Tutoría con IA | CA-04B.1: Privacidad y anonimización de datos enviados a IA | Vista `/tutoria` o payload del backend | Al presionar **"Generar Plan con IA"**, solo viajan notas ponderadas y códigos de temas (sin nombres ni correos). |
| **Sección 16.2 / 19.2**<br>Figura 3, 9 y 10 | CA-04B.2: Diagnóstico cualitativo y acordeones por tema | Vista `/tutoria` | Mostrar el panel con diagnóstico pedagógico formal, regla cognitiva UTA y acordeones desplegables con horas y recursos. |
| **Sección 16.2 / 18.2**<br>Tabla 11 (CP-04B-03) | CA-04B.3: Persistencia en SQL Server que sobrevive a F5 | Vista `/tutoria` | Recargar el navegador con **F5**. El plan no se pierde, se carga de SQL Server con la insignia **"Plan guardado"** / **"Persistido en SQL Server"**. |
| **Sección 16.2 / 17.4**<br>Tabla 9 y 11 | CA-04B.4: Motor de contingencia local si falla la red | Código `FallbackService.py` y bandera `esFallback` | Explicar que si Google Gemini no responde, el sistema no se cae: genera un plan determinista local (`esFallback: true`). |
| **Sección 19.3 / 22.1**<br>Tabla 12 y 13 | Integración Continua (CI), Pruebas y Pull Requests | Repositorio GitHub / PRs | Mostrar GitHub Actions en verde, 34 pruebas xUnit en .NET, 6 en PyTest y 0 errores de build. |

---

## 2. Guión Paso a Paso para la Demostración

### Paso 1: Inicio de Sesión y Dashboard Inicial
1. Ingresar a `http://localhost:5173` con el usuario docente:
   - **Usuario / Correo:** `d.proano` (o `d.proano@uta.edu.ec`)
   - **Contraseña:** `Docente_Password_2026!`
2. En la vista **Inicio (Dashboard)**:
   - Mostrar el resumen general de la asignatura **Metodologías Ágiles (SOF-401)**.
   - Señalar la tarjeta de alerta: **"En Riesgo Académico (< 7.00)"**, que resume cuántos estudiantes requieren refuerzo pedagógico en el Parcial 1.

---

### Paso 2: Verificación de HU-04A — Sincronización y Cálculo 30/30/40
*Correspondencia con el documento: Páginas 4 a 7 y 17 a 20 (Figuras 1, 2, 4, 5, 6 y 7).*

1. Navegar en el menú lateral a **Evaluaciones (30/30/40)** (`/evaluaciones`).
2. **Explicación del cálculo institucional UTA:**
   - Señalar los tres bloques superiores:
     - **Tareas Formativas (30%)**
     - **Prácticas APE (30%)**
     - **Examen Sumativo (40%)**
3. **Demostración de Sincronización en Vivo (CA-04A.1):**
   - Hacer clic en el botón superior **"Sincronizar con Moodle"**.
   - Mostrar la alerta verde de confirmación: el sistema conectó con Moodle (puerto 8080), leyó las calificaciones de las tareas y las persistió en `AcademicoDB`.
4. **Verificación de Calificaciones Reales y Detección de Riesgo (CA-04A.2 y CA-04A.3):**
   - En la tabla de estudiantes, mostrar:
     - **Ficticio Estudiante Dos:** Promedio `8.00 / 10.00` -> Estado en verde: **Aprobado**.
     - **Ficticio Estudiante Tres:** Promedio `6.20 / 10.00` (< 7.00) -> Estado en rojo: **En Riesgo**.
     - **Ficticio Estudiante Uno:** Promedio `3.10 / 10.00` (< 7.00) -> Estado en rojo: **En Riesgo**.
   - Mostrar cómo al desplegar las filas se observa la nota individual por cada actividad (convertida correctamente de escala 0-100 a escala 0-10).
5. **Transición a Tutoría:**
   - En la fila de un estudiante en riesgo (ej. *Ficticio Estudiante Tres*), hacer clic en la acción **"Diagnosticar IA →"**. El sistema redirige automáticamente al módulo de tutorías con ese alumno preseleccionado.

---

### Paso 3: Verificación de HU-04B — Tutoría con IA y Persistencia
*Correspondencia con el documento: Páginas 8 a 11 y 21 a 26 (Figuras 3, 8, 9, 10 y 11).*

1. En la vista **Tutoría y Refuerzo IA** (`/tutoria`):
   - En la columna izquierda se listan los estudiantes en riesgo detectados en el Parcial 1.
2. **Generación / Regeneración del Plan con IA (CA-04B.1 y CA-04B.2):**
   - Seleccionar a **Ficticio Estudiante Tres**.
   - Hacer clic en el botón **"Regenerar Plan con IA"** (o "Generar Plan con IA").
   - **Explicación al docente:**
     > *"Ingeniero, en este momento el frontend envía a través del Gateway YARP (:5000) hacia el microservicio en Python (:8000) una solicitud estrictamente anonimizada (no viaja nombre, cédula ni correo electrónico, solo la materia, el promedio y los temas deficientes). El modelo Google Gemini 3.5 Flash procesa los vacíos pedagógicos y nos devuelve un JSON estructurado."*
3. **Revisión de los Elementos Generados en Pantalla:**
   - **Trazabilidad Causal del Agente (Regla Cognitiva UTA):** Muestra la clasificación de causa raíz (por ejemplo, *Dificultad de Aplicación Práctica / Transferencia* o *Brecha Conceptual de Base no Resuelta* según si falló en Tareas formativas o en el Examen sumativo).
   - **Diagnóstico Pedagógico Cualitativo:** Texto formal generado por la IA redactado con tono pedagógico universitario adaptado a la carrera de Software de la UTA.
   - **Plan de Acción por Tema (Acordeones interactivos):**
     - Desplegar uno de los temas críticos (ej. *Fundamentos y roles Scrum*).
     - Mostrar los cuatro campos generados:
       1. **Actividad sugerida:** Ejercitación práctica o estudio guiado.
       2. **Nivel de prioridad:** Alta, Media o Baja.
       3. **Tiempo estimado:** Horas recomendadas (ej. 4 a 6 horas).
       4. **Recurso recomendado:** Bibliografía o guía oficial (ej. *Guía oficial de Scrum / Scrum Guide*).
4. **Demostración de Persistencia en SQL Server (CA-04B.3):**
   - Mostrar la etiqueta en verde en la lista de estudiantes: **"Plan guardado"** y en el pie de página **"Estado: Persistido en SQL Server"**.
   - **Prueba contundente:** Presionar **F5** en el navegador para recargar la página completa.
   - Demostrar que el plan vuelve a aparecer instantáneamente sin necesidad de volver a consumir tokens de la API externa de Google Gemini, ya que fue recuperado desde la base de datos `AcademicoDB` (tablas `PlanesRefuerzo` y `DetallesPlanRefuerzo`).
5. **Explicación del Motor de Contingencia / Fallback (CA-04B.4):**
   - Explicar al profesor:
     > *"Si en algún momento la institución se queda sin internet o la API externa de Google alcanza su límite de cuota, nuestro microservicio activa automáticamente el `FallbackService` en Python, el cual genera un plan determinista local sin que la plataforma se caiga ni se bloquee el docente."*

---

### Paso 4: Evidencia de Integración Continua (CI/CD) y Calidad
*Correspondencia con el documento: Páginas 24 a 27 y 31 a 33 (Tablas 12 y 13).*

1. **Pull Requests Integrados:**
   - Mostrar en GitHub la lista de PRs cerrados y fusionados hacia `develop`:
     - **PR #10:** Modelos de persistencia en SQL Server y rutas YARP.
     - **PR #14:** Sincronización Moodle con manejo de campos nulos.
     - **PR #15:** Microservicio de IA con FastAPI y endpoint de rendimiento.
     - **PR #16:** Conexión real de la pantalla de Evaluaciones.
     - **PR #17:** Módulo interactivo de Tutoría IA con persistencia.
     - **PR de Unificación Final:** Barra lateral institucional FISEI, auditoría y resolución de CI.
2. **Pruebas Automatizadas en Verde:**
   - **Backend (.NET 10):** 34 pruebas xUnit ejecutadas y aprobadas (cobertura en cálculo ponderado, límites de notas, permisos JWT y catálogo curricular).
   - **Servicio IA (Python):** Pruebas PyTest que validan contratos de datos con Pydantic v2 y respaldo local.
   - **Frontend (React 19):** Compilación limpia con Vite y TypeScript con 0 errores de compilación y linting.

---

## 3. Preguntas Frecuentes del Evaluador y Respuestas Técnicas

### P1: "¿Dónde se guardan las notas de Moodle y cómo evitan duplicados al volver a sincronizar?"
> **Respuesta:** *"Se guardan en la base de datos `AcademicoDB`, específicamente en las tablas `ItemsEvaluacion` y `Calificaciones`. En el servicio `MoodleSyncService.cs`, antes de insertar, se consulta por el identificador único de actividad de Moodle (`MoodleItemId`) y el ID del estudiante; si ya existe, se actualiza el registro existente (`UPDATE`) en lugar de insertar uno nuevo, garantizando idempotencia."*

### P2: "¿Por qué dividieron la HU-04 en HU-04A y HU-04B?"
> **Respuesta:** *"En el refinamiento con Planning Poker, la historia HU-04 sumaba 13 Story Points, lo cual excedía el límite recomendado en metodologías ágiles (máximo 8 SP por historia para evitar cuellos de botella en el sprint). La dividimos en HU-04A (8 SP, sincronización de notas y cálculo de riesgo) y HU-04B (5 SP, servicio de IA y persistencia de planes), logrando una distribución equitativa de 96 horas de desarrollo entre los 4 integrantes."*

### P3: "¿Cómo aseguran la privacidad del estudiante al usar Inteligencia Artificial?"
> **Respuesta:** *"Cumpliendo con el criterio CA-04B.1 y las directrices de privacidad de la UTA, el backend anonimiza los datos antes de llamar al microservicio `ai-service`. A la API de Google Gemini nunca se envían nombres, apellidos, correos institucionales ni números de cédula. Únicamente viaja el código de la asignatura, el promedio ponderado del parcial y los identificadores de los temas en los que obtuvo bajo rendimiento."*

### P4: "¿Qué arquitectura utilizaron para conectar todos los servicios?"
> **Respuesta:** *"Utilizamos una arquitectura basada en microservicios desacoplados:
> 1. **Frontend:** React 19 con TypeScript y Tailwind CSS en el puerto 5173.
> 2. **API Gateway:** YARP en ASP.NET Core en el puerto 5000, que actúa como punto único de entrada y valida los tokens JWT.
> 3. **Backend Académico:** ASP.NET Core 10 en el puerto 5102 con Entity Framework Core y SQL Server (bases `EduMonitorDB` y `AcademicoDB`).
> 4. **Microservicio de IA:** Python con FastAPI y Pydantic en el puerto 8000, conectado a Google Gemini.
> 5. **LMS Institucional:** Moodle 4.5 en Docker con MariaDB en el puerto 8080."*
