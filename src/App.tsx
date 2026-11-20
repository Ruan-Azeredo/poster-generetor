import { useMemo, useRef, useState, useEffect } from "react";
import type { FormEvent } from "react";
import { toPng } from "html-to-image";

import { ImageCropEditor } from "./components/ImageCropEditor";
import { fetchMoviePosterData } from "./services/movieApi";
import { extractPalette, getFallbackPalette } from "./utils/colorExtraction";
import type {
  PosterImageTransform,
  PosterMovieData,
  PosterPalette,
} from "./types/movie";

const INITIAL_MOVIE: PosterMovieData = {
  title: "SPIDER-MAN",
  originalTitle: "Into the Spider-Verse",
  year: "2018",
  tagline: "The world needs every Spider",
  directors: ["Bob Persichetti", "Peter Ramsey", "Rodney Rothman"],
  writers: ["Phil Lord", "Rodney Rothman"],
  cast: [
    "Shameik Moore",
    "Jake Johnson",
    "Hailee Steinfeld",
    "Mahershala Ali",
    "Brian Tyree Henry",
    "Lily Tomlin",
    "Luna Lauren Velez",
    "John Mulaney",
    "Nicolas Cage",
    "Kimiko Glenn",
  ],
  tmdbImageUrl: "",
  tmdbPosterUrl: "",
  tmdbBackdropUrl: "",
};

const POSTER_W = 900;
const POSTER_H = 1200;
const DEFAULT_IMAGE_TRANSFORM: PosterImageTransform = { x: 0, y: 0, zoom: 1 };

function distributeCast(cast: string[], columns = 4) {
  const names = cast.slice(0, 10);
  const grid = Array.from({ length: columns }, () => [] as string[]);

  names.forEach((name, index) => {
    grid[index % columns].push(name);
  });

  return grid;
}

function getTitleClass(title: string) {
  const length = title.trim().length;
  if (length > 26) {
    return "poster-title poster-title--small";
  }

  if (length > 18) {
    return "poster-title poster-title--medium";
  }

  return "poster-title";
}

function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(new Error("Falha ao ler o arquivo de imagem"));
    reader.readAsDataURL(file);
  });
}

