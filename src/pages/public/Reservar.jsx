import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { excursionesApi, reservasApi, vendedoresApi } from '../../lib/supabase.js'

const PASOS = ['Tus datos', 'Elegí fecha', 'Pago', 'Confirmado']

const QR_PLACEHOLDER = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=PAGO-DREAMS-TOURS'

export default function Reservar() {
  const { id } = useParams()
  const [excursion, setExcursion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [paso, setPaso] = useState(0)
  const [form, setForm] = useState({
    nombre: '', email: '', whatsapp: '', adultos: 1, menores: 0,
    fecha: '', notas: '', hospedaje: '', codigo_vendedor: '',
  })
  const [vendedor, setVendedor] = useState(null)
  const [codigoError, setCodigoError] = useState('')
  const [verificandoCodigo, setVerificandoCodigo] = useState(false)
  const [reservaCreada, setReservaCreada] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    excursionesApi.getById(id).then(({ data }) => {
      setExcursion(data)
      setCargando(false)
    })
  }, [id])

  function set(key, val) { setForm(p => ({ ...p, [key]: val })) }

  const personas = (parseInt(form.adultos) || 0) + (parseInt(form.menores) || 0)
  const total = excursion ? excursion.precio * personas : 0
  const seña = Math.round(total * 0.3)

  async function verificarCodigo() {
    if (!form.codigo_vendedor.trim()) return
    setVerificandoCodigo(true)
    setCodigoError('')
    const { data, error } = await vendedoresApi.getByCodigoReferido(form.codigo_vendedor.trim())
    if (error || !data) {
      setCodigoError('Código no válido')
      setVendedor(null)
    } else {
      setVendedor(data)
      setCodigoError('')
    }
    setVerificandoCodigo(false)
  }

  function siguiente() {
    if (paso < 2) setPaso(p => p + 1)
  }

  function anterior() {
    if (paso > 0) setPaso(p => p - 1)
  }

  async function confirmar(pagarSena) {
    setGuardando(true)
    const { data } = await reservasApi.create({
      excursion_id: id,
      cliente_nombre: form.nombre,
      cliente_whatsapp: form.whatsapp.replace(/\D/g, ''),
      fecha: form.fecha,
      adultos: parseInt(form.adultos) || 0,
      menores: parseInt(form.menores) || 0,
      personas,
      hospedaje: form.hospedaje || null,
      notas: form.notas || null,
      total,
      moneda: excursion?.moneda || 'BRL',
      estado: 'pendiente',
      vendedor_id: vendedor?.id || null,
      vendedor_codigo: vendedor ? form.codigo_vendedor.toUpperCase() : null,
      seña_pagada: pagarSena,
    })
    setReservaCreada(data)
    setPaso(3)
    setGuardando(false)
  }

  if (cargando) return (
    <div className="min-h-[60vh] flex items-center justify-center text-gray-400">
      Cargando excursión...
    </div>
  )

  if (!excursion) return (
    <div className="text-center py-24">
      <p className="text-xl text-gray-700">Excursión no encontrada.</p>
      <Link to="/excursiones" className="text-brand-600 hover:underline mt-2 block">← Volver</Link>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to={`/excursiones/${id}`} className="text-sm text-brand-600 hover:underline mb-6 inline-block">
        ← Volver al detalle
      </Link>

      <h1 className="text-2xl font-bold mb-1">{excursion.nombre}</h1>
      <p className="text-gray-500 text-sm mb-8">{excursion.destino} · {excursion.duracion}</p>

      {/* Stepper */}
      {paso < 3 && (
        <div className="flex items-center gap-2 mb-8">
          {PASOS.slice(0, 3).map((p, i) => (
            <div key={p} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i < paso ? 'bg-green-500 text-white' : i === paso ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                {i < paso ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${i === paso ? 'font-semibold text-brand-700' : 'text-gray-400'}`}>{p}</span>
              {i < 2 && <div className="flex-1 h-px bg-gray-200" />}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

        {/* ── PASO 0: Datos del pasajero ── */}
        {paso === 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800 mb-2">Datos del pasajero</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
              <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="Juan Pérez" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp *</label>
              <input type="tel" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="5491112345678" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="juan@email.com" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adultos *</label>
                <input type="number" min="0" value={form.adultos} onChange={e => set('adultos', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Menores</label>
                <input type="number" min="0" value={form.menores} onChange={e => set('menores', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hospedaje / Dirección de pickup</label>
              <input type="text" value={form.hospedaje} onChange={e => set('hospedaje', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                placeholder="Hotel, dirección..." />
            </div>

            {/* Código de vendedor */}
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código de vendedor <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.codigo_vendedor}
                  onChange={e => { set('codigo_vendedor', e.target.value.toUpperCase()); setVendedor(null); setCodigoError('') }}
                  className={`flex-1 border rounded-xl px-3 py-2.5 text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                    vendedor ? 'border-green-400 bg-green-50' : codigoError ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="Ej: JUAN01"
                />
                <button
                  type="button"
                  onClick={verificarCodigo}
                  disabled={!form.codigo_vendedor.trim() || verificandoCodigo}
                  className="px-4 py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-xl disabled:opacity-40 hover:bg-gray-700 transition-colors"
                >
                  {verificandoCodigo ? '...' : 'Verificar'}
                </button>
              </div>
              {vendedor && (
                <p className="text-xs text-green-600 font-medium mt-1.5">✓ Código válido — vendedor: {vendedor.nombre}</p>
              )}
              {codigoError && (
                <p className="text-xs text-red-500 mt-1.5">{codigoError}</p>
              )}
            </div>
          </div>
        )}

        {/* ── PASO 1: Fecha ── */}
        {paso === 1 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800 mb-2">Elegí la fecha</h2>
            {excursion.fechas?.length > 0 ? (
              <div className="space-y-2">
                {excursion.fechas.map(f => {
                  const label = new Date(f + 'T12:00:00').toLocaleDateString('es-AR', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })
                  return (
                    <button key={f} onClick={() => set('fecha', f)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-colors ${
                        form.fecha === f
                          ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold'
                          : 'border-gray-200 hover:border-brand-300 text-gray-700'
                      }`}>
                      📅 {label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha deseada *</label>
                <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
              <textarea rows={3} value={form.notas} onChange={e => set('notas', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                placeholder="Alergias, restricciones, consultas..." />
            </div>
          </div>
        )}

        {/* ── PASO 2: Pago de seña ── */}
        {paso === 2 && (
          <div>
            <h2 className="font-semibold text-gray-800 mb-4">Resumen y pago</h2>

            {/* Resumen */}
            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Excursión</span>
                <span className="font-medium">{excursion.nombre}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Fecha</span>
                <span className="font-medium">
                  {form.fecha ? new Date(form.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : '–'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Personas</span>
                <span className="font-medium">
                  {form.adultos > 0 && `${form.adultos} adulto${form.adultos > 1 ? 's' : ''}`}
                  {form.menores > 0 && ` · ${form.menores} menor${form.menores > 1 ? 'es' : ''}`}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Precio por persona</span>
                <span className="font-medium">
                  {excursion.precio?.toLocaleString('pt-BR', { style: 'currency', currency: excursion.moneda || 'BRL' })}
                </span>
              </div>
              {vendedor && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Vendedor</span>
                  <span className="font-medium text-green-600">{vendedor.nombre} ({form.codigo_vendedor})</span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="font-bold text-gray-800">Total</span>
                <span className="font-bold text-brand-700 text-lg">
                  {total.toLocaleString('pt-BR', { style: 'currency', currency: excursion.moneda || 'BRL' })}
                </span>
              </div>
            </div>

            {/* QR de pago */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-center mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-1">Pago de seña (30%)</p>
              <p className="text-2xl font-bold text-brand-700 mb-4">
                {seña.toLocaleString('pt-BR', { style: 'currency', currency: excursion.moneda || 'BRL' })}
              </p>
              <img src={QR_PLACEHOLDER} alt="QR de pago" className="mx-auto w-44 h-44 rounded-xl border border-gray-200" />
              <p className="text-xs text-gray-400 mt-3">Escaneá el QR para pagar la seña</p>
            </div>

            {/* Botones de acción */}
            <div className="space-y-2">
              <button
                onClick={() => confirmar(true)}
                disabled={guardando}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {guardando ? 'Guardando...' : '✅ Ya pagué la seña'}
              </button>
              <button
                onClick={() => confirmar(false)}
                disabled={guardando}
                className="w-full bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-600 font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                Continuar sin pagar ahora
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: Confirmado ── */}
        {paso === 3 && (
          <div className="text-center py-6">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2">¡Reserva recibida!</h2>
            <p className="text-gray-500 mb-2">
              Gracias <strong>{form.nombre}</strong>. Registramos tu reserva para
            </p>
            <p className="font-semibold text-brand-700 mb-1">{excursion.nombre}</p>
            <p className="text-gray-400 text-sm mb-6">
              {form.fecha ? new Date(form.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
            </p>
            {reservaCreada?.seña_pagada && (
              <div className="inline-block bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-4 py-2 rounded-full mb-5">
                ✅ Seña registrada
              </div>
            )}
            <p className="text-gray-500 text-sm mb-6">
              Nuestro equipo se va a comunicar con vos por WhatsApp para confirmar los detalles.
            </p>
            <a
              href={`https://wa.me/558189375412?text=Hola!%20Acabo%20de%20hacer%20una%20reserva%20para%20${encodeURIComponent(excursion.nombre)}`}
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
        )}

        {/* Botones de navegación (pasos 0 y 1) */}
        {paso < 2 && (
          <div className="flex justify-between mt-6">
            {paso > 0 ? (
              <button onClick={anterior} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                ← Atrás
              </button>
            ) : <div />}
            <button
              onClick={siguiente}
              disabled={
                (paso === 0 && (!form.nombre.trim() || !form.whatsapp.trim() || personas === 0)) ||
                (paso === 1 && !form.fecha)
              }
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
            >
              Siguiente →
            </button>
          </div>
        )}

        {paso === 2 && (
          <div className="mt-4">
            <button onClick={anterior} className="text-sm text-gray-400 hover:text-gray-600">
              ← Atrás
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
