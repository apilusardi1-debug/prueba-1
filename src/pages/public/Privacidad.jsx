import { useSiteConfig } from '../../context/SiteConfigContext.jsx'

const SECCIONES = [
  {
    titulo: 'Quiénes somos',
    parrafos: [
      'DreamTours es una agencia de turismo con base en Salvador, Bahia (Brasil), especializada en viajes, paseos, traslados y paquetes por el Nordeste brasileño. Esta política explica qué datos personales tratamos cuando nos escribís o contratás un servicio, para qué los usamos y qué derechos tenés sobre ellos.',
    ],
  },
  {
    titulo: 'Qué datos recopilamos',
    lista: [
      'Datos de contacto: nombre, número de WhatsApp y, si nos lo das, email, país y ciudad.',
      'Datos del viaje: fechas, cantidad de pasajeros, edades de menores, excursiones y hospedajes que te interesan o contratás.',
      'Mensajes que nos enviás por WhatsApp, redes sociales o formularios del sitio, y las respuestas que te damos.',
      'Datos de pago: registramos qué monto se pagó, cuándo y por qué medio. No almacenamos números de tarjeta.',
    ],
  },
  {
    titulo: 'Para qué usamos tus datos',
    lista: [
      'Responder tus consultas y armar propuestas, presupuestos y reservas.',
      'Coordinar la operación de tu viaje: traslados, paseos y hospedaje.',
      'Enviarte avisos operativos sobre tu reserva, como horarios, punto de encuentro y datos del guía o del chofer.',
      'Llevar el control administrativo, contable y legal de nuestros servicios.',
    ],
  },
  {
    titulo: 'Con quién los compartimos',
    parrafos: [
      'Compartimos solo lo necesario para prestarte el servicio: con los choferes, guías y hospedajes que participan de tu viaje. Además usamos proveedores tecnológicos que procesan datos en nuestro nombre: la plataforma de WhatsApp Business de Meta para la mensajería, servicios de almacenamiento y alojamiento web, y Mercado Pago para cobros cuando corresponde.',
      'No vendemos tus datos personales ni los usamos para publicidad de terceros.',
    ],
  },
  {
    titulo: 'Cuánto tiempo los conservamos',
    parrafos: [
      'Conservamos tus datos mientras sea necesario para atender tu consulta o prestar el servicio contratado, y luego durante el tiempo que exijan las obligaciones legales y contables aplicables.',
    ],
  },
  {
    titulo: 'Tus derechos',
    parrafos: [
      'Podés pedirnos acceder a tus datos, corregirlos, actualizarlos o eliminarlos, y retirar tu consentimiento cuando quieras, conforme a la legislación aplicable de protección de datos personales, incluida la Ley General de Protección de Datos de Brasil (LGPD).',
    ],
  },
  {
    titulo: 'Cómo pedir la eliminación de tus datos',
    parrafos: [
      'Escribinos por WhatsApp al contacto indicado abajo, con el mensaje "Quiero que eliminen mis datos", desde el número con el que hablaste con nosotros. Procesamos el pedido y te confirmamos por el mismo medio. Si algún dato debemos conservarlo por una obligación legal o contable, te avisamos cuál y por qué.',
    ],
  },
  {
    titulo: 'Cambios en esta política',
    parrafos: [
      'Podemos actualizar esta página cuando cambien nuestros servicios o la normativa. La fecha de la última actualización figura al principio de la página.',
    ],
  },
]

export default function Privacidad() {
  const { config } = useSiteConfig()
  const whatsapp = config?.whatsapp

  return (
    <div style={{ backgroundColor: '#f9f3e3', minHeight: '100vh' }}>
      <div style={{ borderBottom: '1px solid #e8d09a', padding: '72px 16px 48px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.25em', color: '#b07420', textTransform: 'uppercase', marginBottom: 16 }}>
          Legal
        </p>
        <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900, fontSize: 'clamp(2rem,5vw,3.5rem)', color: '#1C1208', lineHeight: 1.05, marginBottom: 16 }}>
          Política de privacidad
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#1C1208AA' }}>Última actualización: 19 de septiembre de 2026</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-14 space-y-10">
        {SECCIONES.map(({ titulo, parrafos, lista }) => (
          <section key={titulo}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: '1.3rem', color: '#1C1208', marginBottom: 12 }}>
              {titulo}
            </h2>
            {parrafos?.map((p, i) => (
              <p key={i} style={{ fontSize: '0.95rem', color: '#1C1208CC', lineHeight: 1.75, marginBottom: 10 }}>{p}</p>
            ))}
            {lista && (
              <ul style={{ paddingLeft: 20, listStyle: 'disc' }}>
                {lista.map((item, i) => (
                  <li key={i} style={{ fontSize: '0.95rem', color: '#1C1208CC', lineHeight: 1.75, marginBottom: 6 }}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section style={{ background: '#f2e4c0', borderRadius: 20, padding: '28px 24px' }}>
          <h2 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: '1.3rem', color: '#1C1208', marginBottom: 10 }}>
            Contacto
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#1C1208CC', lineHeight: 1.7, marginBottom: 14 }}>
            Para cualquier consulta sobre esta política o sobre tus datos, escribinos por WhatsApp.
          </p>
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', background: '#1C1208', color: '#f9f3e3', fontWeight: 600, fontSize: '0.9rem', padding: '10px 22px', borderRadius: 999 }}
            >
              Escribir por WhatsApp
            </a>
          )}
        </section>
      </div>
    </div>
  )
}
