const SCALE = 2
const PADDING = 16

/**
 * Rasterises a Recharts SVG and downloads it. Safe from canvas tainting because
 * Recharts emits plain inline SVG with no foreignObject or embedded images.
 */
export async function exportSvgToPng(
  svg: SVGSVGElement,
  filename: string,
  background: string
): Promise<void> {
  const rect = svg.getBoundingClientRect()

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(rect.width))
  clone.setAttribute('height', String(rect.height))
  // Axis and label fonts come from external CSS, which the raster cannot reach.
  clone.style.fontFamily = 'Inter, system-ui, sans-serif'

  const xml = new XMLSerializer().serializeToString(clone)
  const source = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)

  const image = await loadImage(source)

  const canvas = document.createElement('canvas')
  canvas.width = (rect.width + PADDING * 2) * SCALE
  canvas.height = (rect.height + PADDING * 2) * SCALE

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not get a 2D canvas context')
  }

  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, rect.width + PADDING * 2, rect.height + PADDING * 2)
  ctx.drawImage(image, PADDING, PADDING, rect.width, rect.height)

  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not render the chart image'))
    image.src = source
  })
}
