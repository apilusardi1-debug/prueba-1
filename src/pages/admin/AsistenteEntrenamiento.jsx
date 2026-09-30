import { useState, useEffect } from 'react'
import { botApi, sinonimosApi, bitacoraApi } from '../../lib/supabase.js'
import { puedeEntrenar } from '../../lib/entrenamiento.js'
import { DESTINOS_INTERES, TIPOS_INTERES } from '../../../supabase/functions/_shared/interes.ts'
import {
  configFiltro, nombreValido, pasoInicial, pasoTrasRespuesta,
  mensajePreguntas, mensajeSeguimiento, TEXTOS_POR_DEFECTO,
} from '../../../supabase/functions/_shared/filtroPaquetes.ts'
import { extraerDatosViaje } from '../../../supabase/functions/_shared/datosViaje.ts'
import { FiltroPaquetes } from './SiteConfig.jsx'
import Ic from '../../components/admin/dashboard/Ic.jsx'

const CLASE_CAMPO = 'w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'

function sesion() {
  try { return JSON.parse(localStorage.getItem('admin_session') || '{}') } catch { return {} }
}

export default function AsistenteEntrenamiento() {
  const session = sesion()
  if (!puedeEntrenar(session.email)) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p className="text-lg font-bold text-gray-900 dark:text-zinc-100">Esta sección no está disponible para tu usuario</p>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2">Entrenar al asistente es un acceso restringido a dos personas del equipo.</p>
      </div>
    )
  }
  return <Contenido session={session} />
}

const TABS = [
  { id: 'arbol', label: 'Árbol del asistente' },
  { id: 'prueba', label: 'Chat de prueba' },
  { id: 'diccionario', label: 'Diccionario de palabras' },
  { id: 'bitacora', label: 'Bitácora' },
]

function Contenido({ session }) {
  const [tab, setTab] = useState('arbol')
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    botApi.getConfig().then(({ data }) => { setCfg(data); setLoading(false) })
  }, [])

  async function registrarCambio(resumen, detalle) {
    await bitacoraApi.registrar({
      usuario_nombre: session.nombre || null,
      usuario_email: session.email || null,
      resumen,
      detalle: detalle || null,
    })
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Entrenar al asistente</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
          El asistente de WhatsApp no es una IA que aprende sola: es un conjunto de reglas (qué pregunta, en qué orden, qué palabras reconoce).
          Acá se edita ese comportamiento de forma visual, se prueba antes de que lo vea un cliente, y se suman palabras nuevas sin tocar código.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-zinc-800 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? 'border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-400'
                : 'border-transparent text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 dark:text-zinc-500">Cargando...</p>
      ) : !cfg ? (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-5 max-w-xl">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Falta preparar la base de datos</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Hay que correr la migración del asistente (20260919160000_bot_asistente.sql) antes de poder entrenarlo.</p>
        </div>
      ) : (
        <>
          {tab === 'arbol' && <ArbolAsistente cfg={cfg} setCfg={setCfg} registrarCambio={registrarCambio} />}
          {tab === 'prueba' && <ChatDePrueba cfg={cfg} />}
          {tab === 'diccionario' && <Diccionario registrarCambio={registrarCambio} />}
          {tab === 'bitacora' && <Bitacora />}
        </>
      )}
    </div>
  )
}

/* ───────────────────────── Árbol del asistente ───────────────────────── */

