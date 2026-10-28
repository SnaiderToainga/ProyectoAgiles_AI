import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CatalogoPage } from './pages/CatalogoPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta Pública: Inicio de sesión con control de bloqueo */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas Privadas: Protegidas con token JWT en AuthContext */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/catalogo" element={<CatalogoPage />} />
          </Route>
        </Route>

        {/* Ruta comodín: Redirección automática */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
