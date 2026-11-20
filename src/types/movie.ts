export interface PosterMovieData {
  title: string
  originalTitle: string
  year: string
  tagline: string
  directors: string[]
  writers: string[]
  cast: string[]
  tmdbImageUrl: string
  tmdbPosterUrl: string
  tmdbBackdropUrl: string
}

export type PosterPalette = [string, string, string]

export interface PosterImageTransform {
  x: number
  y: number
  zoom: number
}
