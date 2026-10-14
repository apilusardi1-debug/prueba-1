import { Link } from 'react-router-dom'
import { hoyEnDestino, proximosDias, proximaVentana, formatoAltura, ULTIMO_DIA } from '../../data/mareas.js'
import { BTN_SECUNDARIO_OSCURO } from '../../components/public/botones.js'

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS_A_MOSTRAR = 14

function partesFecha(fechaISO) {
  const d = new Date(`${fechaISO}T12:00:00Z`)
  return { semana: DIAS_SEMANA[d.getUTCDay()], dia: d.getUTCDate(), mes: MESES[d.getUTCMonth()] }
}

// Horas y alturas de un tipo de marea. En el celular, la altura va debajo de la
// hora; la marea baja que sirve para las piscinas se resalta en celeste.
function Mareas({ lista, destacada }) {
  if (!lista.length) return <span className="text-hero-cream/75">—</span>
  return (
    <div className="flex flex-col gap-2 md:gap-1">
      {lista.map(m => {
        const resaltar = destacada?.hora === m.hora
        return (
          <div key={m.hora} className="flex flex-col md:flex-row md:items-baseline md:gap-2 leading-tight">
            <span className={`font-label-lg text-[15px] ${resaltar ? 'text-hero-sky' : 'text-white'}`}>{m.hora}</span>
            <span className={`font-label-sm text-[13px] ${resaltar ? 'text-hero-sky/80' : 'text-hero-cream/75'}`}>{formatoAltura(m.altura)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function Marea() {
  const hoy = hoyEnDestino()
  const dias = proximosDias(hoy, DIAS_A_MOSTRAR)
  const ventana = proximaVentana(hoy)
  const fin = partesFecha(ULTIMO_DIA)

  return (
    <div className="bg-hero-navy min-h-screen">
      <div className="px-margin-mobile md:px-margin-desktop max-w-4xl mx-auto pt-32 pb-20">
        <h1 className="font-display-hero uppercase text-hero-yellow leading-none"
          style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', letterSpacing: '0.01em' }}>
          Tabla de marea
        </h1>
        <p className="font-display-hero uppercase text-hero-cream mb-4"
          style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', letterSpacing: '0.03em' }}>
          Porto de Galinhas y Maragogi
        </p>
        <p className="font-body-md text-body-md text-hero-cream/80 max-w-2xl mb-10">
          Las piscinas naturales aparecen con la marea baja. Las mejores salidas son de día, con la marea en 0,60 m o menos; cuanto más baja, mejor. Los días sin marea baja son ideales para el resto de los paseos: Maragogi, Carneiros, buggy y más.
        </p>

        {dias.length === 0 ? (
          <div className="rounded-2xl border border-white/10 p-8 text-center">
            <p className="font-body-md text-body-md text-hero-cream/80 mb-6">
              Estamos actualizando la tabla de mareas. Escribinos y te pasamos los mejores días para tu viaje.
            </p>
            <Link to="/" className={BTN_SECUNDARIO_OSCURO}>
              Volver al inicio
            </Link>
          </div>
        ) : (
          <>
            {/* Próxima salida posible a las piscinas */}
            {ventana && (() => {
              const f = partesFecha(ventana.fecha)
              return (
                <div className="rounded-2xl bg-hero-sky/10 border border-hero-sky/25 p-6 md:p-7 mb-4 flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <p className="font-label-lg text-[12px] uppercase tracking-[0.2em] text-hero-sky mb-2">
                      {ventana.fecha === hoy ? 'Hoy se puede ir a las piscinas' : 'Próximo día para las piscinas'}
                    </p>
                    <p className="font-display-hero uppercase text-white leading-none" style={{ fontSize: 'clamp(1.9rem, 4vw, 2.6rem)' }}>
                      {f.semana} {f.dia} {f.mes} · {ventana.mejor.hora} h
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-label-lg text-[12px] uppercase tracking-[0.16em] text-hero-cream/75 mb-2">Marea baja</p>
                    <p className="font-display-hero text-hero-sky leading-none text-[2rem]">{formatoAltura(ventana.mejor.altura)}</p>
                  </div>
                </div>
              )
            })()}

            {/* Tabla */}
            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-[0.8fr_1.2fr_1.2fr] gap-3 px-4 md:px-6 py-3 border-b border-white/10">
                {['Día', 'Marea baja', 'Marea alta'].map(h => (
                  <p key={h} className="font-label-lg text-[11px] uppercase tracking-[0.16em] text-hero-cream/75">{h}</p>
                ))}
              </div>
              {dias.map((d, i) => {
                const f = partesFecha(d.fecha)
                return (
                  <div key={d.fecha}
                    className={`grid grid-cols-[0.8fr_1.2fr_1.2fr] gap-3 px-4 md:px-6 py-4 items-center ${i < dias.length - 1 ? 'border-b border-white/[0.07]' : ''} ${d.fecha === hoy ? 'bg-hero-sky/[0.06]' : ''}`}>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display-hero text-white text-[1.6rem] leading-none">{f.dia}</span>
                      <span className="font-label-lg text-[12px] uppercase text-hero-cream/75">{d.fecha === hoy ? 'Hoy' : f.semana}</span>
                    </div>
                    <Mareas lista={d.mareas.filter(m => m.tipo === 'baja')} destacada={d.mejor} />
                    <Mareas lista={d.mareas.filter(m => m.tipo === 'alta')} />
                  </div>
                )
              })}
            </div>

            <p className="font-body-md text-[13px] text-hero-cream/75 text-center mt-6">
              Previsión de mareas de referencia, cargada hasta el {fin.dia} de {fin.mes}. Confirmá con tu guía antes del paseo.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
