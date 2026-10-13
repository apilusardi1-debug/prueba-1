import { useState } from 'react'
import { Link } from 'react-router-dom'
import { destinos } from '../../data/mockData.js'
import FormularioPaquete from '../../components/public/FormularioPaquete.jsx'

// Página que explica cómo funcionan los paquetes. Antes /paquetes era el
// catálogo filtrado con paquetes armados de antemano; los paquetes se arman a
// medida de cada viajero, así que la página cuenta qué incluyen, cómo se
// arman y el acompañamiento de las anfitrionas. Los destinos son los mismos
// de la página Destinos (mockData.js), así una sola lista manda en las dos.

const INCLUYE = [
  { icono: 'flight', titulo: 'Vuelos', texto: 'Buscamos la mejor opción de vuelos para tus fechas.' },
  { icono: 'hotel', titulo: 'Hospedaje', texto: 'Encontramos tu hospedaje ideal según tu presupuesto.' },
  { icono: 'airport_shuttle', titulo: 'Traslado privado', texto: 'Coordinamos tu traslado privado del aeropuerto a tu alojamiento.' },
]

const PASOS = [
  { titulo: 'Contanos tu viaje', texto: 'Qué destinos te interesan, las fechas, cuántos viajan (y la edad de los menores) y tu presupuesto.' },
  { titulo: 'Te armamos la propuesta', texto: 'Con opciones de vuelos, hospedaje y traslado pensadas para vos.' },
  { titulo: 'Confirmás y viajás acompañado', texto: 'Desde ese momento te asisten nuestras anfitrionas, antes de llegar y durante toda la estadía.' },
]

const GESTIONES = [
  'Contratación del seguro de viaje',
  'Equipaje adicional',
  'Compra y selección de asientos',
  'Excursiones y paseos de Dream Tours',
  'Pago de saldos pendientes',
  'Asistencia y orientación durante todo el viaje',
]

const TITULO = 'font-display-hero uppercase text-hero-navy mb-6'
const TITULO_ESTILO = { fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '0.01em' }

