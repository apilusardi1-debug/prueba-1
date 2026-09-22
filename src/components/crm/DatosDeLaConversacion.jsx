// Lo que el contacto ya dijo en el chat (por ejemplo, al contestar las preguntas del
// asistente o la plantilla de datos para la propuesta). Es una lectura automática: se muestra para que la
// persona la revise antes de crear la reserva o la propuesta, que la usan sola.
function textoEdad(edad) {
  if (edad === 'bebe') return 'bebé'
  return `${edad} ${edad === 1 ? 'año' : 'años'}`
}

export default function DatosDeLaConversacion({ datos }) {
  if (!datos?.hayDatos) return null

  const filas = [
    datos.nombre && ['Nombre', datos.nombre],
    datos.destino && ['Destino', datos.destino],
    datos.pasajeros !== null && ['Pasajeros', datos.pasajeros],
    datos.adultos !== null && ['Adultos', datos.adultos],
    datos.menores !== null && ['Menores', datos.menores],
    datos.edadesMenores.length > 0 && ['Edades de los menores', datos.edadesMenores.map(textoEdad).join(', ')],
    datos.presupuesto && ['Presupuesto', datos.presupuesto],
    datos.fechas && ['Fecha o período', datos.fechas],
  ].filter(Boolean)

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 dark:border-white/10 dark:bg-white/[0.04]" aria-label="Datos que dijo en el chat">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Datos que dijo en el chat</p>
      <dl className="mt-2 grid gap-1.5 text-sm">
        {filas.map(([nombre, valor]) => (
          <div key={nombre} className="flex justify-between gap-3">
            <dt className="text-gray-500 dark:text-zinc-400">{nombre}</dt>
            <dd className="text-right font-semibold text-gray-900 dark:text-zinc-100">{valor}</dd>
          </div>
        ))}
      </dl>
      {datos.avisos.map(aviso => (
        <p key={aviso} className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{aviso}</p>
      ))}
      <p className="mt-2 text-[11px] leading-relaxed text-gray-400 dark:text-zinc-500">
        Adultos, menores y edades se cargan solos al crear la reserva o la propuesta. Revisalos antes de guardar.
      </p>
    </div>
  )
}
