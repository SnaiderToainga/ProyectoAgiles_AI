import { useState, useEffect } from 'react'

interface AvatarEstudianteProps {
  nombres: string
  apellidos: string
  fotoUrl?: string | null
  enRiesgo?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASSES: Record<NonNullable<AvatarEstudianteProps['size']>, string> = {
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-[38px] h-[38px] text-[13px]',
}

function obtenerIniciales(apellidos: string, nombres: string): string {
  const a = (apellidos || '').trim().split(/\s+/)[0] || ''
  const n = (nombres || '').trim().split(/\s+/)[0] || ''
  const combinado = `${a.charAt(0)}${n.charAt(0)}`.toUpperCase()
  return combinado || 'ES'
}

function esPlaceholderMoodle(url: string): boolean {
  if (!url) return false
  return url.includes('/theme/image.php/') && url.includes('/u/f')
}

/**
 * Muestra la fotografía oficial de Moodle cuando está disponible y válida,
 * con fallback determinista a iniciales institucionales (T-12.6 / CA-06.3).
 */
export function AvatarEstudiante({
  nombres,
  apellidos,
  fotoUrl,
  enRiesgo = false,
  size = 'md',
}: AvatarEstudianteProps) {
  const urlCruda = fotoUrl?.trim() || ''
  const urlLimpia = esPlaceholderMoodle(urlCruda) ? '' : urlCruda
  const [errorCarga, setErrorCarga] = useState(false)

  useEffect(() => {
    setErrorCarga(false)
  }, [urlLimpia])

  const dimension = SIZE_CLASSES[size]
  const iniciales = obtenerIniciales(apellidos, nombres)

  if (urlLimpia && !errorCarga) {
    return (
      <img
        src={urlLimpia}
        alt={`Foto de ${apellidos} ${nombres}`.trim()}
        referrerPolicy="no-referrer"
        onError={() => setErrorCarga(true)}
        style={{ borderRadius: '50%' }}
        className={`${dimension} object-cover shrink-0 border ${
          enRiesgo ? 'border-[#fecaca]' : 'border-[#e5e7eb]'
        }`}
      />
    )
  }

  return (
    <div
      aria-label={`Avatar con iniciales de ${apellidos} ${nombres}`.trim()}
      style={{ borderRadius: '50%' }}
      className={`k-avatar ${enRiesgo ? 'risk' : ''} ${dimension}`}
    >
      {iniciales}
    </div>
  )
}
