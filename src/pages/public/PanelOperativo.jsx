// Link personal del guía o del chofer (sin sesión de admin): ve el aviso de cada
// operación que le toca, en portugués, con un botón "Recebido" y, por cada
// pasajero, un botón para mandarle el mensaje por SU PROPIO WhatsApp (gratis,
// no sale por la API de Meta). Reemplaza las plantillas aviso_guia/aviso_chofer.
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { panelOperativoApi } from '../../lib/supabase.js'
import { useSincronizado } from '../../lib/useSincronizado.js'
import Ic, { IcGrande } from '../../components/admin/dashboard/Ic.jsx'

const TABLA = { guia: 'guias', chofer: 'choferes' }
const CAMPO = { guia: 'guia_id', chofer: 'chofer_id' }
const TITULO = { guia: 'Guia', chofer: 'Motorista' }

function formatoFecha(iso) {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}
function formatoHora(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function Aviso({ aviso, onConfirmar, cambiando }) {
  const confirmado = !!aviso.confirmado_at
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-zinc-100">{aviso.operaciones?.excursiones?.nombre}</p>
          <p className="text-xs capitalize text-zinc-500">{formatoFecha(aviso.operaciones?.fecha)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${confirmado ? 'bg-emerald-950/50 text-emerald-400' : 'bg-amber-950/40 text-amber-400'}`}>
          {confirmado ? `Recebido às ${formatoHora(aviso.confirmado_at)}` : 'Novo aviso'}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{aviso.mensaje}</p>

      <div className="mt-4 space-y-2 border-t border-zinc-800 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Mandar mensagem para os passageiros</p>
        {(aviso.pasajeros || []).map((p, i) => (
          <a
            key={i}
            href={p.whatsapp ? `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(p.mensajeWa)}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!p.whatsapp}
            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
              p.whatsapp
                ? 'border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                : 'pointer-events-none border-zinc-800 bg-zinc-900 text-zinc-600'
            }`}
          >
            <span className="truncate">{p.nombre} <span className="text-zinc-500">· {p.personas} {p.personas === 1 ? 'pessoa' : 'pessoas'}</span></span>
            <Ic n="send" className="h-4 w-4 shrink-0 text-emerald-400" />
          </a>
        ))}
      </div>

      <button
        onClick={() => onConfirmar(aviso)}
        disabled={cambiando}
        className={`mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
          confirmado ? 'border border-zinc-700 text-zinc-400 hover:bg-zinc-800' : 'bg-emerald-600 text-white hover:bg-emerald-500'
        }`}
      >
        {confirmado ? 'Desfazer "Recebido"' : 'Recebido'}
      </button>
    </div>
  )
}

export default function PanelOperativo({ tipo }) {
  const { token } = useParams()
  const [persona, setPersona] = useState(undefined) // undefined = cargando, null = no existe
  const [avisos, setAvisos] = useState([])
  const [cambiandoId, setCambiandoId] = useState(null)

  const cargarAvisos = useCallback(async (personaId) => {
    if (!personaId) return
    const { data } = await panelOperativoApi.getAvisos(CAMPO[tipo], personaId)
    setAvisos(data || [])
    // El primer vistazo marca leído lo que todavía no lo estaba (no bloquea la pantalla).
    // Ojo: el builder de supabase-js es "lazy" (thenable) y no manda el pedido hasta que
    // algo llama a su .then()/await, por eso va con Promise.all en vez de dejarlo suelto.
    const sinLeer = (data || []).filter((a) => !a.leido_at)
    if (sinLeer.length) Promise.all(sinLeer.map((a) => panelOperativoApi.marcarLeido(a.id))).catch(() => {})
  }, [tipo])

  useEffect(() => {
    panelOperativoApi.getPorToken(TABLA[tipo], token).then(({ data }) => {
      setPersona(data || null)
      if (data) cargarAvisos(data.id)
    })
  }, [tipo, token, cargarAvisos])

  useSincronizado(() => cargarAvisos(persona?.id), ['operaciones_avisos'])

  async function onConfirmar(aviso) {
    setCambiandoId(aviso.id)
    await panelOperativoApi.marcarConfirmado(aviso.id, !aviso.confirmado_at)
    await cargarAvisos(persona.id)
    setCambiandoId(null)
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-md space-y-5">
        <div className="text-center">
          <img src="/logo-panel.png" alt="Dream Tours" className="mx-auto mb-3 h-auto w-28" />
          {persona && <p className="text-sm text-zinc-500">{TITULO[tipo]} · <span className="font-semibold text-zinc-200">{persona.nombre}</span></p>}
        </div>

        {persona === undefined && <p className="text-center text-sm text-zinc-500">Carregando...</p>}

        {persona === null && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            <IcGrande n="alert" />
            <p className="text-sm text-zinc-400">Este link não é válido. Fale com a Dream Tours para receber o link correto.</p>
          </div>
        )}

        {persona && avisos.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            <IcGrande n="chat" />
            <p className="text-sm text-zinc-400">Ainda não tem nenhum aviso.</p>
          </div>
        )}

        {persona && avisos.map((a) => (
          <Aviso key={a.id} aviso={a} onConfirmar={onConfirmar} cambiando={cambiandoId === a.id} />
        ))}
      </div>
    </div>
  )
}
