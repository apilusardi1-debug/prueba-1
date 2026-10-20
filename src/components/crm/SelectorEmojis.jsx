// Emojis para el chat del CRM: el botón 😊 al lado del clip abre este panel (los elige el
// cuadro de texto, en la posición del cursor), y las reacciones a un mensaje usan REACCIONES
// rápidas más este mismo panel para elegir cualquier otra. Sin librerías: es una lista fija.
import { useEffect, useRef, useState } from 'react'

export const REACCIONES = ['👍', '❤️', '😂', '😮', '😢', '🙏']

const CATEGORIAS = [
  ['😊', 'Caras', '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 😴 😷 🤒 🤕 🤢 🥵 🥶 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬'],
  ['👍', 'Gestos', '👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💪 👀 🙋 🙋‍♀️ 🙋‍♂️ 🤷 🤷‍♀️ 🤷‍♂️ 🙆 🙅 💁 🙇 🤦 👨‍👩‍👧 👨‍👩‍👧‍👦 👫 👭 👬 💑 🧑‍🤝‍🧑'],
  ['❤️', 'Corazones', '❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 💖 💗 💓 💞 💕 💘 💝 ❣️ 💔 ❤️‍🔥 💋 ✨ ⭐ 🌟 💫 🔥 💯 ✅ ☑️ ✔️ ❌ ❗ ❓ ‼️ ⚠️ 🎉 🎊 🥂 🍾 🎁 🎈'],
  ['🌴', 'Viajes', '✈️ 🛫 🛬 🧳 🗺️ 🧭 🏖️ 🏝️ 🌴 🌊 🐠 🐬 🐢 🦀 🐚 ☀️ 🌞 🌅 🌄 🌈 ⛅ 🌧️ ⛱️ 🏄 🏄‍♀️ 🤿 🚤 ⛵ 🛥️ 🚣 🚌 🚐 🚗 🚕 🛺 🏨 🏡 🏠 🛏️ 🍹 🥥 🍍 🍉 🥭 🍤 🦐 🍽️ 🍻 📸 🎒 🇧🇷 🇦🇷 🇺🇾 🇨🇱 🇵🇾'],
  ['📅', 'Objetos', '📅 📆 🗓️ ⏰ ⏳ ⌛ 🕐 📍 📌 📎 📄 📃 📝 📋 📊 💰 💵 💳 💸 🧾 🏷️ 📞 📱 💻 📧 ✉️ 📩 🔗 🔑 🔒 🔓 🎫 🎟️ 🛎️ 🆕 🆗 🆓 ➡️ ⬅️ ⬆️ ⬇️ 🔝 🔜'],
].map(([icono, nombre, lista]) => ({ icono, nombre, emojis: lista.split(' ') }))

export default function SelectorEmojis({ onElegir, onCerrar, className = '' }) {
  const [categoria, setCategoria] = useState(0)
  const ref = useRef(null)

  // Se cierra al hacer clic afuera o con Esc
  useEffect(() => {
    const afuera = e => { if (ref.current && !ref.current.contains(e.target)) onCerrar() }
    const esc = e => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', afuera)
      document.removeEventListener('keydown', esc)
    }
  }, [onCerrar])

  return (
    <div ref={ref} className={`z-40 w-72 rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 ${className}`}>
      <div className="flex gap-1 border-b border-gray-100 px-2 pt-2 dark:border-zinc-800">
        {CATEGORIAS.map((c, i) => (
          <button
            key={c.nombre}
            onClick={() => setCategoria(i)}
            title={c.nombre}
            className={`flex-1 rounded-t-lg py-1.5 text-lg ${categoria === i ? 'bg-gray-100 dark:bg-zinc-800' : 'opacity-60 hover:opacity-100'}`}
          >{c.icono}</button>
        ))}
      </div>
      <div className="grid h-52 grid-cols-8 content-start gap-0.5 overflow-y-auto p-2">
        {CATEGORIAS[categoria].emojis.map(e => (
          <button
            key={e}
            onClick={() => onElegir(e)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl hover:bg-gray-100 dark:hover:bg-zinc-800"
          >{e}</button>
        ))}
      </div>
    </div>
  )
}
