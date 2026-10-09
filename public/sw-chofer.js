// Service worker del panel de chofer (/chofer/:token). Dos trabajos:
//  1. Hacer que el link se pueda "instalar" como ícono en el celular (Chrome/Android exige un
//     service worker registrado para ofrecer el instalador; sin esto no aparece la opción).
//  2. Mostrar la notificación cuando llega un push (se arma en una etapa siguiente, del lado
//     del servidor — este archivo ya queda listo para recibirlas).
// No cachea nada a propósito: el chofer siempre tiene que ver sus avisos más recientes, nunca
// una versión vieja guardada en el teléfono.

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  let datos
  try { datos = event.data.json() } catch { datos = { titulo: 'DreamTours', cuerpo: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(datos.titulo || 'DreamTours', {
      body: datos.cuerpo || 'Tens um aviso novo.',
      icon: '/icon-chofer-192.png',
      badge: '/icon-chofer-192.png',
      data: { url: datos.url || '/' },
    })
  )
})

// Al tocar la notificación, abre (o enfoca) la pestaña del panel del chofer.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const yaAbierta = lista.find((c) => c.url.includes(url))
      if (yaAbierta) return yaAbierta.focus()
      return self.clients.openWindow(url)
    })
  )
})
