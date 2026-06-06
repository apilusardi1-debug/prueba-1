import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { excursiones, formatPrecio } from '../../data/mockData.js'

const PASOS = ['Tus datos', 'Elegí fecha', 'Confirmá']

export default function Reservar() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ex = excursiones.find((e) => e.id === id)

  const [paso, setPaso] = useState(0)
  const [form, setForm] = useState({ nombre: '', email: '', whatsapp: '', personas: 1, fecha: '', notas: '' })
  const [enviado, setEnviado] = useState(false)

  if (!ex) {
    return (
      <div className="text-center py-24">
        <p className="text-xl text-gray-700">Excursión no encontrada.</p>
        <Link to="/excursiones" className="text-brand-600 hover:underline mt-2 block">← Volver</Link>
      </div>
    )
  }

  const total = ex.precio * form.personas

  function update(field, val) {
    setForm((prev) => ({ ...prev, [field]: val }))
  }

  function siguiente() {
    if (paso < PASOS.length - 1) setPaso(paso + 1)
  }

  function anterior() {
    if (paso > 0) setPaso(paso - 1)
  }

  function confirmar() {
    // Acá iría la llamada a Supabase para guardar la reserva
    console.log('Reserva:', { excursionId: id, ...form, total })
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-2">¡Reserva enviada!</h2>
        <p className="text-gray-500 mb-6">
          Recibimos tu solicitud para <strong>{ex.nombre}</strong>. Nuestro equipo se va a comunicar con vos por WhatsApp a la brevedad para confirmarla.
        </p>
        <a
          href={`https://wa.me/5491100000000?text=Hola!%20Acabo%20de%20hacer%20una%20reserva%20para%20${encodeURIComponent(ex.nombre)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-full transition-colors mb-4"
        >
          💬 Confirmar por WhatsApp
        </a>
        <br />
        <Link to="/excursiones" className="text-brand-600 hover:underline text-sm">
          Ver más excursiones
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to={`/excursiones/${id}`} className="text-sm text-brand-600 hover:underline mb-6 inline-block">
        ← Volver al detalle
      </Link>

      <h1 className="text-2xl font-bold mb-1">Reservar: {ex.nombre}</h1>
      <p className="text-gray-500 text-sm mb-8">{ex.destino} · {ex.duracion}</p>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {PASOS.map((p, i) => (
          <div key={p} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i < paso ? 'bg-green-500 text-white' : i === paso ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
              {i < paso ? '✓' : i + 1}
            </div>
            <span className={`text-sm ${i === paso ? 'font-semibold text-brand-700' : 'text-gray-400'}`}>{p}</span>
            {i < PASOS.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {/* Paso 0 – Datos */}
        {paso === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => update('nombre', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp *</label>
              <input
                type="tel"
                value={form.whatsapp}
                onChange={(e) => update('whatsapp', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="11 1234 5678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="juan@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad de personas *</label>
              <input
                type="number"
                min={1}
                max={ex.cuposDisponibles}
                value={form.personas}
                onChange={(e) => update('personas', parseInt(e.target.value) || 1)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <p className="text-xs text-gray-400 mt-1">Máximo {ex.cuposDisponibles} personas disponibles</p>
            </div>
          </div>
        )}

        {/* Paso 1 – Fecha */}
        {paso === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Seleccioná una fecha de salida *</p>
            <div className="space-y-2">
              {ex.fechas.map((f) => {
                const label = new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                return (
                  <button
                    key={f}
                    onClick={() => update('fecha', f)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-colors ${form.fecha === f ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold' : 'border-gray-200 hover:border-brand-300 text-gray-700'}`}
                  >
                    📅 {label}
                  </button>
                )
              })}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
              <textarea
                rows={3}
                value={form.notas}
                onChange={(e) => update('notas', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                placeholder="Alergias, restricciones, consultas..."
              />
            </div>
          </div>
        )}

        {/* Paso 2 – Confirmar */}
        {paso === 2 && (
          <div>
            <h3 className="font-semibold text-gray-800 mb-4">Resumen de tu reserva</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Excursión</span>
                <span className="font-medium">{ex.nombre}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Fecha</span>
                <span className="font-medium">{form.fecha ? new Date(form.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : '–'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Personas</span>
                <span className="font-medium">{form.personas}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Precio por persona</span>
                <span className="font-medium">{formatPrecio(ex.precio)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-bold text-gray-800">Total</span>
                <span className="font-bold text-brand-700 text-lg">{formatPrecio(total)}</span>
              </div>
            </div>
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
              ⚠️ La reserva se confirma una vez que nuestro equipo te contacte y acuerden el pago de la seña.
            </div>
          </div>
        )}

        {/* Botones de navegación */}
        <div className="flex justify-between mt-6">
          {paso > 0 ? (
            <button onClick={anterior} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
              ← Atrás
            </button>
          ) : <div />}

          {paso < PASOS.length - 1 ? (
            <button
              onClick={siguiente}
              disabled={paso === 0 && (!form.nombre || !form.whatsapp) || paso === 1 && !form.fecha}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
            >
              Siguiente →
            </button>
          ) : (
            <button
              onClick={confirmar}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-2.5 rounded-xl transition-colors"
            >
              Confirmar reserva 🎉
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
