interface Props {
  fecha?: string | null
  className?: string
}

/** Indica la vigencia de los datos: cuándo se importaron por última vez las notas desde Moodle. */
export function FechaSincronizacionMoodle({ fecha, className = '' }: Props) {
  const valor = fecha ? new Date(fecha) : null
  const valida = valor !== null && !Number.isNaN(valor.getTime())
  return (
    <span className={`text-[11px] text-[#52525b] ${className}`} role="status">
      {valida
        ? `Notas de Moodle al ${valor.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}`
        : 'Notas aún no sincronizadas desde Moodle'}
    </span>
  )
}
