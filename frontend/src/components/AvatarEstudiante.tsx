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
  lg: 'w-11 h-11 text-sm',
}

function obtenerIniciales(apellidos: string, nombres: string): string {
  const a = (apellidos || '').trim().split(/\s+/)[0] || ''
  const n = (nombres || '').trim().split(/\s+/)[0] || ''
  const combinado = `${a.charAt(0)}${n.charAt(0)}`.toUpperCase()
  return combinado || 'ES'
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
  const urlLimpia = fotoUrl?.trim() || ''
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
        className={`${dimension} rounded-full object-cover shrink-0 border ${
          enRiesgo ? 'border-red-300 ring-2 ring-red-100' : 'border-zinc-200'
        }`}
      />
    )
  }

  return (
    <div
      aria-label={`Avatar con iniciales de ${apellidos} ${nombres}`.trim()}
      className={`${dimension} rounded-full font-bold flex items-center justify-center shrink-0 border ${
        enRiesgo
          ? 'bg-red-50 text-[#8B151A] border-red-200'
          : 'bg-zinc-100 text-zinc-700 border-zinc-200'
      }`}
    >
      {iniciales}
    </div>
  )
}
