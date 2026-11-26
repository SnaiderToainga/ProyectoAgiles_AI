import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import clienteAxios from '../api/clienteAxios'
import { mensajeDeError } from '../api/usuariosService'
import type { AlertasCursoDto, ConfiguracionAlertasDto, IndicadoresProgresoDto } from '../types/academico'

interface Props {
  materiaId: number
  parcialId: number
  parcialNumero: number
}

const CLASE_REGLA: Record<string, string> = {
  rendimiento: 'badge-clean bad',
  descenso: 'badge-clean warn',
  atrasos: 'badge-clean warn',
  finalizacion: 'badge-clean warn',
}

function textoProgreso(p: IndicadoresProgresoDto): string {
  if (p.porcentajeFinalizacion === null) return 'Aún no hay actividades exigibles'
  return `${p.porcentajeFinalizacion.toFixed(1)} % (${p.completadas} de ${p.exigibles} entregas exigibles)`
}

/**
 * Alertas académicas explicables (RF-07) y progreso de entregas (RF-05/RF-06).
 * Las reglas se evalúan en la API de forma determinista; el docente decide su configuración.
 */
export function AlertasAcademicasPanel({ materiaId, parcialId, parcialNumero }: Props) {
  const [datos, setDatos] = useState<AlertasCursoDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<ConfiguracionAlertasDto | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [expandido, setExpandido] = useState(false)

  const consultar = useCallback(
    () =>
      clienteAxios
        .get<AlertasCursoDto>(`/academico/materias/${materiaId}/parciales/${parcialId}/alertas`)
        .then(({ data }) => {
          setDatos(data)
          setError(null)
        })
        .catch((e: unknown) => setError(mensajeDeError(e, 'No se pudieron calcular las alertas académicas.'))),
    [materiaId, parcialId]
  )

  useEffect(() => {
    void consultar()
  }, [consultar])

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (!editando) return
    setGuardando(true)
    try {
      await clienteAxios.put(`/academico/materias/${materiaId}/configuracion-alertas`, editando)
      setEditando(null)
      await consultar()
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo guardar la configuración de alertas.'))
    } finally {
      setGuardando(false)
    }
  }

  const conAlertas = datos?.estudiantes.filter((e) => e.alertas.length > 0) ?? []
  const visibles = expandido ? conAlertas : conAlertas.slice(0, 5)
  const p = datos?.progresoCurso

  return (
    <section className="em-card">
      <div className="em-card-head">
        <div>
          <h2 className="card-title">Alertas académicas · Parcial {parcialNumero}</h2>
          <p className="card-sub">
            Reglas {datos?.configuracionPersonalizada ? 'configuradas por el docente' : 'predeterminadas'}. Son
            orientativas: señalan qué revisar, no constituyen un diagnóstico del estudiante.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={!datos}
          onClick={() => datos && setEditando(editando ? null : { ...datos.configuracion })}
        >
          {editando ? 'Cancelar' : 'Configurar reglas'}
        </button>
      </div>

      <div className="em-card-body space-y-4">
        {error && (
          <p role="alert" className="text-xs text-[#b91c1c]">
            {error}
          </p>
        )}

        {editando && (
          <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-2 p-3 border border-[#e5e7eb] bg-[#fafafa] text-xs">
            <ReglaCampo
              activo={editando.rendimientoActivo}
              onActivo={(v) => setEditando({ ...editando, rendimientoActivo: v })}
              titulo="Rendimiento bajo el umbral"
            >
              Nota del parcial menor que{' '}
              <NumeroCampo valor={editando.rendimientoUmbral} min={1} max={10} paso={0.5}
                onCambio={(v) => setEditando({ ...editando, rendimientoUmbral: v })} />
            </ReglaCampo>
            <ReglaCampo
              activo={editando.descensoActivo}
              onActivo={(v) => setEditando({ ...editando, descensoActivo: v })}
              titulo="Descenso en las últimas evaluaciones"
            >
              Las últimas{' '}
              <NumeroCampo valor={editando.descensoUltimas} min={1} max={5} paso={1}
                onCambio={(v) => setEditando({ ...editando, descensoUltimas: v })} />{' '}
              bajan al menos{' '}
              <NumeroCampo valor={editando.descensoPuntos} min={0.5} max={10} paso={0.5}
                onCambio={(v) => setEditando({ ...editando, descensoPuntos: v })} />{' '}
              puntos frente a las anteriores
            </ReglaCampo>
            <ReglaCampo
              activo={editando.atrasosActivo}
              onActivo={(v) => setEditando({ ...editando, atrasosActivo: v })}
              titulo="Actividades vencidas sin entrega"
            >
              Al menos{' '}
              <NumeroCampo valor={editando.atrasosMinimo} min={1} max={20} paso={1}
                onCambio={(v) => setEditando({ ...editando, atrasosMinimo: v })} />{' '}
              actividades vencidas
            </ReglaCampo>
            <ReglaCampo
              activo={editando.finalizacionActivo}
              onActivo={(v) => setEditando({ ...editando, finalizacionActivo: v })}
              titulo="Baja finalización"
            >
              Completó menos del{' '}
              <NumeroCampo valor={editando.finalizacionMinimaPct} min={1} max={100} paso={5}
                onCambio={(v) => setEditando({ ...editando, finalizacionMinimaPct: v })} />{' '}
              % de las entregas exigibles
            </ReglaCampo>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" className="btn-primary disabled:opacity-60" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar reglas'}
              </button>
            </div>
          </form>
        )}

        {p && (
          <div className="grid gap-2 sm:grid-cols-4 text-xs">
            <Indicador etiqueta="Finalización del curso" valor={textoProgreso(p)} />
            <Indicador etiqueta="Calificadas" valor={String(p.calificadas)} />
            <Indicador etiqueta="Pendientes de calificar" valor={String(p.pendientesCalificar)} />
            <Indicador etiqueta="Vencidas sin entrega / por entregar" valor={`${p.sinEntrega} / ${p.pendientesEntrega}`} />
          </div>
        )}

        {!datos && !error ? (
          <p className="text-xs text-[#71717a]">Calculando alertas…</p>
        ) : datos && conAlertas.length === 0 ? (
          <p className="text-xs text-[#52525b]">Ninguna regla configurada se activa en este parcial.</p>
        ) : (
          <ul className="divide-y divide-[#f4f4f5]">
            {visibles.map((e) => (
              <li key={e.estudianteId} className="py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-black text-sm">
                    {e.apellidos} {e.nombres}
                  </span>
                  <span className="text-[11px] text-[#52525b] tabular-nums">
                    {e.sinEvaluaciones ? 'Sin evaluaciones' : `Nota ${e.notaFinalParcial.toFixed(2)}`} · Finalización{' '}
                    {e.indicadores.porcentajeFinalizacion === null
                      ? '—'
                      : `${e.indicadores.porcentajeFinalizacion.toFixed(0)} %`}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {e.alertas.map((a) => (
                    <li key={a.regla} className="text-xs text-[#3f3f46]">
                      <span className={CLASE_REGLA[a.regla] ?? 'badge-clean warn'}>{a.titulo}</span>{' '}
                      {a.evidencia}
                      {a.actividades.length > 0 && (
                        <span className="text-[#71717a]"> Actividades: {a.actividades.join(', ')}.</span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {conAlertas.length > 5 && (
          <button type="button" className="text-xs font-semibold text-[#8B151A]" onClick={() => setExpandido(!expandido)}>
            {expandido ? 'Mostrar menos' : `Ver las ${conAlertas.length} alertas`}
          </button>
        )}
      </div>
    </section>
  )
}

function Indicador({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="p-2.5 border border-[#e5e7eb]">
      <div className="text-[10px] uppercase tracking-[0.04em] text-[#71717a]">{etiqueta}</div>
      <div className="text-black font-semibold tabular-nums">{valor}</div>
    </div>
  )
}

function ReglaCampo({
  activo,
  onActivo,
  titulo,
  children,
}: {
  activo: boolean
  onActivo: (v: boolean) => void
  titulo: string
  children: ReactNode
}) {
  return (
    <fieldset className={`p-2.5 border border-[#e5e7eb] bg-white ${activo ? '' : 'opacity-60'}`}>
      <label className="flex items-center gap-2 font-semibold text-black">
        <input type="checkbox" checked={activo} onChange={(e) => onActivo(e.target.checked)} />
        {titulo}
      </label>
      <div className="mt-1.5 text-[#52525b] leading-7">{children}</div>
    </fieldset>
  )
}

function NumeroCampo({
  valor,
  min,
  max,
  paso,
  onCambio,
}: {
  valor: number
  min: number
  max: number
  paso: number
  onCambio: (v: number) => void
}) {
  return (
    <input
      type="number"
      value={valor}
      min={min}
      max={max}
      step={paso}
      required
      onChange={(e) => onCambio(Number(e.target.value))}
      className="w-16 px-1.5 py-0.5 border border-[#d4d4d8] text-black tabular-nums"
    />
  )
}
