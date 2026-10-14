import { Link } from 'react-router-dom'
import { hoyEnDestino, proximosDias, proximaVentana, formatoAltura, ULTIMO_DIA } from '../../data/mareas.js'
import { BTN_SECUNDARIO_OSCURO } from '../../components/public/botones.js'
import { useSeo } from '../../lib/seo.js'
import { useLang, useTextos } from '../../context/LanguageContext.jsx'

const DIAS_A_MOSTRAR = 14

const TEXTOS = {
  es: {
    seoTitulo: 'Tabla de mareas', seoDescripcion: 'Horarios de marea baja y alta en Porto de Galinhas y Maragogi para planear tu visita a las piscinas naturales.',
    titulo: 'Tabla de marea', bajada: 'Porto de Galinhas y Maragogi',
    intro: 'Las piscinas naturales aparecen con la marea baja. Las mejores salidas son de día, con la marea en 0,60 m o menos; cuanto más baja, mejor. Los días sin marea baja son ideales para el resto de los paseos: Maragogi, Carneiros, buggy y más.',
    actualizando: 'Estamos actualizando la tabla de mareas. Escribinos y te pasamos los mejores días para tu viaje.', volver: 'Volver al inicio',
    hoySePuede: 'Hoy se puede ir a las piscinas', proximo: 'Próximo día para las piscinas',
    dia: 'Día', baja: 'Marea baja', alta: 'Marea alta', hoy: 'Hoy',
    pie: (dia, mes) => `Previsión de mareas de referencia, cargada hasta el ${dia} de ${mes}. Confirmá con tu guía antes del paseo.`,
  },
  pt: {
    seoTitulo: 'Tábua de marés', seoDescripcion: 'Horários de maré baixa e alta em Porto de Galinhas e Maragogi para planejar sua visita às piscinas naturais.',
    titulo: 'Tábua de marés', bajada: 'Porto de Galinhas e Maragogi',
    intro: 'As piscinas naturais aparecem com a maré baixa. Os melhores passeios são de dia, com a maré em 0,60 m ou menos; quanto mais baixa, melhor. Os dias sem maré baixa são ideais para os outros passeios: Maragogi, Carneiros, buggy e mais.',
    actualizando: 'Estamos atualizando a tábua de marés. Escreva para nós e passamos os melhores dias para a sua viagem.', volver: 'Voltar ao início',
    hoySePuede: 'Hoje dá para ir às piscinas', proximo: 'Próximo dia para as piscinas',
    dia: 'Dia', baja: 'Maré baixa', alta: 'Maré alta', hoy: 'Hoje',
    pie: (dia, mes) => `Previsão de marés de referência, carregada até ${dia} de ${mes}. Confirme com seu guia antes do passeio.`,
  },
  en: {
    seoTitulo: 'Tide table', seoDescripcion: 'Low and high tide times in Porto de Galinhas and Maragogi to plan your visit to the natural pools.',
    titulo: 'Tide table', bajada: 'Porto de Galinhas and Maragogi',
    intro: 'The natural pools appear at low tide. The best trips are during the day, with the tide at 0.60 m or less; the lower, the better. Days without a low tide are ideal for the other tours: Maragogi, Carneiros, buggy rides and more.',
    actualizando: 'We’re updating the tide table. Write to us and we’ll send you the best days for your trip.', volver: 'Back to home',
    hoySePuede: 'You can visit the pools today', proximo: 'Next day for the pools',
    dia: 'Day', baja: 'Low tide', alta: 'High tide', hoy: 'Today',
    pie: (dia, mes) => `Reference tide forecast, available up to ${mes} ${dia}. Check with your guide before the tour.`,
  },
}

// Día de la semana y mes abreviados en el idioma del sitio ("lun", "seg", "Mon")
function partesFecha(fechaISO, locale) {
  const d = new Date(`${fechaISO}T12:00:00Z`)
  const corto = (op) => d.toLocaleDateString(locale, { ...op, timeZone: 'UTC' }).replace('.', '')
  return { semana: corto({ weekday: 'short' }), dia: d.getUTCDate(), mes: corto({ month: 'short' }) }
}

