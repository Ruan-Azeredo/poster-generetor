import { useMemo, useRef, useState, useEffect } from "react";
import type { FormEvent } from "react";
import { toPng } from "html-to-image";

import { ImageCropEditor } from "./components/ImageCropEditor";
import { PosterImageFrame } from "./components/PosterImageFrame";
import { fetchMoviePosterData } from "./services/movieApi";
import {
  extractPalette,
  extractPaletteFromImages,
  getFallbackPalette,
} from "./utils/colorExtraction";
import type {
  PosterImageMode,
  PosterImageTransform,
  PosterMovieData,
  PosterPalette,
  TripleSlotIndex,
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
  tmdbGalleryUrls: [],
};

const POSTER_W = 900;
const POSTER_H = 1200;
const DEFAULT_IMAGE_TRANSFORM: PosterImageTransform = { x: 0, y: 0, zoom: 1 };
const TRIPLE_SLOTS: readonly TripleSlotIndex[] = [0, 1, 2];

type TripleStrings = [string, string, string];
type TripleTransforms = [
  PosterImageTransform,
  PosterImageTransform,
  PosterImageTransform,
];

function createDefaultTripleTransforms(): TripleTransforms {
  return [
    { ...DEFAULT_IMAGE_TRANSFORM },
    { ...DEFAULT_IMAGE_TRANSFORM },
    { ...DEFAULT_IMAGE_TRANSFORM },
  ];
}

