import { useEffect, useState } from 'react'
import Ic from '../admin/dashboard/Ic.jsx'
import { embudoAutoApi } from '../../lib/supabase.js'
import { etapasDelEmbudo, nombreEmbudo } from '../../lib/embudo.js'

const CAMPO = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500'
const ETIQUETA = 'mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400'

// Las dos automatizaciones que se ofrecen listas para activar
const SUGERIDAS = [
  {
    id: 'seguimiento',
    embudo: 'paquetes',
    etapa: 'propuesta_enviada',
    titulo: 'Seguimiento después de enviar la propuesta',
    tipo: 'recordatorio',
    dias: 2,
    nota: 'Consultar si vio la propuesta',
    explicacion: 'Cuando un lead entra a «{etapa}», se crea solo un recordatorio para dos días después: «Consultar si vio la propuesta». Ningún lead se queda sin próximo paso: el punto naranja de la tarjeta pasa a verde.',
  },
  {
    id: 'asignacion',
    embudo: 'paquetes',
    etapa: 'negociacion',
    titulo: 'Asignar cuando empieza la negociación',
    tipo: 'asignar',
    explicacion: 'Cuando un lead entra a «{etapa}», queda asignado a la persona que elijas y su inicial aparece en la tarjeta.',
  },
  {
    id: 'seguimiento_paseos',
    embudo: 'paseos',
    etapa: 'paseos_oferta_hecha',
    titulo: 'Seguimiento después de hacer la oferta',
    tipo: 'recordatorio',
    dias: 1,
    nota: 'Consultar si vio la oferta',
    explicacion: 'Cuando un lead entra a «{etapa}», se crea solo un recordatorio para el día siguiente: «Consultar si vio la oferta». Ningún lead se queda sin próximo paso: el punto naranja de la tarjeta pasa a verde.',
  },
  {
    id: 'asignacion_paseos',
    embudo: 'paseos',
    etapa: 'paseos_negociacion',
    titulo: 'Asignar cuando empieza la negociación',
    tipo: 'asignar',
    explicacion: 'Cuando un lead entra a «{etapa}», queda asignado a la persona que elijas y su inicial aparece en la tarjeta.',
  },
]

// Ideas para más adelante: se muestran como tales, no están disponibles todavía
const PROXIMAMENTE = [
  'Enviar un mensaje de WhatsApp al entrar a una etapa (necesita plantillas aprobadas por Meta y tiene costo por mensaje).',
  'Mover un lead a otra etapa cuando pasan varios días sin respuesta.',
  'Agregar una etiqueta automáticamente al entrar a una etapa.',
]

function textoDias(dias) {
  if (dias === 0) return 'el mismo día'
  if (dias === 1) return 'al día siguiente'
  return `a los ${dias} días`
}