function App() {
  const posterRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("Spider-Man: Into the Spider-Verse");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [movieData, setMovieData] = useState<PosterMovieData>(INITIAL_MOVIE);
  const [palette, setPalette] = useState<PosterPalette>(getFallbackPalette());
  const [posterImage, setPosterImage] = useState("");
  const [imageTransform, setImageTransform] =
    useState<PosterImageTransform>(DEFAULT_IMAGE_TRANSFORM);
  const [useTmdbImage, setUseTmdbImage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [posterAspect, setPosterAspect] = useState(67 / 45);
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!imageWrapRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setPosterAspect(entry.contentRect.width / entry.contentRect.height);
        }
      }
    });
    observer.observe(imageWrapRef.current);
    return () => observer.disconnect();
  }, []);

  const castColumns = useMemo(
    () => distributeCast(movieData.cast),
    [movieData.cast],
  );

  async function updatePaletteFromSource(source: string) {
    const colors = await extractPalette(source);
    setPalette(colors);
  }

  function resetImageTransform() {
    setImageTransform(DEFAULT_IMAGE_TRANSFORM);
  }

  async function applyPosterImage(source: string) {
    setPosterImage(source);
    resetImageTransform();
    setImageAspect(null);
    await updatePaletteFromSource(source);
  }

  function handleTmdbToggle(checked: boolean) {
    setUseTmdbImage(checked);

    if (!checked) {
      return;
    }

    if (movieData.tmdbImageUrl) {
      void applyPosterImage(movieData.tmdbImageUrl);
      return;
    }

    setPosterImage("");
    resetImageTransform();
    setImageAspect(null);
    setPalette(getFallbackPalette());
  }

  async function handleImageUpload(file: File | null) {
    if (!file) {
      return;
    }

    const source = await toDataUrl(file);
    await applyPosterImage(source);
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await fetchMoviePosterData(query);
      setMovieData(data);

      if (useTmdbImage && data.tmdbImageUrl) {
        await applyPosterImage(data.tmdbImageUrl);
      } else if (imageUrlInput.trim()) {
        await applyPosterImage(imageUrlInput.trim());
      } else if (useTmdbImage && !data.tmdbImageUrl) {
        setPosterImage("");
        resetImageTransform();
        setImageAspect(null);
        setPalette(getFallbackPalette());
      } else if (!posterImage) {
        setPalette(getFallbackPalette());
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Nao foi possivel gerar o poster",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPng() {
    if (!posterRef.current) {
      return;
    }

    setExporting(true);

    try {
      if ("fonts" in document) {
        await document.fonts.ready;
      }

      const dataUrl = await toPng(posterRef.current, {
        backgroundColor: "#F0EDE4",
        pixelRatio: 3,
        width: POSTER_W,
        height: POSTER_H,
        style: {
          transform: "none",
          transformOrigin: "top left",
          margin: "0",
        },
      });

      const link = document.createElement("a");
      link.download = `${movieData.title.replace(/\s+/g, "-").toLowerCase()}-swiss-poster.png`;
      link.href = dataUrl;
      link.click();
    } catch (exportError) {
      console.error("Erro ao exportar:", exportError);
      setError("Falha ao exportar poster em alta resolucao.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="control-panel">
        <h1>Swiss Poster Generator</h1>
        <p>
          Digite um titulo, envie uma imagem central e gere um poster automatico
          em estilo tipografico internacional.
        </p>

        <form className="control-form" onSubmit={handleGenerate}>
          <label>
            Nome do filme ou serie
            <input
              required
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex: Blade Runner"
            />
          </label>

          <label>
            URL da imagem central
            <input
              disabled={useTmdbImage}
              value={imageUrlInput}
              onChange={(event) => setImageUrlInput(event.target.value)}
              placeholder="https://..."
            />
          </label>

          <label className="toggle-row">
            Importar imagem do TMDB
            <input
              type="checkbox"
              checked={useTmdbImage}
              onChange={(event) => handleTmdbToggle(event.target.checked)}
            />
          </label>

          <label>
            Upload da imagem central
            <input
              type="file"
              accept="image/*"
              disabled={useTmdbImage}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handleImageUpload(file);
              }}
            />
          </label>

          <div className="actions">
            <button type="submit" disabled={loading}>
              {loading ? "Gerando..." : "Gerar poster"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleExportPng}
              disabled={exporting}
            >
              {exporting ? "Exportando..." : "Exportar PNG"}
            </button>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </form>

        {posterImage ? (
          <div className="crop-editor-panel">
            <ImageCropEditor
              imageSrc={posterImage}
              transform={imageTransform}
              onTransformChange={setImageTransform}
              onReset={resetImageTransform}
              containerAspect={posterAspect}
            />
          </div>
        ) : null}
      </section>

      <section className="poster-stage">
        <div
          ref={posterRef}
          className="poster"
          style={{
            width: `${POSTER_W}px`,
            height: `${POSTER_H}px`,
          }}
        >
          <header className="poster-header">
            <div className="header-top">
              <div className="palette-bar" aria-hidden>
                {palette.map((color) => (
                  <span key={color} style={{ backgroundColor: color }} />
                ))}
              </div>
              <div className="cinema-mark" aria-hidden>
                <span className="mark-dot" />
              </div>
            </div>

            <div className="header-info">
              <div>
                <h2 className={getTitleClass(movieData.title)}>
                  {movieData.title}
                </h2>
                <p className="poster-tagline">
                  {movieData.tagline || movieData.originalTitle}
                </p>
              </div>

              <div className="directed-by">
                <p>Directed by</p>
                <p>{movieData.directors.join(" / ") || "N/A"}</p>
              </div>
            </div>
          </header>

          <section className="poster-middle">
            <div className="image-wrap" ref={imageWrapRef}>
              {posterImage ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    transform: `translate3d(${imageTransform.x}%, ${imageTransform.y}%, 0) scale(${imageTransform.zoom})`,
                    zIndex: 1,
                  }}
                >
                  <img
                    src={posterImage}
                    alt={movieData.title}
                    className="poster-image"
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    onLoad={(e) => {
                      const { naturalWidth, naturalHeight } = e.currentTarget;
                      if (naturalWidth > 0 && naturalHeight > 0) {
                        setImageAspect(naturalWidth / naturalHeight);
                      }
                    }}
                    style={{
                      width: imageAspect
                        ? `${
                            (imageAspect > posterAspect
                              ? imageAspect / posterAspect
                              : 1) * 100
                          }%`
                        : "100%",
                      height: imageAspect
                        ? `${
                            (imageAspect > posterAspect
                              ? 1
                              : posterAspect / imageAspect) * 100
                          }%`
                        : "100%",
                      left: "50%",
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      maxWidth: "none",
                    }}
                  />
                </div>
              ) : (
                <div className="image-placeholder">
                  Envie uma imagem para o centro do poster
                </div>
              )}
            </div>

            <div className="middle-meta">
              <div>
                <p className="meta-label">Story by</p>
                <p className="meta-text">
                  {movieData.writers.join(" / ") || "N/A"}
                </p>
              </div>
              <div className="award-seal" aria-label="Selo de premio" />
            </div>
          </section>

          <footer className="poster-footer">
            <div>
              <p className="meta-label">Casting</p>
              <div className="casting-grid">
                {castColumns.map((column, index) => (
                  <ul key={`cast-column-${index}`}>
                    {column.map((name) => (
                      <li key={`${index}-${name}`}>{name}</li>
                    ))}
                  </ul>
                ))}
              </div>
            </div>

            <p className="release-year">/{movieData.year}</p>
          </footer>
        </div>
      </section>
    </main>
  );
}

export default App;
