import { useSiteConfig } from '../../context/SiteConfigContext.jsx'
import { useSeo } from '../../lib/seo.js'
import { useTextos } from '../../context/LanguageContext.jsx'

// Responsable del tratamiento de los datos (LGPD), tal como figura en la Receita Federal
const RESPONSABLE = { razonSocial: 'DREAM TOURS AGENCIA DE TURISMO E SERVICOS LTDA', cnpj: '57.371.792/0001-28' }

// "5581997199422" -> "+55 81 99719-9422"
const telefonoLegible = (n) => n?.length === 13 ? `+${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 9)}-${n.slice(9)}` : n

const TEXTOS = {
  es: {
    titulo: 'Política de privacidad', actualizacion: 'Última actualización: 14 de octubre de 2026',
    contacto: 'Contacto', contactoTexto: 'Para cualquier consulta sobre esta política o sobre tus datos, escribinos por WhatsApp.',
    escribir: 'Escribir por WhatsApp',
    responsable: (r, c) => `Responsable del tratamiento de los datos: ${r}, CNPJ ${c}.`, numero: 'WhatsApp:',
    secciones: [
      {
        titulo: 'Quiénes somos',
        parrafos: [
          'DreamTours es una agencia de turismo con domicilio legal en Jaboatão dos Guararapes y operación en Porto de Galinhas, Ipojuca, ambos en Pernambuco (Brasil), especializada en viajes, paseos, traslados y paquetes por el Nordeste brasileño. Esta política explica qué datos personales tratamos cuando nos escribís o contratás un servicio, para qué los usamos y qué derechos tenés sobre ellos.',
        ],
      },
      {
        titulo: 'Qué datos recopilamos',
        lista: [
          'Datos de contacto: nombre, número de WhatsApp y, si nos lo das, email, país y ciudad.',
          'Datos del viaje: fechas, cantidad de pasajeros, edades de menores, paseos y hospedajes que te interesan o contratás.',
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
          'Compartimos solo lo necesario para prestarte el servicio: con los choferes, guías y hospedajes que participan de tu viaje. Además usamos proveedores tecnológicos que procesan datos en nuestro nombre: la plataforma de WhatsApp Business de Meta para la mensajería, y servicios de almacenamiento y alojamiento web.',
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
    ],
  },
  pt: {
    titulo: 'Política de privacidade', actualizacion: 'Última atualização: 14 de outubro de 2026',
    contacto: 'Contato', contactoTexto: 'Para qualquer dúvida sobre esta política ou sobre seus dados, escreva para nós pelo WhatsApp.',
    escribir: 'Escrever pelo WhatsApp',
    responsable: (r, c) => `Controlador dos dados: ${r}, CNPJ ${c}.`, numero: 'WhatsApp:',
    secciones: [
      { titulo: 'Quem somos', parrafos: ['A DreamTours é uma agência de turismo com sede legal em Jaboatão dos Guararapes e operação em Porto de Galinhas, Ipojuca, ambos em Pernambuco (Brasil), especializada em viagens, passeios, traslados e pacotes pelo Nordeste brasileiro. Esta política explica quais dados pessoais tratamos quando você nos escreve ou contrata um serviço, para que os usamos e quais direitos você tem sobre eles.'] },
      { titulo: 'Quais dados coletamos', lista: [
        'Dados de contato: nome, número de WhatsApp e, se você nos informar, e-mail, país e cidade.',
        'Dados da viagem: datas, número de passageiros, idades dos menores, passeios e hospedagens que te interessam ou que você contrata.',
        'Mensagens que você nos envia pelo WhatsApp, redes sociais ou formulários do site, e as respostas que damos.',
        'Dados de pagamento: registramos qual valor foi pago, quando e por qual meio. Não armazenamos números de cartão.',
      ] },
      { titulo: 'Para que usamos seus dados', lista: [
        'Responder suas consultas e preparar propostas, orçamentos e reservas.',
        'Coordenar a operação da sua viagem: traslados, passeios e hospedagem.',
        'Enviar avisos operacionais sobre a sua reserva, como horários, ponto de encontro e dados do guia ou do motorista.',
        'Manter o controle administrativo, contábil e legal dos nossos serviços.',
      ] },
      { titulo: 'Com quem compartilhamos', parrafos: [
        'Compartilhamos apenas o necessário para prestar o serviço: com os motoristas, guias e hospedagens que participam da sua viagem. Também usamos fornecedores de tecnologia que processam dados em nosso nome: a plataforma WhatsApp Business da Meta para as mensagens, e serviços de armazenamento e hospedagem de sites.',
        'Não vendemos seus dados pessoais nem os usamos para publicidade de terceiros.',
      ] },
      { titulo: 'Por quanto tempo os guardamos', parrafos: ['Guardamos seus dados enquanto forem necessários para atender sua consulta ou prestar o serviço contratado e, depois, pelo tempo exigido pelas obrigações legais e contábeis aplicáveis.'] },
      { titulo: 'Seus direitos', parrafos: ['Você pode nos pedir para acessar seus dados, corrigi-los, atualizá-los ou excluí-los, e retirar seu consentimento quando quiser, de acordo com a legislação aplicável de proteção de dados pessoais, incluída a Lei Geral de Proteção de Dados do Brasil (LGPD).'] },
      { titulo: 'Como pedir a exclusão dos seus dados', parrafos: ['Escreva para nós pelo WhatsApp no contato indicado abaixo, com a mensagem "Quero que excluam meus dados", a partir do número com que você falou conosco. Processamos o pedido e confirmamos pelo mesmo meio. Se algum dado precisar ser mantido por uma obrigação legal ou contábil, avisamos qual e por quê.'] },
      { titulo: 'Mudanças nesta política', parrafos: ['Podemos atualizar esta página quando nossos serviços ou a legislação mudarem. A data da última atualização aparece no início da página.'] },
    ],
  },
  en: {
    titulo: 'Privacy policy', actualizacion: 'Last updated: October 14, 2026',
    contacto: 'Contact', contactoTexto: 'For any questions about this policy or your data, write to us on WhatsApp.',
    escribir: 'Write on WhatsApp',
    responsable: (r, c) => `Data controller: ${r}, CNPJ ${c}.`, numero: 'WhatsApp:',
    secciones: [
      { titulo: 'Who we are', parrafos: ['DreamTours is a travel agency legally registered in Jaboatão dos Guararapes and operating in Porto de Galinhas, Ipojuca, both in Pernambuco (Brazil), specializing in trips, tours, transfers and packages across Northeast Brazil. This policy explains what personal data we process when you write to us or book a service, what we use it for and what rights you have over it.'] },
      { titulo: 'What data we collect', lista: [
        'Contact details: name, WhatsApp number and, if you give them to us, email, country and city.',
        'Trip details: dates, number of travelers, children’s ages, and the tours and accommodation you’re interested in or book.',
        'Messages you send us via WhatsApp, social media or website forms, and our replies.',
        'Payment details: we record how much was paid, when and by what method. We do not store card numbers.',
      ] },
      { titulo: 'What we use your data for', lista: [
        'Answering your questions and preparing proposals, quotes and bookings.',
        'Coordinating your trip: transfers, tours and accommodation.',
        'Sending you operational notices about your booking, such as times, meeting point and guide or driver details.',
        'Keeping the administrative, accounting and legal records of our services.',
      ] },
      { titulo: 'Who we share it with', parrafos: [
        'We share only what is needed to provide the service: with the drivers, guides and accommodation involved in your trip. We also use technology providers that process data on our behalf: Meta’s WhatsApp Business platform for messaging, and storage and web hosting services.',
        'We do not sell your personal data or use it for third-party advertising.',
      ] },
      { titulo: 'How long we keep it', parrafos: ['We keep your data for as long as needed to handle your inquiry or provide the service you booked, and then for as long as required by applicable legal and accounting obligations.'] },
      { titulo: 'Your rights', parrafos: ['You can ask us to access, correct, update or delete your data, and withdraw your consent at any time, in accordance with applicable personal data protection law, including Brazil’s General Data Protection Law (LGPD).'] },
      { titulo: 'How to request deletion of your data', parrafos: ['Write to us on WhatsApp at the contact below with the message "Please delete my data", from the number you used to talk to us. We process the request and confirm through the same channel. If we must keep any data due to a legal or accounting obligation, we’ll tell you which and why.'] },
      { titulo: 'Changes to this policy', parrafos: ['We may update this page when our services or the regulations change. The date of the last update appears at the top of the page.'] },
    ],
  },
}

export default function Privacidad() {
  const tx = useTextos(TEXTOS)
  useSeo({ titulo: tx.titulo })
  const { config } = useSiteConfig()
  const whatsapp = config?.whatsapp

  return (
    <div className="bg-surface min-h-screen">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="bg-hero-navy pt-32 pb-16 md:pb-20">
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <h1 className="font-display-hero uppercase text-hero-yellow leading-none"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', letterSpacing: '0.01em' }}>
            {tx.titulo}
          </h1>
          <p className="font-display-hero uppercase text-hero-cream"
            style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', letterSpacing: '0.03em' }}>
            {tx.actualizacion}
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-margin-mobile py-12 md:py-16 space-y-10">
        {tx.secciones.map(({ titulo, parrafos, lista }) => (
          <section key={titulo}>
            <h2 className="font-display-hero uppercase text-hero-navy text-3xl tracking-wide mb-3">
              {titulo}
            </h2>
            {parrafos?.map((p, i) => (
              <p key={i} className="font-body-md text-[15px] leading-relaxed text-on-surface-variant mb-2.5">{p}</p>
            ))}
            {lista && (
              <ul className="pl-5 list-disc">
                {lista.map((item, i) => (
                  <li key={i} className="font-body-md text-[15px] leading-relaxed text-on-surface-variant mb-1.5">{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className="bg-hero-cream rounded-2xl p-7">
          <h2 className="font-display-hero uppercase text-hero-navy text-3xl tracking-wide mb-2.5">
            {tx.contacto}
          </h2>
          <p className="font-body-md text-[15px] leading-relaxed text-on-surface-variant mb-4">
            {tx.contactoTexto}
          </p>
          {RESPONSABLE.razonSocial && RESPONSABLE.cnpj && (
            <p className="font-body-md text-[15px] leading-relaxed text-on-surface-variant mb-2">{tx.responsable(RESPONSABLE.razonSocial, RESPONSABLE.cnpj)}</p>
          )}
          {whatsapp && (
            <p className="font-body-md text-[15px] leading-relaxed text-on-surface-variant mb-4">{tx.numero} {telefonoLegible(whatsapp)}</p>
          )}
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-hero-navy text-white font-label-lg text-[14px] px-6 py-2.5 rounded-full hover:opacity-90 transition-opacity"
            >
              {tx.escribir}
            </a>
          )}
        </section>
      </div>
    </div>
  )
}
