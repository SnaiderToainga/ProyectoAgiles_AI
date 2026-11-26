import { useState, useMemo } from 'react'
import { Info } from 'lucide-react'
import { AvatarEstudiante } from './AvatarEstudiante'
import { type ResumenAcademicoEstudianteDto } from '../types/academico'
import { estaEvaluado, textoNotaFinal } from '../utils/estadoCalificacion'

export interface RangoRendimiento {
  id: 'critico' | 'riesgo' | 'regular' | 'sobresaliente'
  etiqueta: string
  subtitulo: string
  min: number
  max: number
  colorHex: string
  cantidad: number
  porcentaje: number
  estudiantes: ResumenAcademicoEstudianteDto[]
}

export interface PuntoTendencia {
  nombre: string
  promedio: number
}

interface RendimientoBarChartProps {
  estudiantes: ResumenAcademicoEstudianteDto[]
  materiaNombre?: string
  cargando?: boolean
  tendencia?: PuntoTendencia[]
  onSeleccionarEstudiante?: (estudiante: ResumenAcademicoEstudianteDto) => void
}

export function RendimientoBarChart({
  estudiantes,
  materiaNombre: _materiaNombre = 'Asignatura Seleccionada',
  cargando = false,
  tendencia = [],
  onSeleccionarEstudiante,
}: RendimientoBarChartProps) {
  const [rangoActivo, setRangoActivo] = useState<string | null>(null)
  const [modo, setModo] = useState<'ranges' | 'trend'>('ranges')

  // Solo se clasifican estudiantes con actividades evaluadas: sin notas no son "Crítico" con 0.00.
  const evaluados = useMemo(() => estudiantes.filter(estaEvaluado), [estudiantes])
  const sinEvaluar = estudiantes.length - evaluados.length

  const rangos: RangoRendimiento[] = useMemo(() => {
    const total = evaluados.length
    const pct = (n: number) => (total > 0 ? Number(((n / total) * 100).toFixed(1)) : 0)

    const criticos = evaluados.filter((e) => e.notaFinalParcial >= 0 && e.notaFinalParcial < 4.0)
    const enRiesgo = evaluados.filter((e) => e.notaFinalParcial >= 4.0 && e.notaFinalParcial < 7.0)
    const regulares = evaluados.filter((e) => e.notaFinalParcial >= 7.0 && e.notaFinalParcial < 8.5)
    const sobresalientes = evaluados.filter((e) => e.notaFinalParcial >= 8.5 && e.notaFinalParcial <= 10.0)

    return [
      { id: 'critico', etiqueta: 'Crítico', subtitulo: '< 4.0', min: 0, max: 3.99, colorHex: '#991b1b', cantidad: criticos.length, porcentaje: pct(criticos.length), estudiantes: criticos },
      { id: 'riesgo', etiqueta: 'En riesgo', subtitulo: '4.0 – 6.9', min: 4, max: 6.99, colorHex: '#d97706', cantidad: enRiesgo.length, porcentaje: pct(enRiesgo.length), estudiantes: enRiesgo },
      { id: 'regular', etiqueta: 'Regular', subtitulo: '7.0 – 8.4', min: 7, max: 8.49, colorHex: '#18181b', cantidad: regulares.length, porcentaje: pct(regulares.length), estudiantes: regulares },
      { id: 'sobresaliente', etiqueta: 'Sobresaliente', subtitulo: '8.5 – 10', min: 8.5, max: 10, colorHex: '#15803d', cantidad: sobresalientes.length, porcentaje: pct(sobresalientes.length), estudiantes: sobresalientes },
    ]
  }, [evaluados])

  const totalEstudiantes = evaluados.length
  const maxCantidad = Math.max(1, ...rangos.map((r) => r.cantidad))

  const detalleSeleccionado = useMemo(
    () => rangos.find((r) => r.id === rangoActivo) || null,
    [rangos, rangoActivo]
  )

  const tasaAprobacion = useMemo(() => {
    if (totalEstudiantes === 0) return 0
    const aprobados = evaluados.filter((e) => e.notaFinalParcial >= 7.0).length
    return Number(((aprobados / totalEstudiantes) * 100).toFixed(1))
  }, [evaluados, totalEstudiantes])

  // Geometría de la gráfica de tendencia (escala 0–10)
  const W = 520
  const H = 190
  const PAD = { l: 28, r: 12, t: 14, b: 34 }
  const puntos = tendencia.map((p, i) => {
    const x = tendencia.length <= 1
      ? PAD.l + (W - PAD.l - PAD.r) / 2
      : PAD.l + (i * (W - PAD.l - PAD.r)) / (tendencia.length - 1)
    const y = PAD.t + (1 - Math.min(10, Math.max(0, p.promedio)) / 10) * (H - PAD.t - PAD.b)
    return { x, y, ...p }
  })
  const yUmbral = PAD.t + (1 - 7 / 10) * (H - PAD.t - PAD.b)

  return (
    <div className="em-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="em-card-head">
        <h2 className="card-title">Rendimiento del Curso</h2>
        <div className="parcial-tabs">
          <button
            type="button"
            className={`parcial-tab ${modo === 'ranges' ? 'active' : ''}`}
            onClick={() => setModo('ranges')}
          >
            4 Rangos
          </button>
          <button
            type="button"
            className={`parcial-tab ${modo === 'trend' ? 'active' : ''}`}
            onClick={() => setModo('trend')}
          >
            Tendencia
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="py-12 text-center text-xs text-black">Cargando métricas de rendimiento...</div>
      ) : totalEstudiantes === 0 ? (
        <div className="py-12 text-center text-xs text-black flex flex-col items-center gap-2">
          <Info className="w-5 h-5 text-black" />
          <p>
            {sinEvaluar > 0
              ? `Ninguno de los ${sinEvaluar} estudiantes tiene actividades calificadas y publicadas en este parcial.`
              : 'No se encontraron calificaciones registradas para esta asignatura.'}
          </p>
        </div>
      ) : modo === 'ranges' ? (
        <div className="space-y-4">
          <div className="relative h-48 flex items-end justify-around gap-3 pt-6 pb-2 border-b border-[#e5e7eb]">
            <div className="pointer-events-none absolute inset-x-0 top-6 bottom-2 flex flex-col justify-between">
              {[1, 0.5, 0].map((frac) => (
                <div key={frac} className="w-full border-t border-dashed border-[#eef0f3] relative">
                  <span className="absolute -top-2.5 left-0 text-[10px] tabular-nums text-black">
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
                  <span className="text-[11px] font-bold text-black mb-1 tabular-nums">
                    {rango.cantidad}{' '}
                    <span className="font-normal text-[10px]">({rango.porcentaje}%)</span>
                  </span>
                  <div
                    className={`w-12 sm:w-14 transition-all duration-300 ${
                      estaSeleccionado ? 'ring-2 ring-offset-2 ring-black' : 'opacity-90 group-hover:opacity-100'
                    }`}
                    style={{ height: `${alturaPct}%`, backgroundColor: rango.colorHex }}
                  />
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            {rangos.map((rango) => (
              <button
                key={rango.id}
                type="button"
                onClick={() => setRangoActivo(rangoActivo === rango.id ? null : rango.id)}
                className="p-1 cursor-pointer hover:bg-[#f4f5f7]"
              >
                <p className="text-[11.5px] font-bold" style={{ color: rango.colorHex }}>
                  {rango.etiqueta}
                </p>
                <p className="text-[10.5px] tabular-nums text-black">{rango.subtitulo}</p>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs text-black">
            <span>
              <strong className="tabular-nums">{totalEstudiantes}</strong> alumnos
              {sinEvaluar > 0 && ` (+${sinEvaluar} sin evaluaciones)`}
            </span>
            <span>·</span>
            <span>
              Aprobación: <strong className="text-[#15803d] tabular-nums">{tasaAprobacion}%</strong>
            </span>
          </div>

          {detalleSeleccionado && (
            <div className="p-3 bg-[#fafafa] border border-[#e5e7eb] text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-black">
                  Estudiantes en rango {detalleSeleccionado.etiqueta} ({detalleSeleccionado.subtitulo}):
                </span>
                <span className="text-black tabular-nums">
                  {detalleSeleccionado.cantidad} de {totalEstudiantes}
                </span>
              </div>

              {detalleSeleccionado.estudiantes.length === 0 ? (
                <p className="text-black italic">No hay alumnos en este rango.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {detalleSeleccionado.estudiantes.map((est) => (
                    <div
                      key={est.estudianteId}
                      onClick={() => onSeleccionarEstudiante?.(est)}
                      className={`p-2 bg-white border border-[#e5e7eb] flex items-center justify-between gap-2 ${
                        onSeleccionarEstudiante ? 'cursor-pointer hover:border-black' : ''
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
                          <p className="font-medium text-black truncate">
                            {est.apellidos} {est.nombres}
                          </p>
                          <p className="text-[10.5px] text-black truncate">{est.correo}</p>
                        </div>
                      </div>
                      <span
                        className={`badge-clean tabular-nums ${est.enRiesgo ? 'risk' : 'ok'}`}
                      >
                        {textoNotaFinal(est)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          {puntos.length === 0 ? (
            <div className="py-12 text-center text-xs text-black">
              Aún no hay actividades publicadas para calcular la tendencia.
            </div>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Tendencia de promedio por actividad">
              {[0, 5, 10].map((v) => {
                const y = PAD.t + (1 - v / 10) * (H - PAD.t - PAD.b)
                return (
                  <g key={v}>
                    <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#eef0f3" strokeDasharray="3 3" />
                    <text x={PAD.l - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#000">{v}</text>
                  </g>
                )
              })}
              <line x1={PAD.l} x2={W - PAD.r} y1={yUmbral} y2={yUmbral} stroke="#8b151a" strokeDasharray="4 3" />
              <text x={W - PAD.r} y={yUmbral - 4} textAnchor="end" fontSize="10" fill="#8b151a">7.00</text>
              <polyline
                fill="none"
                stroke="#18181b"
                strokeWidth="2"
                points={puntos.map((p) => `${p.x},${p.y}`).join(' ')}
              />
              {puntos.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="3.5" fill={p.promedio < 7 ? '#8b151a' : '#18181b'} />
                  <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fontWeight="600" fill="#000">
                    {p.promedio.toFixed(1)}
                  </text>
                  <text x={p.x} y={H - 12} textAnchor="middle" fontSize="9.5" fill="#000">
                    {p.nombre.length > 14 ? `${p.nombre.slice(0, 13)}…` : p.nombre}
                  </text>
                </g>
              ))}
            </svg>
          )}
        </div>
      )}
    </div>
  )
}

export default RendimientoBarChart
