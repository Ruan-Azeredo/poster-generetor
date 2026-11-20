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

export async function extractPaletteFromImages(imageSources: string[]): Promise<PosterPalette> {
  const validSources = imageSources.map((source) => source.trim()).filter(Boolean)

  if (validSources.length === 0) {
    return FALLBACK_PALETTE
  }

  if (validSources.length === 1) {
    return extractPalette(validSources[0])
  }

  const extractedPalettes = await Promise.all(
    validSources.map(async (source) => {
      try {
        const image = await createImageFromSource(source)
        const palette = getPaletteSync(image, { colorCount: 3, quality: 8 })
        return palette ? palette.map((color) => color.hex().toUpperCase()) : []
      } catch {
        return [] as string[]
      }
    }),
  )

  const nonEmptyPalettes = extractedPalettes.filter((colors) => colors.length > 0)
  if (nonEmptyPalettes.length === 0) {
    return FALLBACK_PALETTE
  }

  const selected: string[] = []

  // First pass: pick the most prominent distinct color from each image
  for (const colors of nonEmptyPalettes) {
    const candidate = colors.find((hex) => !selected.includes(hex)) ?? colors[0]
    if (candidate && selected.length < 3) {
      selected.push(candidate)
    }
  }

  // Second pass: fill remaining slots from secondary colors
  for (const colors of nonEmptyPalettes) {
    for (const hex of colors) {
      if (selected.length >= 3) break
      if (!selected.includes(hex)) {
        selected.push(hex)
      }
    }
  }

  // Fallback pass: guarantee 3 colors
  for (const fallbackColor of FALLBACK_PALETTE) {
    if (selected.length >= 3) break
    selected.push(fallbackColor)
  }

  return [selected[0], selected[1], selected[2]]
}