function toTripleTuple(urls: string[]): TripleStrings {
  return [urls[0] ?? "", urls[1] ?? "", urls[2] ?? ""];
}

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
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const tripleSlotRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("Spider-Man: Into the Spider-Verse");
  const [imageMode, setImageMode] = useState<PosterImageMode>("single");

  // Single-image state (default mode)
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [posterImage, setPosterImage] = useState("");
  const [imageTransform, setImageTransform] =
    useState<PosterImageTransform>(DEFAULT_IMAGE_TRANSFORM);
  const [posterAspect, setPosterAspect] = useState(67 / 45);

  // Triple-image state (3 horizontal strips variation)
  const [tripleImageUrlInputs, setTripleImageUrlInputs] =
    useState<TripleStrings>(["", "", ""]);
  const [tripleImages, setTripleImages] = useState<TripleStrings>(["", "", ""]);
  const [tripleTransforms, setTripleTransforms] = useState<TripleTransforms>(
    createDefaultTripleTransforms,
  );
  const [tripleSlotAspect, setTripleSlotAspect] = useState(804 / 168);
  const [activeTripleSlot, setActiveTripleSlot] = useState<TripleSlotIndex>(0);

  const [movieData, setMovieData] = useState<PosterMovieData>(INITIAL_MOVIE);
  const [palette, setPalette] = useState<PosterPalette>(getFallbackPalette());
  const [useTmdbImage, setUseTmdbImage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const target =
      imageMode === "single" ? imageWrapRef.current : tripleSlotRef.current;
    if (!target) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          const aspect = entry.contentRect.width / entry.contentRect.height;
          if (imageMode === "single") {
            setPosterAspect(aspect);
          } else {
            setTripleSlotAspect(aspect);
          }
        }
      }
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, [imageMode]);

  const castColumns = useMemo(
    () => distributeCast(movieData.cast),
    [movieData.cast],
  );

  const hasAnyTripleImage = tripleImages.some(Boolean);
  const activeTripleImage = tripleImages[activeTripleSlot];

  async function updatePaletteFromSource(source: string) {
    const colors = await extractPalette(source);
    setPalette(colors);
  }

  async function updatePaletteFromMultiple(sources: string[]) {
    const colors = await extractPaletteFromImages(sources);
    setPalette(colors);
  }

  function resetImageTransform() {
    setImageTransform(DEFAULT_IMAGE_TRANSFORM);
  }

  function resetTripleSlotTransform(slotIndex: TripleSlotIndex) {
    setTripleTransforms((prev) => {
      const next: TripleTransforms = [...prev];
      next[slotIndex] = { ...DEFAULT_IMAGE_TRANSFORM };
      return next;
    });
  }

  function updateTripleSlotTransform(
    slotIndex: TripleSlotIndex,
    transform: PosterImageTransform,
  ) {
    setTripleTransforms((prev) => {
      const next: TripleTransforms = [...prev];
      next[slotIndex] = transform;
      return next;
    });
  }

  async function applyPosterImage(source: string) {
    setPosterImage(source);
    resetImageTransform();
    await updatePaletteFromSource(source);
  }

  async function applyTripleImages(nextImages: TripleStrings) {
    setTripleImages(nextImages);
    setTripleTransforms(createDefaultTripleTransforms());

    const firstPopulated = TRIPLE_SLOTS.find((idx) => Boolean(nextImages[idx]));
    if (firstPopulated !== undefined) {
      setActiveTripleSlot(firstPopulated);
    }

    if (nextImages.some(Boolean)) {
      await updatePaletteFromMultiple(nextImages);
    } else {
      setPalette(getFallbackPalette());
    }
  }

  async function applyTripleSlotImage(
    slotIndex: TripleSlotIndex,
    source: string,
  ) {
    const nextImages: TripleStrings = [...tripleImages];
    nextImages[slotIndex] = source;

    setTripleImages(nextImages);
    resetTripleSlotTransform(slotIndex);

    if (source) {
      setActiveTripleSlot(slotIndex);
    } else {
      const fallbackSlot = TRIPLE_SLOTS.find((idx) => Boolean(nextImages[idx]));
      if (fallbackSlot !== undefined) {
        setActiveTripleSlot(fallbackSlot);
      }
    }

    if (nextImages.some(Boolean)) {
      await updatePaletteFromMultiple(nextImages);
    } else {
      setPalette(getFallbackPalette());
    }
  }

  function handleImageModeChange(nextMode: PosterImageMode) {
    if (nextMode === imageMode) {
      return;
    }

    setImageMode(nextMode);

    if (nextMode === "single") {
      if (posterImage) {
        void updatePaletteFromSource(posterImage);
      } else if (useTmdbImage && movieData.tmdbImageUrl) {
        void applyPosterImage(movieData.tmdbImageUrl);
      } else {
        setPalette(getFallbackPalette());
      }
      return;
    }

    // Switching to triple mode
    if (tripleImages.some(Boolean)) {
      const firstPopulated = TRIPLE_SLOTS.find((idx) =>
        Boolean(tripleImages[idx]),
      );
      if (firstPopulated !== undefined && !tripleImages[activeTripleSlot]) {
        setActiveTripleSlot(firstPopulated);
      }
      void updatePaletteFromMultiple(tripleImages);
    } else if (useTmdbImage && movieData.tmdbGalleryUrls.length > 0) {
      void applyTripleImages(toTripleTuple(movieData.tmdbGalleryUrls));
    } else {
      setPalette(getFallbackPalette());
    }
  }

  function handleTmdbToggle(checked: boolean) {
    setUseTmdbImage(checked);

    if (!checked) {
      return;
    }

    if (imageMode === "single") {
      if (movieData.tmdbImageUrl) {
        void applyPosterImage(movieData.tmdbImageUrl);
        return;
      }

      setPosterImage("");
      resetImageTransform();
      setPalette(getFallbackPalette());
      return;
    }

    if (movieData.tmdbGalleryUrls.length > 0) {
      void applyTripleImages(toTripleTuple(movieData.tmdbGalleryUrls));
      return;
    }

    void applyTripleImages(["", "", ""]);
  }

  async function handleImageUpload(file: File | null) {
    if (!file) {
      return;
    }

    const source = await toDataUrl(file);
    await applyPosterImage(source);
  }

  async function handleTripleImageUpload(
    slotIndex: TripleSlotIndex,
    file: File | null,
  ) {
    if (!file) {
      return;
    }

    const source = await toDataUrl(file);
    await applyTripleSlotImage(slotIndex, source);
  }

  function handleTripleUrlChange(slotIndex: TripleSlotIndex, value: string) {
    setTripleImageUrlInputs((prev) => {
      const next: TripleStrings = [...prev];
      next[slotIndex] = value;
      return next;
    });
  }

  function handleTripleUrlCommit(slotIndex: TripleSlotIndex) {
    if (useTmdbImage) {
      return;
    }

    const trimmed = tripleImageUrlInputs[slotIndex].trim();
    if (!trimmed || trimmed === tripleImages[slotIndex]) {
      return;
    }

    void applyTripleSlotImage(slotIndex, trimmed);
  }

  function handleTripleSlotClear(slotIndex: TripleSlotIndex) {
    setTripleImageUrlInputs((prev) => {
      const next: TripleStrings = [...prev];
      next[slotIndex] = "";
      return next;
    });
    void applyTripleSlotImage(slotIndex, "");
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await fetchMoviePosterData(query);
      setMovieData(data);

      if (imageMode === "single") {
        if (useTmdbImage && data.tmdbImageUrl) {
          await applyPosterImage(data.tmdbImageUrl);
        } else if (imageUrlInput.trim()) {
          await applyPosterImage(imageUrlInput.trim());
        } else if (useTmdbImage && !data.tmdbImageUrl) {
          setPosterImage("");
          resetImageTransform();
          setPalette(getFallbackPalette());
        } else if (!posterImage) {
          setPalette(getFallbackPalette());
        }
      } else {
        if (useTmdbImage) {
          await applyTripleImages(toTripleTuple(data.tmdbGalleryUrls));
        } else {
          const nextImages: TripleStrings = [
            tripleImageUrlInputs[0].trim() || tripleImages[0],
            tripleImageUrlInputs[1].trim() || tripleImages[1],
            tripleImageUrlInputs[2].trim() || tripleImages[2],
          ];
          const changed = TRIPLE_SLOTS.some(
            (idx) => nextImages[idx] !== tripleImages[idx],
          );

          if (changed) {
            setTripleImages(nextImages);
            setTripleTransforms((prev) => {
              const next: TripleTransforms = [...prev];
              TRIPLE_SLOTS.forEach((idx) => {
                if (nextImages[idx] !== tripleImages[idx]) {
                  next[idx] = { ...DEFAULT_IMAGE_TRANSFORM };
                }
              });
              return next;
            });
          }

          if (nextImages.some(Boolean)) {
            await updatePaletteFromMultiple(nextImages);
          } else {
            setPalette(getFallbackPalette());
          }
        }
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

          <div className="mode-toggle-group">
            <span className="field-label">Formato das imagens</span>
            <div
              className="segmented-toggle"
              role="radiogroup"
              aria-label="Formato das imagens do poster"
            >
              <button
                type="button"
                role="radio"
                aria-checked={imageMode === "single"}
                className={imageMode === "single" ? "is-active" : ""}
                onClick={() => handleImageModeChange("single")}
              >
                Imagem unica
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={imageMode === "triple"}
                className={imageMode === "triple" ? "is-active" : ""}
                onClick={() => handleImageModeChange("triple")}
              >
                3 imagens
              </button>
            </div>
          </div>

          {imageMode === "single" ? (
            <>
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
            </>
          ) : (
            <>
              <label className="toggle-row">
                Importar imagens do TMDB
                <input
                  type="checkbox"
                  checked={useTmdbImage}
                  onChange={(event) => handleTmdbToggle(event.target.checked)}
                />
              </label>

              {useTmdbImage ? (
                <p className="field-hint">
                  Desative a importacao do TMDB acima para enviar ou informar
                  ate 3 imagens proprias.
                </p>
              ) : null}

              <div className="triple-inputs">
                {TRIPLE_SLOTS.map((slotIndex) => {
                  const slotNumber = slotIndex + 1;
                  const hasImage = Boolean(tripleImages[slotIndex]);

                  return (
                    <div key={slotIndex} className="triple-input-card">
                      <div className="triple-input-card__head">
                        <span>Imagem {slotNumber}</span>
                        {hasImage && !useTmdbImage ? (
                          <button
                            type="button"
                            className="triple-input-card__clear"
                            onClick={() => handleTripleSlotClear(slotIndex)}
                          >
                            Remover
                          </button>
                        ) : null}
                      </div>

                      <input
                        disabled={useTmdbImage}
                        value={tripleImageUrlInputs[slotIndex]}
                        onChange={(event) =>
                          handleTripleUrlChange(slotIndex, event.target.value)
                        }
                        onBlur={() => handleTripleUrlCommit(slotIndex)}
                        placeholder={`URL da imagem ${slotNumber} (https://...)`}
                        aria-label={`URL da imagem ${slotNumber}`}
                      />

                      <input
                        type="file"
                        accept="image/*"
                        disabled={useTmdbImage}
                        aria-label={`Upload da imagem ${slotNumber}`}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          void handleTripleImageUpload(slotIndex, file);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}

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

        {imageMode === "single" && posterImage ? (
          <div className="crop-editor-panel">
            <ImageCropEditor
              key={`single-${posterImage}`}
              imageSrc={posterImage}
              transform={imageTransform}
              onTransformChange={setImageTransform}
              onReset={resetImageTransform}
              containerAspect={posterAspect}
            />
          </div>
        ) : null}

        {imageMode === "triple" && hasAnyTripleImage ? (
          <div className="crop-editor-panel">
            <div
              className="crop-slot-tabs"
              role="tablist"
              aria-label="Selecionar imagem para ajuste"
            >
              {TRIPLE_SLOTS.map((slotIndex) => {
                const hasSlotImage = Boolean(tripleImages[slotIndex]);
                const isSelected = activeTripleSlot === slotIndex;

                return (
                  <button
                    key={slotIndex}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    disabled={!hasSlotImage}
                    className={isSelected ? "is-active" : ""}
                    onClick={() => setActiveTripleSlot(slotIndex)}
                  >
                    Imagem {slotIndex + 1}
                  </button>
                );
              })}
            </div>

            {activeTripleImage ? (
              <ImageCropEditor
                key={`triple-${activeTripleSlot}-${activeTripleImage}`}
                title={`Ajuste da imagem ${activeTripleSlot + 1}`}
                imageSrc={activeTripleImage}
                transform={tripleTransforms[activeTripleSlot]}
                onTransformChange={(next) =>
                  updateTripleSlotTransform(activeTripleSlot, next)
                }
                onReset={() => resetTripleSlotTransform(activeTripleSlot)}
                containerAspect={tripleSlotAspect}
              />
            ) : null}
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
                {palette.map((color, index) => (
                  <span
                    key={`${color}-${index}`}
                    style={{ backgroundColor: color }}
                  />
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
            {imageMode === "single" ? (
              <div className="image-wrap" ref={imageWrapRef}>
                {posterImage ? (
                  <PosterImageFrame
                    key={posterImage}
                    src={posterImage}
                    alt={movieData.title}
                    transform={imageTransform}
                    containerAspect={posterAspect}
                  />
                ) : (
                  <div className="image-placeholder">
                    Envie uma imagem para o centro do poster
                  </div>
                )}
              </div>
            ) : (
              <div className="image-wrap--triple">
                {TRIPLE_SLOTS.map((slotIndex) => {
                  const slotImage = tripleImages[slotIndex];
                  const slotTransform = tripleTransforms[slotIndex];

                  return (
                    <div
                      key={slotIndex}
                      ref={slotIndex === 0 ? tripleSlotRef : undefined}
                      className="image-slot"
                      onClick={() => {
                        if (slotImage) {
                          setActiveTripleSlot(slotIndex);
                        }
                      }}
                    >
                      {slotImage ? (
                        <PosterImageFrame
                          key={slotImage}
                          src={slotImage}
                          alt={`${movieData.title} - imagem ${slotIndex + 1}`}
                          transform={slotTransform}
                          containerAspect={tripleSlotAspect}
                        />
                      ) : (
                        <div className="image-slot__placeholder">
                          Imagem {slotIndex + 1}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

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