// Horas y alturas de un tipo de marea. En el celular, la altura va debajo de la
// hora; la marea baja que sirve para las piscinas se resalta en celeste.
function Mareas({ lista, destacada }) {
  const { lang } = useLang()
  if (!lista.length) return <span className="text-hero-cream/75">—</span>
  return (
    <div className="flex flex-col gap-2 md:gap-1">
      {lista.map(m => {
        const resaltar = destacada?.hora === m.hora
        return (
          <div key={m.hora} className="flex flex-col md:flex-row md:items-baseline md:gap-2 leading-tight">
            <span className={`font-label-lg text-[15px] ${resaltar ? 'text-hero-sky' : 'text-white'}`}>{m.hora}</span>
            <span className={`font-label-sm text-[13px] ${resaltar ? 'text-hero-sky/80' : 'text-hero-cream/75'}`}>{formatoAltura(m.altura, lang)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function Marea() {
  const tx = useTextos(TEXTOS)
  const { lang, locale } = useLang()
  useSeo({ titulo: tx.seoTitulo, descripcion: tx.seoDescripcion })
  const hoy = hoyEnDestino()
  const dias = proximosDias(hoy, DIAS_A_MOSTRAR)
  const ventana = proximaVentana(hoy)
  const fin = partesFecha(ULTIMO_DIA, locale)

  return (
    <div className="bg-hero-navy min-h-screen">
      <div className="px-margin-mobile md:px-margin-desktop max-w-4xl mx-auto pt-32 pb-20">
        <h1 className="font-display-hero uppercase text-hero-yellow leading-none"
          style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', letterSpacing: '0.01em' }}>
          {tx.titulo}
        </h1>
        <p className="font-display-hero uppercase text-hero-cream mb-4"
          style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', letterSpacing: '0.03em' }}>
          {tx.bajada}
        </p>
        <p className="font-body-md text-body-md text-hero-cream/80 max-w-2xl mb-10">
          {tx.intro}
        </p>

        {dias.length === 0 ? (
          <div className="rounded-2xl border border-white/10 p-8 text-center">
            <p className="font-body-md text-body-md text-hero-cream/80 mb-6">
              {tx.actualizando}
            </p>
            <Link to="/" className={BTN_SECUNDARIO_OSCURO}>
              {tx.volver}
            </Link>
          </div>
        ) : (
          <>
            {/* Próxima salida posible a las piscinas */}
            {ventana && (() => {
              const f = partesFecha(ventana.fecha, locale)
              return (
                <div className="rounded-2xl bg-hero-sky/10 border border-hero-sky/25 p-6 md:p-7 mb-4 flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <p className="font-label-lg text-[12px] uppercase tracking-[0.2em] text-hero-sky mb-2">
                      {ventana.fecha === hoy ? tx.hoySePuede : tx.proximo}
                    </p>
                    <p className="font-display-hero uppercase text-white leading-none" style={{ fontSize: 'clamp(1.9rem, 4vw, 2.6rem)' }}>
                      {f.semana} {f.dia} {f.mes} · {ventana.mejor.hora} h
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-label-lg text-[12px] uppercase tracking-[0.16em] text-hero-cream/75 mb-2">{tx.baja}</p>
                    <p className="font-display-hero text-hero-sky leading-none text-[2rem]">{formatoAltura(ventana.mejor.altura, lang)}</p>
                  </div>
                </div>
              )
            })()}

            {/* Tabla */}
            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-[0.8fr_1.2fr_1.2fr] gap-3 px-4 md:px-6 py-3 border-b border-white/10">
                {[tx.dia, tx.baja, tx.alta].map(h => (
                  <p key={h} className="font-label-lg text-[11px] uppercase tracking-[0.16em] text-hero-cream/75">{h}</p>
                ))}
              </div>
              {dias.map((d, i) => {
                const f = partesFecha(d.fecha, locale)
                return (
                  <div key={d.fecha}
                    className={`grid grid-cols-[0.8fr_1.2fr_1.2fr] gap-3 px-4 md:px-6 py-4 items-center ${i < dias.length - 1 ? 'border-b border-white/[0.07]' : ''} ${d.fecha === hoy ? 'bg-hero-sky/[0.06]' : ''}`}>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display-hero text-white text-[1.6rem] leading-none">{f.dia}</span>
                      <span className="font-label-lg text-[12px] uppercase text-hero-cream/75">{d.fecha === hoy ? tx.hoy : f.semana}</span>
                    </div>
                    <Mareas lista={d.mareas.filter(m => m.tipo === 'baja')} destacada={d.mejor} />
                    <Mareas lista={d.mareas.filter(m => m.tipo === 'alta')} />
                  </div>
                )
              })}
            </div>

            <p className="font-body-md text-[13px] text-hero-cream/75 text-center mt-6">
              {tx.pie(fin.dia, fin.mes)}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