export default function PaquetesInfo() {
  const [formAbierto, setFormAbierto] = useState(false)

  const Boton = () => (
    <button type="button" onClick={() => setFormAbierto(true)}
      className="inline-flex items-center justify-center gap-2 bg-hero-yellow text-hero-navy font-label-lg text-label-lg uppercase px-8 py-3 rounded-full hover:opacity-90 transition-opacity">
      <span className="material-symbols-outlined text-[20px]">edit_note</span>
      Armar mi paquete
    </button>
  )

  return (
    <div className="bg-surface min-h-screen">
      {formAbierto && <FormularioPaquete onClose={() => setFormAbierto(false)} />}
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="bg-hero-navy pt-32 pb-16 md:pb-20">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h1 className="font-display-hero uppercase text-hero-yellow leading-none"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', letterSpacing: '0.01em' }}>
            Paquetes a medida
          </h1>
          <p className="font-display-hero uppercase text-hero-cream mb-4"
            style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', letterSpacing: '0.03em' }}>
            Vuelos, hospedaje y traslado en un solo lugar
          </p>
          <p className="font-body-md text-body-lg text-hero-cream/80 max-w-2xl mb-8">
            Nos encargamos de buscar tu mejor opción de vuelos, encontrar el hospedaje ideal según tu presupuesto y coordinar tu traslado privado desde el aeropuerto hasta tu alojamiento. Vos solo pensá en disfrutar.
          </p>
          <Boton />
        </div>
      </section>

      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-12 md:py-16">
        {/* Qué incluye */}
        <h2 className={TITULO} style={TITULO_ESTILO}>Qué incluye tu paquete</h2>
        <div className="grid md:grid-cols-3 gap-4 md:gap-gutter mb-14">
          {INCLUYE.map(({ icono, titulo, texto }) => (
            <div key={titulo} className="p-7 bg-white rounded-2xl border border-hero-navy/10">
              <div className="w-14 h-14 rounded-full bg-hero-cream flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-hero-navy text-[28px]">{icono}</span>
              </div>
              <h3 className="font-display-hero uppercase text-hero-navy text-2xl tracking-wide mb-1">{titulo}</h3>
              <p className="font-body-md text-[15px] leading-relaxed text-on-surface-variant">{texto}</p>
            </div>
          ))}
        </div>

        {/* Destinos combinables */}
        <h2 className="font-display-hero uppercase text-hero-navy mb-2" style={TITULO_ESTILO}>Combiná destinos</h2>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mb-6">
          Podés sumar más de un destino en el mismo viaje: por ejemplo, Porto de Galinhas + Maceió, o Maragogi + Fernando de Noronha. Armamos los vuelos, hospedajes y traslados para que todo encaje.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-14">
          {destinos.map(d => (
            <Link key={d.id} to={`/destinos/${d.id}`}
              className="group relative rounded-2xl overflow-hidden aspect-[4/5] md:aspect-[3/4]">
              <img src={d.imagen} alt={d.nombre} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-hero-navy/90 via-hero-navy/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="font-display-hero uppercase text-hero-yellow text-xl md:text-2xl leading-none">{d.nombre}</p>
                <p className="font-label-sm text-[12px] text-hero-cream/80 mt-1">{d.estado}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Cómo funciona */}
        <h2 className={TITULO} style={TITULO_ESTILO}>Cómo funciona</h2>
        <ol className="grid md:grid-cols-3 gap-4 md:gap-gutter mb-14">
          {PASOS.map(({ titulo, texto }, i) => (
            <li key={titulo} className="p-7 bg-hero-cream rounded-2xl">
              <span className="w-10 h-10 rounded-full bg-hero-navy text-hero-yellow font-display-hero text-2xl flex items-center justify-center mb-4">
                {i + 1}
              </span>
              <h3 className="font-display-hero uppercase text-hero-navy text-2xl tracking-wide mb-1">{titulo}</h3>
              <p className="font-body-md text-[15px] leading-relaxed text-on-surface-variant">{texto}</p>
            </li>
          ))}
        </ol>

        {/* Anfitrionas */}
        <div className="bg-hero-navy rounded-2xl p-8 md:p-12 grid md:grid-cols-[1.1fr_1fr] gap-8 md:gap-12 items-start mb-6">
          <div>
            <h2 className="font-display-hero uppercase text-hero-cream mb-3" style={TITULO_ESTILO}>
              Te acompañamos todo el viaje
            </h2>
            <p className="font-body-md text-body-md text-hero-cream/80 mb-4">
              Vas a contar con el acompañamiento de nuestras anfitrionas, <span className="text-hero-yellow">Agostina y Victoria</span>, que te asisten antes de llegar y durante toda tu estadía.
            </p>
            <p className="font-body-md text-body-md text-hero-cream/80">
              Ellas te envían el check-in y las tarjetas de embarque, y te ayudan con cualquier gestión que necesites.
            </p>
            {/* En el celular el botón va debajo de la lista */}
            <div className="hidden md:block mt-8"><Boton /></div>
          </div>
          <ul className="flex flex-col gap-3">
            {GESTIONES.map(g => (
              <li key={g} className="flex items-start gap-3 text-hero-cream">
                <span className="material-symbols-outlined text-hero-sky text-[22px] flex-shrink-0">check_circle</span>
                <span className="font-body-md text-body-md">{g}</span>
              </li>
            ))}
          </ul>
          <div className="md:hidden"><Boton /></div>
        </div>

        <p className="font-body-md text-[13px] leading-relaxed text-on-surface-variant max-w-3xl">
          Dream Tours actúa como intermediario entre el pasajero y los proveedores contratados (aerolíneas, hospedajes y traslados), brindando asistencia y acompañamiento durante toda la experiencia.
        </p>
      </div>
    </div>
  )
}
