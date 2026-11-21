import { useState, useMemo } from 'react'
import { BarChart3, Users, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import type { ResumenAcademicoEstudianteDto } from '../types/academico'

export interface RangoRendimiento {
  id: 'critico' | 'riesgo' | 'regular' | 'sobresaliente'
  etiqueta: string
  subtitulo: string
  min: number
  max: number
  colorBarra: string
  colorFondo: string
  colorTexto: string
  colorBorde: string
  cantidad: number
  porcentaje: number
  estudiantes: ResumenAcademicoEstudianteDto[]
}

interface RendimientoBarChartProps {
  estudiantes: ResumenAcademicoEstudianteDto[]
  materiaNombre?: string
  cargando?: boolean
  onSeleccionarEstudiante?: (estudiante: ResumenAcademicoEstudianteDto) => void
}

export function RendimientoBarChart({
  estudiantes,
  materiaNombre = 'Asignatura Seleccionada',
  cargando = false,
  onSeleccionarEstudiante,
}: RendimientoBarChartProps) {
  const [rangoActivo, setRangoActivo] = useState<string | null>(null)

  const rangos: RangoRendimiento[] = useMemo(() => {
    const total = estudiantes.length

    const criticos = estudiantes.filter(
      (e) => e.notaFinalParcial >= 0 && e.notaFinalParcial < 4.0
    )
    const enRiesgo = estudiantes.filter(
      (e) => e.notaFinalParcial >= 4.0 && e.notaFinalParcial < 7.0
    )
    const regulares = estudiantes.filter(
      (e) => e.notaFinalParcial >= 7.0 && e.notaFinalParcial < 8.5
    )
    const sobresalientes = estudiantes.filter(
      (e) => e.notaFinalParcial >= 8.5 && e.notaFinalParcial <= 10.0
    )

    return [
      {
        id: 'critico',
        etiqueta: 'Crítico',
        subtitulo: '0.00 – 3.99 pts',
        min: 0.0,
        max: 3.99,
        colorBarra: 'bg-red-600',
        colorFondo: 'bg-red-50',
        colorTexto: 'text-red-700',
        colorBorde: 'border-red-200',
        cantidad: criticos.length,
        porcentaje: total > 0 ? Number(((criticos.length / total) * 100).toFixed(1)) : 0,
        estudiantes: criticos,
      },
      {
        id: 'riesgo',
        etiqueta: 'En Riesgo',
        subtitulo: '4.00 – 6.99 pts',
        min: 4.0,
        max: 6.99,
        colorBarra: 'bg-amber-500',
        colorFondo: 'bg-amber-50',
        colorTexto: 'text-amber-800',
        colorBorde: 'border-amber-200',
        cantidad: enRiesgo.length,
        porcentaje: total > 0 ? Number(((enRiesgo.length / total) * 100).toFixed(1)) : 0,
        estudiantes: enRiesgo,
      },
      {
        id: 'regular',
        etiqueta: 'Regular',
        subtitulo: '7.00 – 8.49 pts',
        min: 7.0,
        max: 8.49,
        colorBarra: 'bg-blue-600',
        colorFondo: 'bg-blue-50',
        colorTexto: 'text-blue-800',
        colorBorde: 'border-blue-200',
        cantidad: regulares.length,
        porcentaje: total > 0 ? Number(((regulares.length / total) * 100).toFixed(1)) : 0,
        estudiantes: regulares,
      },
      {
        id: 'sobresaliente',
        etiqueta: 'Sobresaliente',
        subtitulo: '8.50 – 10.00 pts',
        min: 8.5,
        max: 10.0,
        colorBarra: 'bg-emerald-600',
        colorFondo: 'bg-emerald-50',
        colorTexto: 'text-emerald-800',
        colorBorde: 'border-emerald-200',
        cantidad: sobresalientes.length,
        porcentaje: total > 0 ? Number(((sobresalientes.length / total) * 100).toFixed(1)) : 0,
        estudiantes: sobresalientes,
      },
    ]
  }, [estudiantes])

  const totalEstudiantes = estudiantes.length

  const detalleSeleccionado = useMemo(
    () => rangos.find((r) => r.id === rangoActivo) || null,
    [rangos, rangoActivo]
  )

  const tasaAprobacion = useMemo(() => {
    if (totalEstudiantes === 0) return 0
    const aprobados = estudiantes.filter((e) => e.notaFinalParcial >= 7.0).length
    return Number(((aprobados / totalEstudiantes) * 100).toFixed(1))
  }, [estudiantes, totalEstudiantes])

  return (
    <div className="bg-white rounded-md border border-[#e4e4e7] overflow-hidden shadow-xs">
      {/* Encabezado del Gráfico */}
      <div className="p-4 border-b border-[#e4e4e7] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#8B151A]/10 text-[#8B151A] rounded">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-[#18181b]">
              Distribución de Rendimiento Académico
            </h2>
            <p className="text-[11px] text-[#71717a]">
              {materiaNombre} • Clasificación en 4 rangos pedagógicos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-[#52525b]">
            <Users className="w-3.5 h-3.5 text-[#71717a]" />
            <span className="font-semibold text-[#18181b]">{totalEstudiantes}</span> estudiantes
          </span>
          <span className="text-[#d4d4d8]">|</span>
          <span className="flex items-center gap-1.5 text-xs">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[#52525b]">Aprobación:</span>
            <span className="font-bold text-emerald-700">{tasaAprobacion}%</span>
          </span>
        </div>
      </div>

      {/* Cuerpo del Gráfico Interactivo */}
      <div className="p-5">
        {cargando ? (
          <div className="py-12 text-center text-xs text-[#71717a]">
            Cargando métricas de rendimiento...
          </div>
        ) : totalEstudiantes === 0 ? (
          <div className="py-12 text-center text-xs text-[#71717a] flex flex-col items-center gap-2">
            <Info className="w-5 h-5 text-[#a1a1aa]" />
            <p>No se encontraron calificaciones registradas para esta asignatura.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Gráfico de Barras Verticales con interacción */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
              {rangos.map((rango) => {
                const estaSeleccionado = rangoActivo === rango.id

                return (
                  <div
                    key={rango.id}
                    onClick={() =>
                      setRangoActivo(estaSeleccionado ? null : rango.id)
                    }
                    className={`cursor-pointer rounded-lg border p-3 transition-all duration-150 flex flex-col justify-between ${
                      rango.colorFondo
                    } ${
                      estaSeleccionado
                        ? 'ring-2 ring-[#8B151A] shadow-sm ' + rango.colorBorde
                        : 'border-[#e4e4e7] hover:border-[#a1a1aa]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${rango.colorTexto}`}>
                          {rango.etiqueta}
                        </span>
                        <span className="text-[10px] font-mono text-[#71717a]">
                          {rango.subtitulo}
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-xl font-bold text-[#18181b]">
                          {rango.cantidad}
                        </span>
                        <span className="text-xs font-semibold text-[#71717a]">
                          ({rango.porcentaje}%)
                        </span>
                      </div>
                    </div>

                    {/* Barra visual vertical simulada */}
                    <div className="mt-3 w-full bg-white/70 rounded-full h-2.5 overflow-hidden border border-[#e4e4e7]/60">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${rango.colorBarra}`}
                        style={{ width: `${rango.porcentaje}%` }}
                      />
                    </div>

                    <p className="mt-2 text-[10px] text-[#71717a] text-center">
                      {estaSeleccionado ? 'Haz clic para ocultar' : 'Ver detalle →'}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Barra Continua Comparativa (100% de la clase) */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-[11px] text-[#71717a] mb-1.5">
                <span>Composición global del curso (100%)</span>
                <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <AlertTriangle className="w-3 h-3" />
                  Umbral mínimo de aprobación: 7.00 pts
                </span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden flex bg-gray-100 border border-[#e4e4e7]">
                {rangos.map((r) =>
                  r.porcentaje > 0 ? (
                    <div
                      key={r.id}
                      className={`${r.colorBarra} transition-all duration-300 relative group cursor-pointer`}
                      style={{ width: `${r.porcentaje}%` }}
                      title={`${r.etiqueta}: ${r.cantidad} (${r.porcentaje}%)`}
                      onClick={() => setRangoActivo(rangoActivo === r.id ? null : r.id)}
                    />
                  ) : null
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px] text-[#52525b]">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                    Crítico (&lt;4.0)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    En Riesgo (4.0-6.9)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                    Regular (7.0-8.4)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                    Sobresaliente (8.5-10)
                  </span>
                </div>
              </div>
            </div>

            {/* Detalle expandido del rango interactivo seleccionado */}
            {detalleSeleccionado && (
              <div className="p-3.5 bg-[#fafafa] rounded-md border border-[#e4e4e7] animate-fadeIn text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-[#18181b]">
                    Estudiantes en rango {detalleSeleccionado.etiqueta} ({detalleSeleccionado.subtitulo}):
                  </span>
                  <span className="text-[11px] text-[#71717a]">
                    {detalleSeleccionado.cantidad} de {totalEstudiantes} estudiantes
                  </span>
                </div>

                {detalleSeleccionado.estudiantes.length === 0 ? (
                  <p className="text-[#71717a] italic">No hay alumnos en este rango.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {detalleSeleccionado.estudiantes.map((est) => (
                      <div
                        key={est.estudianteId}
                        onClick={() => onSeleccionarEstudiante?.(est)}
                        className={`p-2 bg-white rounded border border-[#e4e4e7] flex items-center justify-between gap-2 transition ${
                          onSeleccionarEstudiante ? 'cursor-pointer hover:border-[#8B151A] hover:bg-[#8B151A]/5' : ''
                        }`}
                      >
                        <div className="truncate">
                          <p className="font-medium text-[#18181b] truncate">
                            {est.apellidos} {est.nombres}
                          </p>
                          <p className="text-[10px] text-[#71717a] truncate">{est.correo}</p>
                        </div>
                        <span
                          className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                            est.enRiesgo ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {est.notaFinalParcial.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default RendimientoBarChart
