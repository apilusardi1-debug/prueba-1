import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usuariosAdminApi } from '../../lib/supabase.js'
import { MENSAJES_OPERACION } from '../../lib/mensajesDefault.js'
import { TEMPLATE_BODIES } from '../../../supabase/functions/_shared/plantillasWhatsapp.ts'
import { avisar } from '../../components/ui/Avisos.jsx'

const ETIQUETA = 'text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500'

// Variables que recibe la plantilla de Meta del aviso al cliente, en el orden {{1}}..{{11}}
const VARIABLES_CLIENTE = [
  'saludo', 'paseo', 'guía', 'chofer', 'auto', 'patente', 'horario de salida', 'horario de regreso',
  'hospedaje', 'teléfono del guía', 'link de opcionales',
]

function TarjetaEditable({ clave, plantilla, onGuardar }) {
  const original = MENSAJES_OPERACION[clave]
  const [texto, setTexto] = useState(plantilla?.texto || original.texto)
  const [guardando, setGuardando] = useState(false)
  const cambio = texto !== (plantilla?.texto || original.texto)

  useEffect(() => { setTexto(plantilla?.texto || original.texto) }, [plantilla?.texto])

  async function guardar() {
    setGuardando(true)
    const ok = await onGuardar(clave, texto)
    setGuardando(false)
    if (ok) avisar('Mensaje guardado. Se usa en el próximo cierre de operación.')
  }

  return (
    <section className="dash-card space-y-3">
      <div>
        <p className="text-base font-bold text-gray-900 dark:text-zinc-100">{original.nombre}</p>
        <p className="text-xs text-gray-500 dark:text-zinc-400">{original.descripcion}</p>
      </div>

      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={8}
        className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-mono text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
      />

      <div>
        <p className={`${ETIQUETA} mb-1.5`}>Variables</p>
        <div className="flex flex-wrap gap-1.5">
          {original.variables.map(v => (
            <code key={v} className="rounded-md bg-sky-50 px-2 py-0.5 text-[12px] text-sky-800 dark:bg-sky-900/30 dark:text-sky-200">{`{${v}}`}</code>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400 dark:text-zinc-600">Se reemplazan por los datos de cada operación. Si escribís una que no está en la lista, queda tal cual.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-gray-400 dark:text-zinc-600">
          {plantilla?.actualizado_at
            ? `Última edición: ${new Date(plantilla.actualizado_at).toLocaleString('es-AR')}${plantilla.actualizado_por ? ` · ${plantilla.actualizado_por}` : ''}`
            : 'Usando el texto original'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setTexto(original.texto)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            Restaurar original
          </button>
          <button
            onClick={guardar}
            disabled={!cambio || guardando || !texto.trim()}
            className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </section>
  )
}

export default function Mensajes() {
  const navigate = useNavigate()
  const [plantillas, setPlantillas] = useState({})
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    usuariosAdminApi.plantillas().then(res => {
      setPlantillas(Object.fromEntries((res?.plantillas || []).map(p => [p.clave, p])))
      setCargando(false)
    })
  }, [])

  async function guardar(clave, texto) {
    const res = await usuariosAdminApi.guardarPlantilla(clave, texto)
    if (!res?.ok) {
      avisar('No se pudo guardar el mensaje: ' + (res?.error || 'error desconocido'))
      return false
    }
    setPlantillas(prev => ({ ...prev, [clave]: { ...prev[clave], clave, texto, actualizado_at: new Date().toISOString() } }))
    return true
  }

  if (cargando) return <p className="text-sm text-gray-400 dark:text-zinc-500">Cargando mensajes...</p>

  return (
    <div className="space-y-6">
      <div>
        <p className="max-w-3xl text-sm text-gray-500 dark:text-zinc-400">
          Acá se ven todos los mensajes que el sistema manda solo. Los de choferes y guías se pueden editar; el de clientes sale por una plantilla de Meta y solo se puede ver.
        </p>
      </div>

      <div>
        <p className={`${ETIQUETA} mb-3`}>Choferes y guías · chat interno</p>
        <div className="grid gap-4 xl:grid-cols-2">
          {Object.keys(MENSAJES_OPERACION).map(clave => (
            <TarjetaEditable key={clave} clave={clave} plantilla={plantillas[clave]} onGuardar={guardar} />
          ))}
        </div>
      </div>

      <div>
        <p className={`${ETIQUETA} mb-3`}>Clientes · WhatsApp (solo lectura)</p>
        <section className="dash-card space-y-3">
          <div>
            <p className="text-base font-bold text-gray-900 dark:text-zinc-100">Aviso de cierre de operación</p>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Llega al cliente el día antes del paseo. Sale por una plantilla de Meta: el texto se cambia en Meta, no desde acá.</p>
          </div>
          <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 font-sans text-[13px] leading-relaxed text-gray-800 dark:bg-white/[0.03] dark:text-zinc-200">
            {TEMPLATE_BODIES.aviso_cliente}
          </pre>
          <div>
            <p className={`${ETIQUETA} mb-1.5`}>Datos que completa el sistema</p>
            <ol className="list-decimal space-y-0.5 pl-5 text-xs text-gray-500 dark:text-zinc-400">
              {VARIABLES_CLIENTE.map(v => <li key={v}>{v}</li>)}
            </ol>
          </div>
        </section>
      </div>

      <div>
        <p className={`${ETIQUETA} mb-3`}>Asistente del CRM</p>
        <section className="dash-card flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-bold text-gray-900 dark:text-zinc-100">Menú y preguntas automáticas</p>
            <p className="text-xs text-gray-500 dark:text-zinc-400">El menú de bienvenida, las preguntas del filtro de Paquetes y el mensaje de seguimiento se editan en Configuración → Asistente.</p>
          </div>
          <button
            onClick={() => navigate('/admin/configuracion')}
            className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
          >
            Ir a Configuración
          </button>
        </section>
      </div>
    </div>
  )
}