function NodoArbol({ titulo, descripcion, activo, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl px-4 py-3 shadow-sm hover:border-brand-400 dark:hover:border-brand-500 hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-2">
        <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">{titulo}</p>
        {activo === false && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 rounded-full px-2 py-0.5">Apagado</span>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{descripcion}</p>
    </button>
  )
}

function Rama({ children }) {
  return <div className="flex-1 min-w-[220px] border-t-2 border-gray-200 dark:border-zinc-700 pt-4 space-y-3">{children}</div>
}

function ArbolAsistente({ cfg, setCfg, registrarCambio }) {
  const [nodoAbierto, setNodoAbierto] = useState(null) // 'saludo' | 'filtro' | 'derivacion' | 'sin_asignar' | null

  return (
    <div>
      <div className="space-y-4">
        <NodoArbol
          titulo="1. Saludo inicial"
          descripcion='Primer mensaje a cualquier contacto nuevo, con los botones "Paquetes" y "Paseos".'
          activo={cfg.activo}
          onClick={() => setNodoAbierto('saludo')}
        />
        <div className="flex gap-4 pl-4">
          <Rama>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500 -mt-1">Elige Paquetes</p>
            <NodoArbol
              titulo="2. Filtro de datos"
              descripcion="Pide destino, adultos, menores, presupuesto y fechas antes de derivar."
              activo={cfg.filtro_activo}
              onClick={() => setNodoAbierto('filtro')}
            />
          </Rama>
          <Rama>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500 -mt-1">Elige Paseos</p>
            <NodoArbol
              titulo="2. Deriva directo"
              descripcion="No tiene filtro propio: pasa directo a una persona del equipo de Paseos."
              onClick={() => setNodoAbierto('derivacion')}
            />
          </Rama>
        </div>
        <div className="flex gap-4 pl-4">
          <NodoArbol
            titulo="3. Mensaje al derivar"
            descripcion="Lo que recibe el contacto cuando el asistente ya lo pasó a una persona del equipo."
            onClick={() => setNodoAbierto('derivacion')}
          />
          <NodoArbol
            titulo="3. Nadie disponible"
            descripcion="Lo que recibe si en ese grupo no hay nadie para asignarle en ese momento."
            onClick={() => setNodoAbierto('sin_asignar')}
          />
        </div>
      </div>

      {nodoAbierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setNodoAbierto(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 px-5 py-3 flex items-center justify-between">
              <p className="font-bold text-gray-900 dark:text-zinc-100">Editar nodo</p>
              <button onClick={() => setNodoAbierto(null)} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 text-xl leading-none">✕</button>
            </div>
            <div className="p-5">
              {nodoAbierto === 'saludo' && <EditorSaludo cfg={cfg} setCfg={setCfg} registrarCambio={registrarCambio} />}
              {nodoAbierto === 'filtro' && <FiltroPaquetes cfg={cfg} setCfg={setCfg} onGuardado={registrarCambio} />}
              {nodoAbierto === 'derivacion' && <EditorTexto campo="mensaje_derivacion" titulo="Mensaje al derivar" ayuda="Usa {nombre} y {grupo}." cfg={cfg} setCfg={setCfg} registrarCambio={registrarCambio} />}
              {nodoAbierto === 'sin_asignar' && <EditorTexto campo="mensaje_sin_asignar" titulo="Mensaje cuando no hay nadie disponible" cfg={cfg} setCfg={setCfg} registrarCambio={registrarCambio} />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditorSaludo({ cfg, setCfg, registrarCambio }) {
  const [valor, setValor] = useState(cfg.saludo || '')
  const [guardando, setGuardando] = useState(false)
  async function guardar() {
    setGuardando(true)
    const anterior = cfg.saludo
    const { data } = await botApi.saveConfig({ saludo: valor.trim() })
    if (data) {
      setCfg(data)
      if (anterior !== data.saludo) registrarCambio('Cambió el saludo inicial', { campo: 'saludo', antes: anterior, despues: data.saludo })
    }
    setGuardando(false)
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-zinc-400">Se manda con los botones "Paquetes" y "Paseos" apenas escribe un contacto nuevo.</p>
      <textarea rows={3} value={valor} onChange={e => setValor(e.target.value)} className={CLASE_CAMPO} />
      <button onClick={guardar} disabled={guardando || !valor.trim()} className="w-full bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
        {guardando ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}

function EditorTexto({ campo, titulo, ayuda, cfg, setCfg, registrarCambio }) {
  const [valor, setValor] = useState(cfg[campo] || '')
  const [guardando, setGuardando] = useState(false)
  async function guardar() {
    setGuardando(true)
    const anterior = cfg[campo]
    const { data } = await botApi.saveConfig({ [campo]: valor.trim() })
    if (data) {
      setCfg(data)
      if (anterior !== data[campo]) registrarCambio(`Cambió: ${titulo}`, { campo, antes: anterior, despues: data[campo] })
    }
    setGuardando(false)
  }
  return (
    <div className="space-y-3">
      {ayuda && <p className="text-xs text-gray-500 dark:text-zinc-400">{ayuda}</p>}
      <textarea rows={3} value={valor} onChange={e => setValor(e.target.value)} className={CLASE_CAMPO} />
      <button onClick={guardar} disabled={guardando || !valor.trim()} className="w-full bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
        {guardando ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}

/* ───────────────────────── Chat de prueba ───────────────────────── */

function BurbujaSimulada({ texto, propia }) {
  return (
    <div className={`flex ${propia ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap ${propia ? 'bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100' : 'bg-[#1c4444] text-white'}`}>
        {texto}
      </div>
    </div>
  )
}

function ChatDePrueba({ cfg }) {
  const [hilo, setHilo] = useState([]) // { texto, propia }
  const [fase, setFase] = useState('inicio') // inicio | esperando_respuesta | esperando_respuesta_final | derivado
  const [datosAntes, setDatosAntes] = useState(null)
  const [texto, setTexto] = useState('')

  function reiniciar() {
    setHilo([])
    setFase('inicio')
    setDatosAntes(null)
    setTexto('')
  }

  function elegirPaquetes() {
    setHilo(h => [...h, { texto: 'Paquetes', propia: true }])
    // Todavía no dijo nada: pregunta todo
    const datos = extraerDatosViaje([])
    const paso = pasoInicial(datos, false)
    const msg = paso.accion === 'preguntar'
      ? mensajePreguntas(configFiltro(cfg), paso.faltan)
      : cfg.mensaje_derivacion?.replace('{nombre}', 'Alguien del equipo').replace('{grupo}', 'Paquetes') || ''
    setHilo(h => [...h, { texto: msg }])
    setDatosAntes(datos)
    setFase(paso.accion === 'preguntar' ? 'esperando_respuesta' : 'derivado')
  }

  function enviarMensajeSimulado() {
    const dicho = texto.trim()
    if (!dicho) return
    setTexto('')
    setHilo(h => [...h, { texto: dicho, propia: true }])

    if (fase === 'esperando_respuesta_final' || fase === 'derivado') {
      const msg = cfg.mensaje_derivacion?.replace('{nombre}', 'Alguien del equipo').replace('{grupo}', 'Paquetes') || ''
      setHilo(h => [...h, { texto: msg }])
      setFase('derivado')
      return
    }

    // fase === 'esperando_respuesta'
    const despues = extraerDatosViaje([dicho])
    const nombreConocido = nombreValido(despues.nombre) || !!despues.nombre
    const paso = pasoTrasRespuesta({
      antes: datosAntes,
      despues,
      nombreConocido,
      intentos: 1,
      parecePregunta: /[?¿]/.test(dicho),
    })
    if (paso.accion === 'seguimiento') {
      setHilo(h => [...h, { texto: mensajeSeguimiento(configFiltro(cfg), paso.faltan) }])
      setFase('esperando_respuesta_final')
    } else {
      const msg = cfg.mensaje_derivacion?.replace('{nombre}', 'Alguien del equipo').replace('{grupo}', 'Paquetes') || ''
      setHilo(h => [...h, { texto: msg }])
      setFase('derivado')
    }
  }

  return (
    <div className="max-w-xl">
      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">
        Simulá una conversación como si fueras un lead, con la configuración actual del asistente. No manda nada por WhatsApp — es solo para probar antes de que lo vea un cliente real.
        Hoy simula el camino de <b>Paquetes por texto</b> (el formulario nativo no se puede probar acá, solo se ve mandándolo de verdad).
      </p>
      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2.5 min-h-[280px] max-h-[420px] overflow-y-auto">
        {hilo.length === 0 && (
          <div className="h-full flex items-center justify-center py-16">
            <button onClick={elegirPaquetes} className="bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
              Empezar: elegir "Paquetes"
            </button>
          </div>
        )}
        {hilo.map((m, i) => <BurbujaSimulada key={i} texto={m.texto} propia={m.propia} />)}
      </div>
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') enviarMensajeSimulado() }}
          disabled={hilo.length === 0}
          placeholder={hilo.length === 0 ? 'Elegí "Paquetes" arriba para arrancar' : 'Escribí lo que diría el lead...'}
          className={`${CLASE_CAMPO} disabled:opacity-50`}
        />
        <button
          onClick={enviarMensajeSimulado}
          disabled={hilo.length === 0 || !texto.trim()}
          className="bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 disabled:opacity-40 text-white px-4 rounded-xl shrink-0"
        >
          <Ic n="send" className="w-4 h-4" />
        </button>
        <button onClick={reiniciar} title="Reiniciar" className="border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 px-3 rounded-xl shrink-0">
          <Ic n="trash" className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/* ───────────────────────── Diccionario de palabras ───────────────────────── */

const TIPOS_SINONIMO = [{ id: 'destino', label: 'Destino' }, ...TIPOS_INTERES]

function Diccionario({ registrarCambio }) {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [tipo, setTipo] = useState('destino')
  const [valor, setValor] = useState('')
  const [palabras, setPalabras] = useState('')
  const [guardando, setGuardando] = useState(false)

  function cargar() {
    sinonimosApi.getAll().then(({ data }) => { setLista(data || []); setLoading(false) })
  }
  useEffect(cargar, [])

  async function agregar() {
    const palabrasLimpias = palabras.trim()
    if (!palabrasLimpias || (tipo === 'destino' && !valor.trim())) return
    setGuardando(true)
    const { data } = await sinonimosApi.create({
      tipo,
      valor: tipo === 'destino' ? valor.trim() : null,
      palabras: palabrasLimpias,
    })
    if (data) {
      setLista(l => [data, ...l])
      registrarCambio(`Agregó palabras clave${tipo === 'destino' ? ` para ${valor.trim()}` : ` de ${TIPOS_SINONIMO.find(t => t.id === tipo)?.label}`}`, { tipo, valor, palabras: palabrasLimpias })
      setValor('')
      setPalabras('')
    }
    setGuardando(false)
  }

  async function borrar(s) {
    await sinonimosApi.delete(s.id)
    setLista(l => l.filter(x => x.id !== s.id))
    registrarCambio(`Borró palabras clave${s.tipo === 'destino' ? ` de ${s.valor}` : ''}`, { tipo: s.tipo, valor: s.valor, palabras: s.palabras })
  }

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">
        El asistente ya reconoce destinos y tipos de consulta por palabras clave fijas (por ejemplo "Maragogi" o "todo incluido").
        Acá se pueden sumar sinónimos o formas de decirlo que todavía no reconoce, sin pedir un cambio de código.
      </p>

      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-3 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className={CLASE_CAMPO}>
              {TIPOS_SINONIMO.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          {tipo === 'destino' && (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Destino</label>
              <input list="destinos-existentes" type="text" value={valor} onChange={e => setValor(e.target.value)} placeholder="Ej: Maragogi" className={CLASE_CAMPO} />
              <datalist id="destinos-existentes">
                {DESTINOS_INTERES.map(d => <option key={d} value={d} />)}
              </datalist>
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Palabras o frases (separadas por coma)</label>
          <input type="text" value={palabras} onChange={e => setPalabras(e.target.value)} placeholder="Ej: mara, praia do toque toque" className={CLASE_CAMPO} />
        </div>
        <button
          onClick={agregar}
          disabled={guardando || !palabras.trim() || (tipo === 'destino' && !valor.trim())}
          className="w-full bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          {guardando ? 'Guardando...' : 'Agregar'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 dark:text-zinc-500">Cargando...</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-zinc-500">Todavía no se cargó ninguna palabra extra.</p>
      ) : (
        <div className="space-y-2">
          {lista.map(s => (
            <div key={s.id} className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl px-4 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 rounded-full px-2 py-0.5 shrink-0">
                {TIPOS_SINONIMO.find(t => t.id === s.tipo)?.label}
              </span>
              {s.valor && <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200 shrink-0">{s.valor}</span>}
              <span className="text-sm text-gray-500 dark:text-zinc-400 truncate flex-1">{s.palabras}</span>
              <button onClick={() => borrar(s)} className="text-gray-300 dark:text-zinc-600 hover:text-red-500 shrink-0">
                <Ic n="trash" className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Bitácora ───────────────────────── */

function Bitacora() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { bitacoraApi.getAll().then(({ data }) => { setLista(data || []); setLoading(false) }) }, [])

  if (loading) return <p className="text-sm text-gray-400 dark:text-zinc-500">Cargando...</p>
  if (lista.length === 0) return <p className="text-sm text-gray-400 dark:text-zinc-500">Todavía no hay cambios registrados.</p>

  return (
    <div className="max-w-2xl space-y-2">
      {lista.map(b => (
        <div key={b.id} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl px-4 py-3">
          <p className="text-sm text-gray-800 dark:text-zinc-200">{b.resumen}</p>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
            {b.usuario_nombre || b.usuario_email || 'Alguien'} · {new Date(b.created_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      ))}
    </div>
  )
}
