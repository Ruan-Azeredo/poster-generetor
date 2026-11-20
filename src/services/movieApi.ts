import type { PosterMovieData } from '../types/movie'

const TMDB_API_BASE = 'https://api.themoviedb.org/3'
const DEFAULT_LANG = 'en-US'

interface TmdbSearchResult {
  id: number
  media_type?: 'movie' | 'tv' | 'person'
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  release_date?: string
  first_air_date?: string
}

interface TmdbSearchResponse {
  results: TmdbSearchResult[]
}

interface TmdbCreditMember {
  name: string
  known_for_department?: string
  department?: string
  job?: string
  order?: number
}

interface TmdbCreditsResponse {
  cast: TmdbCreditMember[]
  crew: TmdbCreditMember[]
}

interface TmdbMovieDetails {
  title: string
  original_title: string
  release_date?: string
  tagline?: string
  poster_path?: string | null
  backdrop_path?: string | null
}

interface TmdbTvDetails {
  name: string
  original_name: string
  first_air_date?: string
  tagline?: string
  created_by?: Array<{ name: string }>
  poster_path?: string | null
  backdrop_path?: string | null
}

interface TmdbImageItem {
  file_path: string
}

interface TmdbImagesResponse {
  posters?: TmdbImageItem[]
  backdrops?: TmdbImageItem[]
}

function buildImageUrl(path?: string | null, size = 'w780') {
  if (!path) {
    return ''
  }

  return `https://image.tmdb.org/t/p/${size}${path}`
}

function getApiKey() {
  const key = import.meta.env.VITE_TMDB_API_KEY
  if (!key) {
    throw new Error('A chave VITE_TMDB_API_KEY nao foi configurada no .env')
  }

  return key
}

async function tmdbFetch<T>(path: string, extraParams?: Record<string, string>) {
  const url = new URL(`${TMDB_API_BASE}${path}`)
  url.searchParams.set('api_key', getApiKey())
  url.searchParams.set('language', DEFAULT_LANG)

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      url.searchParams.set(key, value)
    }
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Falha ao consultar o TMDb')
  }

  return (await response.json()) as T
}

async function fetchTmdbGallery(
  mediaType: 'movie' | 'tv',
  id: number,
  fallbackPaths: Array<string | null | undefined>,
) {
  const uniquePaths = new Set<string>()

  for (const path of fallbackPaths) {
    if (path) {
      uniquePaths.add(path)
    }
  }

  try {
    const images = await tmdbFetch<TmdbImagesResponse>(`/${mediaType}/${id}/images`, {
      include_image_language: 'en,null',
    })

    for (const item of images.backdrops ?? []) {
      if (uniquePaths.size >= 3) break
      if (item.file_path) {
        uniquePaths.add(item.file_path)
      }
    }

    for (const item of images.posters ?? []) {
      if (uniquePaths.size >= 3) break
      if (item.file_path) {
        uniquePaths.add(item.file_path)
      }
    }
  } catch {
    // Fallback to backdrop_path / poster_path already added above
  }

  return [...uniquePaths]
    .slice(0, 3)
    .map((path) => buildImageUrl(path, 'w780'))
    .filter(Boolean)
}

function getYear(date?: string) {
  if (!date) {
    return '----'
  }

  return date.split('-')[0] || '----'
}

function uniqueByName(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))]
}

function getMovieDirectors(crew: TmdbCreditMember[]) {
  return uniqueByName(crew.filter((item) => item.job === 'Director').map((item) => item.name))
}

function getMovieWriters(crew: TmdbCreditMember[]) {
  return uniqueByName(
    crew
      .filter((item) => item.job === 'Writer' || item.job === 'Screenplay' || item.job === 'Story')
      .map((item) => item.name),
  )
}

function getTvDirectors(crew: TmdbCreditMember[], createdBy: Array<{ name: string }> = []) {
  const episodicDirectors = uniqueByName(
    crew.filter((item) => item.job === 'Director').map((item) => item.name),
  )

  if (episodicDirectors.length > 0) {
    return episodicDirectors
  }

  return uniqueByName(createdBy.map((person) => person.name))
}

function getTvWriters(crew: TmdbCreditMember[], createdBy: Array<{ name: string }> = []) {
  const writers = uniqueByName(
    crew
      .filter((item) => item.job === 'Writer' || item.job === 'Screenplay' || item.job === 'Story')
      .map((item) => item.name),
  )

  if (writers.length > 0) {
    return writers
  }

  return uniqueByName(createdBy.map((person) => person.name))
}

function getCast(cast: TmdbCreditMember[]) {
  return cast
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 10)
    .map((item) => item.name)
}

async function searchByQuery(query: string) {
  const encoded = encodeURIComponent(query)
  const response = await tmdbFetch<TmdbSearchResponse>(`/search/multi?query=${encoded}&include_adult=false`)

  const firstMatch = response.results.find(
    (item) => item.media_type === 'movie' || item.media_type === 'tv',
  )

  if (!firstMatch || !firstMatch.media_type) {
    throw new Error('Filme ou serie nao encontrado')
  }

  return firstMatch
}

async function fetchMovieData(id: number): Promise<PosterMovieData> {
  const [details, credits] = await Promise.all([
    tmdbFetch<TmdbMovieDetails>(`/movie/${id}`),
    tmdbFetch<TmdbCreditsResponse>(`/movie/${id}/credits`),
  ])

  const tmdbGalleryUrls = await fetchTmdbGallery('movie', id, [
    details.backdrop_path,
    details.poster_path,
  ])

  return {
    title: details.title,
    originalTitle: details.original_title,
    year: getYear(details.release_date),
    tagline: details.tagline?.trim() || details.original_title,
    directors: getMovieDirectors(credits.crew),
    writers: getMovieWriters(credits.crew),
    cast: getCast(credits.cast),
    tmdbImageUrl: buildImageUrl(details.poster_path, 'w780') || buildImageUrl(details.backdrop_path, 'w780'),
    tmdbPosterUrl: buildImageUrl(details.poster_path, 'w780'),
    tmdbBackdropUrl: buildImageUrl(details.backdrop_path, 'w780'),
    tmdbGalleryUrls,
  }
}

async function fetchTvData(id: number): Promise<PosterMovieData> {
  const [details, credits] = await Promise.all([
    tmdbFetch<TmdbTvDetails>(`/tv/${id}`),
    tmdbFetch<TmdbCreditsResponse>(`/tv/${id}/aggregate_credits`),
  ])

  const tmdbGalleryUrls = await fetchTmdbGallery('tv', id, [
    details.backdrop_path,
    details.poster_path,
  ])

  return {
    title: details.name,
    originalTitle: details.original_name,
    year: getYear(details.first_air_date),
    tagline: details.tagline?.trim() || details.original_name,
    directors: getTvDirectors(credits.crew, details.created_by),
    writers: getTvWriters(credits.crew, details.created_by),
    cast: getCast(credits.cast),
    tmdbImageUrl: buildImageUrl(details.poster_path, 'w780') || buildImageUrl(details.backdrop_path, 'w780'),
    tmdbPosterUrl: buildImageUrl(details.poster_path, 'w780'),
    tmdbBackdropUrl: buildImageUrl(details.backdrop_path, 'w780'),
    tmdbGalleryUrls,
  }
}

export async function fetchMoviePosterData(query: string): Promise<PosterMovieData> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    throw new Error('Digite um titulo antes de buscar')
  }

  const firstMatch = await searchByQuery(normalizedQuery)

  if (firstMatch.media_type === 'movie') {
    return fetchMovieData(firstMatch.id)
  }

  return fetchTvData(firstMatch.id)
}
