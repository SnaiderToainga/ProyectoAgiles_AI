import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CatalogoPage } from './pages/CatalogoPage'
import { EvaluacionesPage } from './pages/EvaluacionesPage'
import { TutoriaPage } from './pages/TutoriaPage'
import { AdminUsuariosPage } from './pages/AdminUsuariosPage'
import { AdminAuditoriaPage } from './pages/AdminAuditoriaPage'
import { AdminMoodlePage } from './pages/AdminMoodlePage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/catalogo" element={<CatalogoPage />} />
            <Route path="/evaluaciones" element={<EvaluacionesPage />} />
            <Route path="/tutoria" element={<TutoriaPage />} />

            {/* Rutas exclusivas del Administrador (Mockups Páginas 25, 28, 39) */}
            <Route path="/admin/usuarios" element={<AdminUsuariosPage />} />
            <Route path="/admin/auditoria" element={<AdminAuditoriaPage />} />
            <Route path="/admin/moodle" element={<AdminMoodlePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
