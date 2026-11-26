# SISRA — EduMonitor AI
> **Sistema Inteligente de Seguimiento y Refuerzo Académico**  
> Proyecto de la Facultad de Ingeniería en Sistemas, Electrónica e Industrial (FISEI)  
> **Universidad Técnica de Ambato (UTA)**  
> Carrera de Ingeniería en Software — Asignatura: Metodologías Ágiles  
> **Docente Titular:** Ing. Hernán Naranjo | **Ciclo:** Octubre 2026 – Febrero 2027 (Cuarto "B")  
> **Versión Oficial:** v3.0.0 (Cierre de MVP — Sprint 3)

---

## 👥 Equipo Scrum y Roles
- **Chiluisa Vasquez Estiven Sebastian** — *Product Owner / AI & Data Lead (Frente Analítico/IA)*
- **Toainga Toapanta Snaider Alexander** — *Scrum Master / Architecture Lead & Full Stack Developer*
- **Carrasco Manotoa Cesar Steven** — *Development Team / Frontend Lead & UI/UX Specialist*
- **Sivinta Lasluisa Cristian Fernando** — *Development Team / Backend LMS Specialist*

---

## 🏛️ Arquitectura del Sistema y Mapeo de Puertos

El proyecto implementa el patrón **API Gateway perimetral (YARP)** con **persistencia desacoplada (Database-per-Service)**, **microservicio desacoplado de IA en Python/FastAPI** y **Clean Architecture**:

| Componente | Rol en el Sistema | Tecnología | Puerto Local |
| :--- | :--- | :--- | :---: |
| **Frontend Web** | SPA interactiva, Dashboard de rendimiento, Chat IA, filtros en cascada y reportes PDF. | React 19, TypeScript, Tailwind CSS, Vite | `http://localhost:5173` |
| **API Gateway** | Punto de entrada único perimetral, proxy inverso YARP, validación JWT y CORS. | .NET 10, YARP (Yet Another Reverse Proxy) | `http://localhost:5000` |
| **Backend API** | Microservicios de Identidad, Catálogo Curricular, Calificaciones y Exportación PDF. | ASP.NET Core 10 Web API | `http://localhost:5102` |
| **AI Service (FastAPI)** | Agente pedagógico de planes de refuerzo y asistente conversacional con Tools y Fallback. | Python 3.12/3.13, FastAPI, Gemini API / SDK | `http://localhost:8000` |
| **LMS Moodle** | Aula virtual contenerizada para sincronización curricular, tareas, notas y avatares. | Moodle 4.x oficial + MariaDB 10.6 en Docker | `http://localhost:8080` |
| **AuthDB** | Base de datos de cuentas, roles (Docente/Admin), hashes PBKDF2 y auditoría. | Microsoft SQL Server (`EduMonitorDB`) | `1433` |
| **AcademicoDB** | Base de datos curricular (materias, unidades, temas, evaluaciones 30/30/40 y planes). | Microsoft SQL Server (`AcademicoDB`) | `1433` |

---

## 📋 Módulos y Funcionalidades Principales (Sprints 1, 2 y 3)

1. **Sprint 1 — Cimientos de Seguridad y Catálogo Base:**
   * Autenticación centralizada con tokens criptográficos JWT y bloqueo de seguridad al 3.er intento fallido.
   * Catálogo curricular de materias piloto (*Metodologías Ágiles* y *Estructuras de Datos*).
   * Aprovisionamiento contenerizado de Moodle en Docker con MariaDB.
2. **Sprint 2 — Ingesta Real y Planes con IA (Gemini):**
   * Sincronización de calificaciones reales desde la API Web Services de Moodle.
   * Algoritmo determinista de cálculo de notas oficial UTA (30% Tareas + 30% APE + 40% Examen).
   * Generación y persistencia de planes de refuerzo pedagógico con Google Gemini 2.5 Flash y motor de contingencia local (Fallback).
3. **Sprint 3 — Auditoría Curricular, Dashboard Analítico, Chatbot IA y Reportes Oficiales:**
   * **HU-05:** Generación y descarga de informes oficiales en PDF con membrete institucional UTA/FISEI, paginación dinámica y bloque para firma docente.
   * **HU-06:** Desglose curricular granular por Parcial, Unidad, Tema y Actividad con filtros interactivos en cascada y fotografías de perfil de estudiantes.
   * **HU-07:** Dashboard analítico con gráfico de barras clasificado en 4 rangos de rendimiento (Crítico, En Riesgo, Regular, Sobresaliente) y Asistente Conversacional de IA (Chatbot) con Tools deterministas y advertencias éticas de incertidumbre pedagógica (RNF-08).

---

## ⚙️ Requisitos Previos para Despliegue Local (RNF-05)