function Interruptor({ activo, onChange, etiqueta, deshabilitado }) {
  return (
    <button
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={onChange}
      disabled={deshabilitado}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${activo ? 'bg-gray-900 dark:bg-zinc-100' : 'bg-gray-200 dark:bg-zinc-700'}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${activo ? 'translate-x-5' : ''}`} />
    </button>
  )
}

// Panel "Automatizar" del embudo: acciones que el sistema hace solo cuando un
// lead entra a una etapa. Las reglas se cumplen en la base, así que valen sin
// importar cómo llegue el lead a la etapa.
export default function AutomatizacionesEmbudo({ embudo = 'paquetes', etapas, usuarios, alCerrar }) {
  const etapasEmbudo = etapasDelEmbudo(etapas, embudo)
  const [lista, setLista] = useState([])
  const [disponible, setDisponible] = useState(null) // null = cargando
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [personaSugerida, setPersonaSugerida] = useState('')
  const [borrando, setBorrando] = useState(null)
  const [nueva, setNueva] = useState({ etapa: etapasEmbudo[0]?.clave || 'nuevo', tipo: 'recordatorio', dias: 2, nota: '', usuario: '' })

  const personas = usuarios.filter(u => u.activo !== false)
  const nombreEtapa = clave => etapas.find(e => e.clave === clave)?.nombre || clave
  const nombrePersona = id => usuarios.find(u => u.id === id)?.nombre || 'una persona'

  useEffect(() => {
    embudoAutoApi.getAll()?.then(({ data, error }) => {
      if (error || !data) { setDisponible(false); return }
      setLista(data)
      setDisponible(true)
    })
  }, [])

  useEffect(() => {
    const tecla = e => { if (e.key === 'Escape') alCerrar() }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [alCerrar])

  async function ejecutar(accion, textoOk) {
    setOcupado(true)
    setMensaje(null)
    try {
      await accion()
      if (textoOk) setMensaje({ tipo: 'ok', texto: textoOk })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `No se pudo guardar: ${e?.message || 'error de conexión'}` })
    }
    setOcupado(false)
  }

  function crear(datos, textoOk) {
    return ejecutar(async () => {
      const { data, error } = await embudoAutoApi.create(datos)
      if (error) throw error
      setLista(prev => [...prev, data])
    }, textoOk)
  }

  function alternar(a) {
    return ejecutar(async () => {
      const { data, error } = await embudoAutoApi.update(a.id, { activa: !a.activa })
      if (error) throw error
      setLista(prev => prev.map(x => x.id === a.id ? data : x))
    })
  }

  function borrar(id) {
    setBorrando(null)
    return ejecutar(async () => {
      const { error } = await embudoAutoApi.delete(id)
      if (error) throw error
      setLista(prev => prev.filter(x => x.id !== id))
    }, 'Automatización eliminada')
  }

  function agregarPropia() {
    const base = { etapa_clave: nueva.etapa, tipo: nueva.tipo }
    if (nueva.tipo === 'recordatorio') {
      const dias = Math.round(Number(nueva.dias))
      if (!nueva.nota.trim() || !(dias >= 0 && dias <= 365)) {
        setMensaje({ tipo: 'error', texto: 'Escribí la nota del recordatorio y una cantidad de días entre 0 y 365.' })
        return
      }
      crear({ ...base, dias, nota: nueva.nota.trim() }, 'Automatización activada').then(() => setNueva(p => ({ ...p, nota: '' })))
    } else {
      if (!nueva.usuario) {
        setMensaje({ tipo: 'error', texto: 'Elegí a quién se asigna el lead.' })
        return
      }
      crear({ ...base, usuario_id: nueva.usuario }, 'Automatización activada')
    }
  }

  // Una sugerida cuenta como activa si ya hay una igual (aunque esté apagada, se ve en la lista)
  const yaExiste = s => lista.some(a => a.etapa_clave === s.etapa && a.tipo === s.tipo && (s.tipo === 'asignar' || a.nota === s.nota))
  const sugeridas = SUGERIDAS.filter(s => s.embudo === embudo && etapasEmbudo.some(e => e.clave === s.etapa))
  const ordenEtapa = clave => etapasEmbudo.find(e => e.clave === clave)?.orden ?? 999
  // Solo las de este embudo
  const ordenadas = lista.filter(a => etapasEmbudo.some(e => e.clave === a.etapa_clave)).sort((a, b) => ordenEtapa(a.etapa_clave) - ordenEtapa(b.etapa_clave) || String(a.created_at).localeCompare(String(b.created_at)))

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={alCerrar}>
      <aside
        role="dialog"
        aria-label="Automatizaciones del embudo"
        onClick={e => e.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl dark:bg-zinc-900 dark:shadow-black/40"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-content-center rounded-xl bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-zinc-100"><Ic n="bolt" className="h-[18px] w-[18px]" /></span>
            <div>
              <h2 className="text-lg font-bold leading-tight text-gray-900 dark:text-zinc-100">Automatizaciones del embudo</h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Embudo de {nombreEmbudo(embudo).toLowerCase()}</p>
            </div>
          </div>
          <button onClick={alCerrar} aria-label="Cerrar" className="text-xl text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300">✕</button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
          <section>
            <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-300">
              Son acciones que el sistema hace <strong>solo</strong> cuando un lead entra a una etapa, para no depender de acordarse.
              Se cumplen siempre, sin importar cómo llegue el lead: arrastrándolo, cambiándolo desde su ficha o cuando el asistente de WhatsApp lo crea.
              Estas acciones no mandan mensajes, así que no tienen costo.
            </p>
          </section>

          {mensaje && (
            <p className={`rounded-xl px-4 py-2.5 text-sm font-medium ${mensaje.tipo === 'ok'
              ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400'
              : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'}`}>
              {mensaje.texto}
            </p>
          )}

          {disponible === null && <p className="text-sm text-gray-400 dark:text-zinc-500">Cargando...</p>}

          {disponible === false && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              Todavía no está aplicada la migración de las automatizaciones en la base de datos, por eso no se pueden crear ni ver.
            </p>
          )}

          {disponible && (
            <>
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Sugeridas</h3>
                <div className="grid gap-3">
                  {sugeridas.map(s => {
                    const activa = yaExiste(s)
                    return (
                      <div key={s.id} className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">{s.titulo}</p>
                          {activa && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-bold text-green-700 dark:bg-green-950/40 dark:text-green-400">
                              <Ic n="check" className="h-3 w-3" />Activa
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-zinc-400">{s.explicacion.replace('{etapa}', nombreEtapa(s.etapa))}</p>
                        {!activa && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {s.tipo === 'asignar' && (
                              <select
                                value={personaSugerida}
                                onChange={e => setPersonaSugerida(e.target.value)}
                                aria-label="Persona a la que se asigna"
                                className={`${CAMPO} w-auto min-w-[180px] py-2`}
                              >
                                <option value="">Elegí a quién asignar</option>
                                {personas.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                              </select>
                            )}
                            <button
                              onClick={() => crear(
                                s.tipo === 'recordatorio'
                                  ? { etapa_clave: s.etapa, tipo: 'recordatorio', dias: s.dias, nota: s.nota }
                                  : { etapa_clave: s.etapa, tipo: 'asignar', usuario_id: personaSugerida },
                                'Automatización activada',
                              )}
                              disabled={ocupado || (s.tipo === 'asignar' && !personaSugerida)}
                              className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                            >
                              Activar
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  Activas y apagadas ({ordenadas.length})
                </h3>
                {ordenadas.length === 0 ? (
                  <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-white/[0.04] dark:text-zinc-400">Todavía no hay automatizaciones. Activá una de las sugeridas o creá la tuya abajo.</p>
                ) : (
                  <div className="grid gap-2">
                    {ordenadas.map(a => (
                      <div key={a.id} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${a.activa ? 'border-gray-200 dark:border-white/10' : 'border-dashed border-gray-200 opacity-60 dark:border-white/10'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-gray-900 dark:text-zinc-100">Al entrar a {nombreEtapa(a.etapa_clave)}</p>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
                            {a.tipo === 'recordatorio'
                              ? `Crear un recordatorio ${textoDias(a.dias)}: «${a.nota}»`
                              : `Asignar el lead a ${nombrePersona(a.usuario_id)}`}
                          </p>
                        </div>
                        <Interruptor activo={a.activa} onChange={() => alternar(a)} etiqueta={a.activa ? 'Apagar la automatización' : 'Activar la automatización'} deshabilitado={ocupado} />
                        {borrando === a.id ? (
                          <span className="flex items-center gap-1.5 text-xs">
                            <button onClick={() => borrar(a.id)} className="font-bold text-red-500 hover:text-red-700 dark:text-red-400">Borrar</button>
                            <button onClick={() => setBorrando(null)} className="text-gray-400 dark:text-zinc-500">No</button>
                          </span>
                        ) : (
                          <button onClick={() => setBorrando(a.id)} aria-label="Eliminar la automatización" title="Eliminar" className="text-gray-300 transition-colors hover:text-red-400 dark:text-zinc-600 dark:hover:text-red-400">
                            <Ic n="trash" className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Crear otra</h3>
                <div className="grid gap-3 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="auto-etapa" className={ETIQUETA}>Cuando el lead entra a</label>
                      <select id="auto-etapa" value={nueva.etapa} onChange={e => setNueva(p => ({ ...p, etapa: e.target.value }))} className={CAMPO}>
                        {etapasEmbudo.map(e => <option key={e.clave} value={e.clave}>{e.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="auto-tipo" className={ETIQUETA}>Hacer</label>
                      <select id="auto-tipo" value={nueva.tipo} onChange={e => setNueva(p => ({ ...p, tipo: e.target.value }))} className={CAMPO}>
                        <option value="recordatorio">Crear un recordatorio</option>
                        <option value="asignar">Asignar a una persona</option>
                      </select>
                    </div>
                  </div>

                  {nueva.tipo === 'recordatorio' ? (
                    <div className="grid grid-cols-[100px_1fr] gap-3">
                      <div>
                        <label htmlFor="auto-dias" className={ETIQUETA}>Días</label>
                        <input id="auto-dias" type="number" min="0" max="365" value={nueva.dias} onChange={e => setNueva(p => ({ ...p, dias: e.target.value }))} className={CAMPO} />
                      </div>
                      <div>
                        <label htmlFor="auto-nota" className={ETIQUETA}>Nota del recordatorio</label>
                        <input id="auto-nota" type="text" value={nueva.nota} onChange={e => setNueva(p => ({ ...p, nota: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') agregarPropia() }} placeholder="Ej: Llamar para confirmar fechas" className={CAMPO} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="auto-persona" className={ETIQUETA}>Asignar a</label>
                      <select id="auto-persona" value={nueva.usuario} onChange={e => setNueva(p => ({ ...p, usuario: e.target.value }))} className={CAMPO}>
                        <option value="">Elegí una persona</option>
                        {personas.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                      </select>
                    </div>
                  )}

                  <button
                    onClick={agregarPropia}
                    disabled={ocupado}
                    className="justify-self-start rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
                  >
                    Agregar automatización
                  </button>
                </div>
              </section>
            </>
          )}

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Próximamente</h3>
            <ul className="grid gap-2">
              {PROXIMAMENTE.map(t => (
                <li key={t} className="flex items-start gap-2 text-xs leading-relaxed text-gray-400 dark:text-zinc-500">
                  <Ic n="clock" className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  )
}
