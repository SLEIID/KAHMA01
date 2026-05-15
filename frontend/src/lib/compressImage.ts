/**
 * Compresses an image file using Canvas API.
 * Resizes to max 1200px on the longest side, encodes as JPEG @ 75% quality.
 * Returns a new File (~10–15x smaller than a typical phone photo).
 */
export function compressImage(file: File, maxPx = 1200, quality = 0.75): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height * maxPx) / width)
          width = maxPx
        } else {
          width = Math.round((width * maxPx) / height)
          height = maxPx
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Kompresja nie powiodła się')); return }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Nie można wczytać obrazu')) }
    img.src = url
  })
}
