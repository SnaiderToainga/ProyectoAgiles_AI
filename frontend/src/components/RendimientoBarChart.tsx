import { useState, useMemo } from 'react'
import { BarChart3, Users, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { AvatarEstudiante } from './AvatarEstudiante'
import { NOMBRE_COMPONENTE, type ResumenAcademicoEstudianteDto } from '../types/academico'

export interface RangoRendimiento {
  id: 'critico' | 'riesgo' | 'regular' | 'sobresaliente'
  etiqueta: string
  subtitulo: string
  min: number
  max: number
  colorHex: string
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
        subtitulo: '0.00 - 3.99',
        min: 0.0,
        max: 3.99,
        colorHex: '#dc2626',
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
        subtitulo: '4.00 - 6.99',
        min: 4.0,
        max: 6.99,
        colorHex: '#f59e0b',
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
        subtitulo: '7.00 - 8.49',
        min: 7.0,
        max: 8.49,
        colorHex: '#2563eb',
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
        subtitulo: '8.50 - 10.0',
        min: 8.5,
        max: 10.0,
        colorHex: '#059669',
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
  const maxCantidad = Math.max(1, ...rangos.map((r) => r.cantidad))

  const promediosComponentes = useMemo(() => {
    if (estudiantes.length === 0) return []
    return ([1, 2, 3] as const).map((tipo) => {
      const valores = estudiantes.map(
        (e) => e.componentes.find((c) => c.tipo === tipo)?.promedioComponente ?? 0
      )
      const promedio = valores.reduce((a, b) => a + b, 0) / valores.length
      const peso = tipo === 3 ? '40%' : '30%'
      return {
        tipo,
        nombre: NOMBRE_COMPONENTE[tipo],
        peso,
        promedio: Number(promedio.toFixed(2)),
        bajoUmbral: promedio < 7.0,
      }
    })
  }, [estudiantes])

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
    <div className="bg-white rounded-lg border border-[#e4e4e7] overflow-hidden shadow-xs">
      {/* Encabezado */}
      <div className="p-4 border-b border-[#e4e4e7] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#8B151A]/10 text-[#8B151A] rounded">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-[#18181b]">
              Estadísticas y Distribución de Rendimiento
            </h2>
            <p className="text-[11px] text-[#71717a]">
              {materiaNombre} • Haz clic en una barra para ver sus estudiantes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-[#52525b]">
            <Users className="w-3.5 h-3.5 text-[#71717a]" />
            <span className="font-semibold text-[#18181b]">{totalEstudiantes}</span> alumnos
          </span>
          <span className="text-[#d4d4d8]">|</span>
          <span className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[#52525b]">Aprobación:</span>
            <span className="font-bold text-emerald-700">{tasaAprobacion}%</span>
          </span>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="p-4 sm:p-5">
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
          <div className="space-y-5">
            {/* Gráfico de Barras Verticales Real + Leyenda Cuantitativa */}
            <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#18181b]">
                  Estudiantes por Rango Pedagógico
                </span>
                <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Aprobación mínima: 7.00 pts
                </span>
              </div>

              <div className="relative h-44 flex items-end justify-around gap-3 pt-6 pb-2 border-b border-[#d4d4d8]">
                {/* Líneas guía horizontales */}
                <div className="pointer-events-none absolute inset-x-0 top-6 bottom-2 flex flex-col justify-between">
                  {[1, 0.5, 0].map((frac) => (
                    <div
                      key={frac}
                      className="w-full border-t border-dashed border-[#e4e4e7] relative"
                    >
                      <span className="absolute -top-2.5 left-0 text-[9px] font-mono text-[#a1a1aa]">
                        {Math.round(maxCantidad * frac)}
                      </span>
                    </div>
                  ))}
                </div>

                {rangos.map((rango) => {
                  const alturaPct =
                    rango.cantidad === 0 ? 4 : Math.max(12, Math.round((rango.cantidad / maxCantidad) * 100))
                  const estaSeleccionado = rangoActivo === rango.id

                  return (
                    <button
                      key={rango.id}
                      type="button"
                      onClick={() => setRangoActivo(estaSeleccionado ? null : rango.id)}
                      className="relative z-10 flex-1 max-w-[110px] h-full flex flex-col items-center justify-end group cursor-pointer focus:outline-none"
                    >
                      <span className="text-[11px] font-bold text-[#18181b] mb-1">
                        {rango.cantidad}{' '}
                        <span className="font-normal text-[10px] text-[#71717a]">
                          ({rango.porcentaje}%)
                        </span>
                      </span>
                      <div
                        className={`w-12 sm:w-14 rounded-t-md transition-all duration-300 ${
                          estaSeleccionado
                            ? 'ring-2 ring-offset-2 ring-[#8B151A] opacity-100'
                            : 'opacity-90 group-hover:opacity-100'
                        }`}
                        style={{
                          height: `${alturaPct}%`,
                          backgroundColor: rango.colorHex,
                        }}
                      />
                    </button>
                  )
                })}
              </div>

              {/* Etiquetas inferiores clicables */}
              <div className="grid grid-cols-4 gap-2 pt-2.5 text-center">
                {rangos.map((rango) => {
                  const estaSeleccionado = rangoActivo === rango.id
                  return (
                    <button
                      key={rango.id}
                      type="button"
                      onClick={() => setRangoActivo(estaSeleccionado ? null : rango.id)}
                      className={`rounded p-1.5 transition cursor-pointer ${
                        estaSeleccionado ? 'bg-white border border-[#8B151A]/40 shadow-xs' : 'hover:bg-white'
                      }`}
                    >
                      <p className={`text-[11px] font-bold ${rango.colorTexto}`}>
                        {rango.etiqueta}
                      </p>
                      <p className="text-[10px] font-mono text-[#71717a]">{rango.subtitulo}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Gráfico Comparativo de Componentes 30/30/40 */}
            <div className="bg-white border border-[#e4e4e7] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#18181b]">
                  Desempeño Promedio por Componente Evaluativo (30/30/40)
                </span>
                <span className="text-[10px] text-[#71717a]">Escala 0.00 a 10.00</span>
              </div>

              <div className="space-y-2.5">
                {promediosComponentes.map((comp) => {
                  const ancho = Math.min(100, Math.max(0, (comp.promedio / 10) * 100))
                  const colorBar =
                    comp.promedio >= 8.5
                      ? 'bg-emerald-600'
                      : comp.promedio >= 7.0
                      ? 'bg-blue-600'
                      : comp.promedio >= 4.0
                      ? 'bg-amber-500'
                      : 'bg-red-600'

                  return (
                    <div key={comp.tipo} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#27272a]">
                          {comp.nombre}{' '}
                          <span className="text-[10px] text-[#71717a]">({comp.peso})</span>
                        </span>
                        <span
                          className={`font-bold font-mono ${
                            comp.bajoUmbral ? 'text-red-700' : 'text-[#18181b]'
                          }`}
                        >
                          {comp.promedio.toFixed(2)} / 10
                        </span>
                      </div>
                      <div className="relative w-full h-2.5 bg-[#f4f4f5] rounded-full overflow-hidden border border-[#e4e4e7]">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${colorBar}`}
                          style={{ width: `${ancho}%` }}
                        />
                        {/* Marca de umbral 7.00 (70%) */}
                        <div
                          title="Umbral mínimo 7.00"
                          className="absolute top-0 bottom-0 w-0.5 bg-[#18181b]/50"
                          style={{ left: '70%' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Detalle expandido del rango interactivo seleccionado */}
            {detalleSeleccionado && (
              <div className="p-3.5 bg-[#fafafa] rounded-md border border-[#e4e4e7] text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-[#18181b]">
                    Estudiantes en rango {detalleSeleccionado.etiqueta} ({detalleSeleccionado.subtitulo}):
                  </span>
                  <span className="text-[11px] text-[#71717a]">
                    {detalleSeleccionado.cantidad} de {totalEstudiantes} alumnos
                  </span>
                </div>

                {detalleSeleccionado.estudiantes.length === 0 ? (
                  <p className="text-[#71717a] italic">No hay alumnos en este rango.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {detalleSeleccionado.estudiantes.map((est) => (
                      <div
                        key={est.estudianteId}
                        onClick={() => onSeleccionarEstudiante?.(est)}
                        className={`p-2 bg-white rounded border border-[#e4e4e7] flex items-center justify-between gap-2 transition ${
                          onSeleccionarEstudiante
                            ? 'cursor-pointer hover:border-[#8B151A] hover:bg-[#8B151A]/5'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <AvatarEstudiante
                            nombres={est.nombres}
                            apellidos={est.apellidos}
                            fotoUrl={est.fotoUrl}
                            enRiesgo={est.enRiesgo}
                            size="sm"
                          />
                          <div className="truncate">
                            <p className="font-medium text-[#18181b] truncate">
                              {est.apellidos} {est.nombres}
                            </p>
                            <p className="text-[10px] text-[#71717a] truncate">{est.correo}</p>
                          </div>
                        </div>
                        <span
                          className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] shrink-0 ${
                            est.enRiesgo
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-800'
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
