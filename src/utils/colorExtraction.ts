import { getPaletteSync } from 'colorthief'

import type { PosterPalette } from '../types/movie'

const FALLBACK_PALETTE: PosterPalette = ['#111111', '#646464', '#B23A2E']

function createImageFromSource(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.referrerPolicy = 'no-referrer'

    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Nao foi possivel carregar a imagem para extrair cores'))

    img.src = src
  })
}

export function getFallbackPalette(): PosterPalette {
  return FALLBACK_PALETTE
}

export async function extractPalette(imageSource: string): Promise<PosterPalette> {
  try {
    const image = await createImageFromSource(imageSource)
    const palette = getPaletteSync(image, { colorCount: 3, quality: 8 })

    if (!palette || palette.length < 3) {
      return FALLBACK_PALETTE
    }

    return [palette[0].hex().toUpperCase(), palette[1].hex().toUpperCase(), palette[2].hex().toUpperCase()]
  } catch {
    return FALLBACK_PALETTE
  }
}
