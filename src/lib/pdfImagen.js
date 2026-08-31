// pdf-lib solo sabe embeber JPEG y PNG. Las fotos de hospedajes/habitaciones
// vienen de fuentes muy variadas (subidas a mano, importadas de Niara/Omnibees,
// etc.) y cada vez es mas comun que esten en formatos que el navegador SI sabe
// mostrar pero pdf-lib no — tipicamente AVIF o WebP. Antes eso hacia que
// embedPng() tirara una excepcion silenciosa (atrapada por el catch de cada
// llamado) y la foto quedara en blanco sin ningun aviso.
//
// Esta funcion detecta el formato real mirando los primeros bytes del archivo
// (la extension del nombre no es confiable: puede faltar, o mentir en una data
// URI) y si no es JPEG ni PNG, la redibuja en un <canvas> — que el navegador
// decodifica sin problema — y la exporta como PNG antes de embeberla.
export async function embedImagenAuto(doc, bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const esPng = arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4e && arr[3] === 0x47
  const esJpg = arr[0] === 0xff && arr[1] === 0xd8
  if (esPng) return doc.embedPng(bytes)
  if (esJpg) return doc.embedJpg(bytes)
  const pngBytes = await convertirAPng(bytes)
  return doc.embedPng(pngBytes)
}

function convertirAPng(bytes) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([bytes]))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      canvas.toBlob(async (pngBlob) => {
        URL.revokeObjectURL(url)
        if (!pngBlob) return reject(new Error('No se pudo convertir la imagen a PNG'))
        resolve(new Uint8Array(await pngBlob.arrayBuffer()))
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('El navegador no pudo decodificar esta imagen'))
    }
    img.src = url
  })
}
