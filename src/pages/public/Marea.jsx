import { Link } from 'react-router-dom'
import { hoyEnDestino, proximosDias, formatoAltura, ULTIMO_DIA } from '../../data/mareas.js'
import { BTN_SECUNDARIO_OSCURO } from '../../components/public/botones.js'
import { useSeo } from '../../lib/seo.js'
import { useLang, useTextos } from '../../context/LanguageContext.jsx'

const DIAS_A_MOSTRAR = 14

const TEXTOS = {
  es: {
    seoTitulo: 'Tabla de mareas', seoDescripcion: 'Horarios y alturas de la marea baja y alta en Porto de Galinhas y Maragogi.',
    titulo: 'Tabla de marea', bajada: 'Porto de Galinhas y Maragogi',
    actualizando: 'Estamos actualizando la tabla de mareas.', volver: 'Volver al inicio',
    dia: 'Día', baja: 'Marea baja', alta: 'Marea alta', hoy: 'Hoy',
    pie: (dia, mes) => `Previsión de mareas de referencia, cargada hasta el ${dia} de ${mes}.`,
  },
  pt: {
    seoTitulo: 'Tábua de marés', seoDescripcion: 'Horários e alturas da maré baixa e alta em Porto de Galinhas e Maragogi.',
    titulo: 'Tábua de marés', bajada: 'Porto de Galinhas e Maragogi',
    actualizando: 'Estamos atualizando a tábua de marés.', volver: 'Voltar ao início',
    dia: 'Dia', baja: 'Maré baixa', alta: 'Maré alta', hoy: 'Hoje',
    pie: (dia, mes) => `Previsão de marés de referência, carregada até ${dia} de ${mes}.`,
  },
  en: {
    seoTitulo: 'Tide table', seoDescripcion: 'Low and high tide times and heights in Porto de Galinhas and Maragogi.',
    titulo: 'Tide table', bajada: 'Porto de Galinhas and Maragogi',
    actualizando: 'We’re updating the tide table.', volver: 'Back to home',
    dia: 'Day', baja: 'Low tide', alta: 'High tide', hoy: 'Today',
    pie: (dia, mes) => `Reference tide forecast, available up to ${mes} ${dia}.`,
  },
}

// Día de la semana y mes abreviados en el idioma del sitio ("lun", "seg", "Mon")
function partesFecha(fechaISO, locale) {
  const d = new Date(`${fechaISO}T12:00:00Z`)
  const corto = (op) => d.toLocaleDateString(locale, { ...op, timeZone: 'UTC' }).replace('.', '')
  return { semana: corto({ weekday: 'short' }), dia: d.getUTCDate(), mes: corto({ month: 'short' }) }
}

// Horas y alturas de un tipo de marea. En el celular, la altura va debajo de la hora.
// Solo datos: la tabla no recomienda días ni paseos (pedido de Abril, 2026-10-14).
function Mareas({ lista }) {
  const { lang } = useLang()
  if (!lista.length) return <span className="text-hero-cream/75">—</span>
  return (
    <div className="flex flex-col gap-2 md:gap-1">
      {lista.map(m => (
        <div key={m.hora} className="flex flex-col md:flex-row md:items-baseline md:gap-2 leading-tight">
          <span className="font-label-lg text-[15px] text-white">{m.hora}</span>
          <span className="font-label-sm text-[13px] text-hero-cream/75">{formatoAltura(m.altura, lang)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Marea() {
  const tx = useTextos(TEXTOS)
  const { lang, locale } = useLang()
  useSeo({ titulo: tx.seoTitulo, descripcion: tx.seoDescripcion })
  const hoy = hoyEnDestino()
  const dias = proximosDias(hoy, DIAS_A_MOSTRAR)
  const fin = partesFecha(ULTIMO_DIA, locale)

  return (
    <div className="bg-hero-navy min-h-screen">
      <div className="px-margin-mobile md:px-margin-desktop max-w-4xl mx-auto pt-32 pb-20">
        <h1 className="font-display-hero uppercase text-hero-yellow leading-none"
          style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', letterSpacing: '0.01em' }}>
          {tx.titulo}
        </h1>
        <p className="font-display-hero uppercase text-hero-cream mb-10"
          style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', letterSpacing: '0.03em' }}>
          {tx.bajada}
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
                    <Mareas lista={d.mareas.filter(m => m.tipo === 'baja')} />
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
