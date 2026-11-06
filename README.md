# SISRA — EduMonitor AI
> **Sistema Inteligente de Seguimiento y Refuerzo Académico**  
> Proyecto de la Facultad de Ingeniería en Sistemas, Electrónica e Industrial (FISEI)  
> **Universidad Técnica de Ambato (UTA)**  
> Carrera de Ingeniería en Software — Asignatura: Metodologías Ágiles  
> **Docente Titular:** Ing. Hernán Naranjo | **Ciclo:** Octubre 2026 – Febrero 2027 (Cuarto "B")

---

## 👥 Equipo Scrum y Roles
- **Chiluisa Vasquez Estiven Sebastian** — *Product Owner / Backend & Cloud AI Specialist*
- **Toainga Toapanta Snaider Alexander** — *Scrum Master / Architecture Lead & Backend Specialist*
- **Carrasco Manotoa Cesar Steven** — *Development Team / Frontend & UI/UX Lead*
- **Sivinta Lasluisa Cristian Fernando** — *Development Team / Backend & LMS Specialist*

---

## 🏛️ Arquitectura del Sistema y Puertos

El proyecto implementa el patrón **API Gateway perimetral** con **persistencia desacoplada (Database-per-Service)** y **Clean Architecture**:

| Componente | Rol en el Sistema | Tecnología | Puerto Local |
| :--- | :--- | :--- | :---: |
| **Frontend Web** | SPA interactiva, gestión de sesión y paneles de control. | React 19, TypeScript, Tailwind CSS, Vite | `http://localhost:5173` |
| **API Gateway** | Punto de entrada único, proxy inverso, validación JWT y CORS. | .NET 10, YARP (Yet Another Reverse Proxy) | `http://localhost:5000` |
| **Backend API** | Microservicios de Identidad, Catálogo Curricular y Analítica. | ASP.NET Core 10 Web API | `http://localhost:5102` |
| **LMS Moodle** | Entorno virtual de pruebas para ingesta de notas de cursos piloto. | Moodle 4.x oficial + MariaDB 10.6 en Docker | `http://localhost:8080` |
| **AuthDB** | Base de datos de cuentas, roles, hashes PBKDF2 y bitácora de accesos. | Microsoft SQL Server (`EduMonitorDB`) | `1433` |
| **AcademicoDB** | Base de datos curricular (materias, unidades, temas y notas 30/30/40). | Microsoft SQL Server (`AcademicoDB`) | `1433` |

---

## ⚙️ Requisitos Previos para Despliegue Local
- [.NET 10 SDK](https://dotnet.microsoft.com/)
- [Node.js 20 LTS](https://nodejs.org/) y npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (con motor WSL 2 en Windows)
- [Microsoft SQL Server Express](https://www.microsoft.com/sql-server/) (`.\SQLEXPRESS`) y SSMS

---

## 🚀 Guía de Arranque del Sistema Paso a Paso

### 1. Iniciar el Aula Virtual Moodle en Docker
```powershell
cd docker/moodle
docker compose up -d
```
*Moodle estará disponible en `http://localhost:8080` (Cursos piloto precargados).*

### 2. Aplicar Migraciones de Base de Datos (Code-First)
En SQL Server Management Studio asegúrate de tener creadas las bases `EduMonitorDB` y `AcademicoDB`. Luego ejecuta:
```powershell
# Migración de Seguridad
dotnet ef database update --context EduMonitorDbContext --project backend/EduMonitor.Infrastructure --startup-project backend/EduMonitor.Api

# Migración Curricular y Calificaciones
dotnet ef database update --context AcademicoDbContext --project backend/EduMonitor.Infrastructure --startup-project backend/EduMonitor.Api
```

### 3. Levantar la API de Microservicios (Puerto 5102)
```powershell
cd backend/EduMonitor.Api
dotnet run --launch-profile "http"
```

### 4. Levantar el API Gateway YARP (Puerto 5000)
```powershell
cd backend/EduMonitor.Gateway
dotnet run --launch-profile "http"
```

### 5. Levantar el Frontend en React (Puerto 5173)
```powershell
cd frontend
npm install
npm run dev
```
*Abre tu navegador en `http://localhost:5173` para ingresar.*

---

## 🔐 Credenciales de Prueba Institucionales (Sin Secretos Sensibles)

| Rol | Correo Institucional | Contraseña | Comportamiento del Sistema |
| :--- | :--- | :--- | :--- |
| **Docente Titular** | `d.proano@uta.edu.ec` | `Admin123!` | Acceso a materias asignadas y notas 30/30/40. |
| **Administrador** | `s.toainga@uta.edu.ec` | `Admin123!` | Supervisión curricular, auditoría y desbloqueo. |
| **Prueba de Bloqueo** | `prueba.bloqueo@uta.edu.ec` | *(Fallar 3 veces)* | Dispara bloqueo a `Status = 0` y código HTTP 423. |

---

## 📡 Catálogo de Endpoints de la API (Consumo vía Gateway :5000)

### Módulo de Autenticación (`AuthService`)
- `POST /api/auth/login`: Valida contraseña encriptada con PBKDF2 y emite token JWT con vigencia de 4 horas.
- `PUT /api/auth/desbloquear/{id}`: Reactiva una cuenta bloqueada tras 3 intentos fallidos (`Status = 1`).

### Módulo Académico (`AcademicoService`)
- `GET /api/academico/materias`: Lista asignaturas piloto con parciales, unidades y temas (requiere Bearer Token).
- `POST /api/academico/temas`: Registra un nuevo tema atómico dentro de una unidad curricular.

### Módulo de Integración Moodle e IA (`AnalyticsService`)
- `POST /api/moodle/sync-notas/{cursoId}`: Sincroniza calificaciones desde el contenedor Docker.
- `POST /api/agent/diagnostico-prueba`: Spike de inferencia de IA con datos anonimizados (sin PII) y contingencia local.

---

## 🧪 Pruebas Automatizadas
Para ejecutar la suite de 29 pruebas unitarias que validan la regla de ponderación 30/30/40, la seguridad de contraseñas y el API Gateway:
```powershell
dotnet test backend/EduMonitor.Tests
```