Asegúrate de contar con las siguientes herramientas instaladas en tu estación de trabajo:
- [.NET 10 SDK](https://dotnet.microsoft.com/) (Verificar con `dotnet --version`)
- [Node.js 20 LTS o superior](https://nodejs.org/) y npm (Verificar con `node -v` y `npm -v`)
- [Python 3.12 o superior](https://www.python.org/) (Verificar con `python --version`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (con integración WSL 2 activa en Windows)
- [Microsoft SQL Server Express o Developer](https://www.microsoft.com/sql-server/) (`.\SQLEXPRESS` o `localhost,1433`)

---

## 🔐 Configuración de Variables de Entorno

### 1. Variables de Backend API y Gateway
Los archivos `appsettings.json` versionados **no contienen secretos**: la clave JWT y el token de Moodle están vacíos y la API y el Gateway se niegan a arrancar sin una clave JWT propia (32 caracteres o más; la clave publicada en versiones anteriores se rechaza).

- **Con Docker Compose:** complete `.env` a partir de `.env.example` (`JWT_KEY`, `MSSQL_SA_PASSWORD`, `DEMO_PASSWORD`, `MOODLE_TOKEN`).
- **Sin Docker:** `Start-Local.ps1` genera la clave JWT en `.local/jwt-key.txt` y toma el token de `.local/moodle-connection.json`. Si ejecuta `dotnet run` directamente, defina las variables de entorno:

```powershell
$env:Jwt__Key = "<clave propia de 32+ caracteres>"      # la misma para API y Gateway
$env:Moodle__MoodleToken = "<moodleToken de docker/moodle/.local/moodle-connection.json>"
$env:ConnectionStrings__DefaultConnection = "Server=(localdb)\MSSQLLocalDB;Database=EduMonitorDB;Trusted_Connection=True;TrustServerCertificate=True"
$env:ConnectionStrings__AcademicoConnection = "Server=(localdb)\MSSQLLocalDB;Database=AcademicoDB;Trusted_Connection=True;TrustServerCertificate=True"
```

Genere una clave con `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))`.

### 2. Variables del Microservicio de IA (`ai-service/.env`)
Crear el archivo `ai-service/.env` a partir de `ai-service/.env.example`:
```env
# Clave de API de Google Gemini (Dejar vacía para activar automáticamente el motor de contingencia local)
GEMINI_API_KEY=tu_api_key_de_google_gemini

# Modelo LLM (los respaldos se prueban automáticamente si este no responde)
GEMINI_MODEL=gemini-3.5-flash-lite

# Timeout límite en segundos (presupuesto global del servicio: 28 segundos)
GEMINI_TIMEOUT_SECONDS=15

# Orígenes permitidos para CORS
CORS_ORIGINS=["http://localhost:5173", "http://localhost:5000", "http://localhost:8000"]

# API académica que consultan las herramientas del agente (en Docker: http://api:5102)
BACKEND_API_URL=http://localhost:5102
```

---

## 🚀 Guía de Arranque del Sistema Paso a Paso

### Paso 1: Iniciar el Aula Virtual Moodle en Docker
Desde la raíz del repositorio:
```powershell
cd docker/moodle
docker compose up -d
```
*Moodle estará disponible en `http://localhost:8080` (con los cursos SOF-401 y SOF-402 precargados).*

### Paso 2: Aplicar Migraciones de Base de Datos en SQL Server
Asegúrate de que el servicio de SQL Server esté activo y ejecuta:
```powershell
# 1. Migración de Cuentas y Seguridad (EduMonitorDB)
dotnet ef database update --context EduMonitorDbContext --project backend/EduMonitor.Infrastructure --startup-project backend/EduMonitor.Api

# 2. Migración Curricular y Notas (AcademicoDB)
dotnet ef database update --context AcademicoDbContext --project backend/EduMonitor.Infrastructure --startup-project backend/EduMonitor.Api
```

### Paso 3: Iniciar el Microservicio de IA en Python (`ai-service`)
En una nueva terminal:
```powershell
cd ai-service
# Crear entorno virtual si es la primera vez
python -m venv .venv
.\.venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Iniciar el servidor FastAPI en el puerto 8000
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Documentación interactiva Swagger de la IA disponible en: `http://localhost:8000/docs`.*

### Paso 4: Iniciar la API Backend de Microservicios (.NET Core)
En una nueva terminal:
```powershell
cd backend/EduMonitor.Api
dotnet run --launch-profile "http"
```
*Servicio disponible en `http://localhost:5102`.*

### Paso 5: Iniciar el API Gateway YARP
En una nueva terminal:
```powershell
cd backend/EduMonitor.Gateway
dotnet run --launch-profile "http"
```
*Pasarela central disponible en `http://localhost:5000` (enruta automáticamente hacia Backend :5102 e IA :8000).*

### Paso 6: Iniciar la Aplicación Web en React
En una nueva terminal:
```powershell
cd frontend
npm install
npm run dev
```
*Abre tu navegador en `http://localhost:5173` para interactuar con la plataforma.*


### Alternativa: Despliegue unificado con Docker Compose (T-13.7)
Levanta SQL Server, AI Service, Backend API y Gateway YARP con un solo comando. El Gateway (`http://localhost:5000`) es el unico servicio expuesto y exige JWT en `/api/academico`, `/api/moodle` y `/api/agent`:
```powershell
Copy-Item .env.example .env      # ajustar MSSQL_SA_PASSWORD, JWT_KEY, GEMINI_API_KEY y MOODLE_TOKEN
docker compose up -d --build
```
La API aplica las migraciones al iniciar (`Database__MigrateOnStartup`). Moodle sigue en `docker/moodle` (Paso 1) y el frontend se inicia con `npm run dev` (Paso 6).
`MOODLE_TOKEN` es el token de la cuenta de servicio de solo lectura de Moodle: cópialo de `docker/moodle/.local/moodle-connection.json` (campo `moodleToken`).

### Alta de docentes y enlace con Moodle
Las cuentas de SISRA y de Moodle son independientes. El administrador crea los docentes en *Gestión de Usuarios* y enlaza cada uno con su usuario de Moodle; la API lee Moodle con una cuenta de servicio de solo lectura y cada docente sincroniza únicamente los cursos donde es profesor. Endpoints (rol Administrador, vía Gateway):

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/auth/usuarios` | Lista las cuentas con su `moodleUserId`. |
| `POST` | `/api/auth/usuarios` | Crea una cuenta con contraseña cifrada (PBKDF2): mínimo 10 caracteres con mayúscula, minúscula, número y símbolo. Si el rol es Docente crea también su registro académico y, con `moodleUserId`, verifica en Moodle sus cursos. |
| `PUT` | `/api/auth/usuarios/{id}/moodle` | Enlaza (`{"moodleUserId": 20}`) o desenlaza (`null`) a un docente con su usuario de Moodle. |

El procedimiento completo está en [docker/moodle/README.md](docker/moodle/README.md#agregar-un-docente-nuevo).

---

## 🧪 Ejecución de Pruebas Automatizadas (CI / QA)

### 1. Pruebas Unitarias de Backend (.NET Core / xUnit)
```powershell
dotnet test backend/EduMonitor.Tests/EduMonitor.Tests.csproj
```

### 2. Pruebas Automatizadas de IA (Python / PyTest)
```powershell
cd ai-service
.\.venv\Scripts\pytest -v
```

### 3. Pruebas Unitarias de Anonimización y Privacidad Frontend (Vitest)
```powershell
cd frontend
npm test
```

### 4. Verificación de Compilación y Calidad Frontend (TypeScript & Oxlint)
```powershell
cd frontend
npm run lint
npm run build
```

---

## 🛡️ Políticas de Seguridad y Privacidad (Zero-PII & RNF-08)
- **Zero-PII (Zero Personally Identifiable Information):** Ningún dato sensible (cédula, correo o nombres civiles) es enviado a servicios externos en la nube. La inferencia pedagógica procesa exclusivamente tuplas anónimas `(materia, notas, temas)`.
- **Incertidumbre Pedagógica y Ética (RNF-08):** Todo diagnóstico o respuesta del agente inteligente incorpora advertencias explícitas señalando su naturaleza orientativa, preservando la soberanía evaluativa del docente titular.
- **Agente con herramientas reales y traza (sección 7 / RF-12):** el navegador solo envía la pregunta anonimizada y qué curso y parcial se consultan. El modelo decide qué herramientas usar (`consultar_resumen_curso`, `listar_estudiantes_en_riesgo`, `analizar_temas_y_actividades`, `identificar_alertas`, `diagnosticar_estudiante`); cada una consulta `GET /api/academico/agente/...` con el JWT del docente, que devuelve los datos seudonimizados (`EST-<id>`, sin nombres ni correos). Cada consulta queda registrada en `TrazasAgente` (consulta, herramientas, parámetros, duración y fallos) y el administrador la revisa en **Auditoría**.
- **Alertas académicas configurables (RF-05, RF-07):** la API calcula de forma determinista el progreso de entregas (calificadas, pendientes de calificar, vencidas sin entrega, por entregar) y cuatro reglas con evidencia: rendimiento bajo el umbral, descenso en las últimas evaluaciones (según el orden del curso en Moodle), actividades vencidas sin entrega y baja finalización. Cada docente activa y ajusta las reglas de su materia desde el Dashboard (`PUT /api/academico/materias/{id}/configuracion-alertas`). Las alertas son orientativas y no constituyen diagnósticos.
- **Fallos honestos:** si la API académica o el servicio de IA no responden, el chat informa el error; nunca muestra un análisis construido en el navegador.
- **Tolerancia a Fallos y Alta Disponibilidad (Resiliencia):** En caso de corte de conexión o alta latencia con Google Gemini, el sistema activa automáticamente su **Motor de Reglas Pedagógicas Local (Fallback)**, garantizando que el docente y el estudiante siempre reciban sus reportes sin interrupción.
