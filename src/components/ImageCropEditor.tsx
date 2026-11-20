import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useRef, useState, useCallback } from "react";

import type { PosterImageTransform } from "../types/movie";

interface ImageCropEditorProps {
  imageSrc: string;
  transform: PosterImageTransform;
  onTransformChange: (next: PosterImageTransform) => void;
  onReset: () => void;
  containerAspect?: number;
}

const MIN_ZOOM = 0.8;
const MAX_ZOOM = 2.2;
const FALLBACK_ASPECT = 67 / 45;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function ImageCropEditor({
  imageSrc,
  transform,
  onTransformChange,
  onReset,
  containerAspect = FALLBACK_ASPECT,
}: ImageCropEditorProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const [dragging, setDragging] = useState(false);
  const [imageAspect, setImageAspect] = useState(containerAspect);

  const baseWidth =
    imageAspect > containerAspect ? imageAspect / containerAspect : 1;
  const baseHeight =
    imageAspect > containerAspect ? 1 : containerAspect / imageAspect;

  const getPanBounds = useCallback(
    (zoom: number) => {
      const renderedWidth = baseWidth * zoom;
      const renderedHeight = baseHeight * zoom;

      return {
        x: Math.max(0, ((renderedWidth - 1) / 2) * 100),
        y: Math.max(0, ((renderedHeight - 1) / 2) * 100),
      };
    },
    [baseWidth, baseHeight],
  );

  const clampTransform = useCallback(
    (next: PosterImageTransform) => {
      const nextZoom = clamp(next.zoom, MIN_ZOOM, MAX_ZOOM);
      const bounds = getPanBounds(nextZoom);

      return {
        zoom: nextZoom,
        x: clamp(next.x, -bounds.x, bounds.x),
        y: clamp(next.y, -bounds.y, bounds.y),
      };
    },
    [getPanBounds],
  );

  useEffect(() => {
    if (!dragging) return;

    function handleMouseMove(event: MouseEvent) {
      if (!dragStartRef.current || !viewportRef.current) {
        return;
      }

      const { pointerX, pointerY, startX, startY } = dragStartRef.current;
      const rect = viewportRef.current.getBoundingClientRect();

      const dxPercent =
        (((event.clientX - pointerX) / rect.width) * 100) / transform.zoom;
      const dyPercent =
        (((event.clientY - pointerY) / rect.height) * 100) / transform.zoom;

      onTransformChange(
        clampTransform({
          ...transform,
          x: startX + dxPercent,
          y: startY + dyPercent,
        }),
      );
    }

    function stopDragging() {
      dragStartRef.current = null;
      setDragging(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDragging);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDragging);
    };
  }, [dragging, transform, clampTransform, onTransformChange]);

  function startDragging(event: ReactMouseEvent<HTMLDivElement>) {
    if (!viewportRef.current) {
      return;
    }

    event.preventDefault();
    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: transform.x,
      startY: transform.y,
    };

    setDragging(true);
  }

  function updateZoom(value: string) {
    const nextZoom = Number(value);
    if (!Number.isFinite(nextZoom)) {
      return;
    }

    onTransformChange(
      clampTransform({
        ...transform,
        zoom: nextZoom,
      }),
    );
  }

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget;

    if (naturalWidth <= 0 || naturalHeight <= 0) {
      return;
    }

    setImageAspect(naturalWidth / naturalHeight);
    onTransformChange(clampTransform(transform));
  }

  return (
    <section className="crop-editor" aria-label="Editor de corte da imagem">
      <div className="crop-editor__head">
        <h2>Ajuste da imagem do poster</h2>
        <button type="button" onClick={onReset}>
          Resetar
        </button>
      </div>

      <p>
        Arraste para reposicionar no corte e ajuste o zoom mantendo a proporcao
        da imagem do poster.
      </p>

      <div className="crop-editor__workspace">
        <img
          src={imageSrc}
          alt="Imagem original"
          className="crop-editor__image"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={handleImageLoad}
        />
        <div
          ref={viewportRef}
          className={`crop-editor__crop-window${dragging ? " is-dragging" : ""}`}
          onMouseDown={startDragging}
          style={{ aspectRatio: containerAspect }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `translate3d(${transform.x}%, ${transform.y}%, 0) scale(${transform.zoom})`,
              pointerEvents: "none",
            }}
          >
            <img
              src={imageSrc}
              alt="Previa de corte"
              className="crop-editor__crop-image"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              draggable={false}
              style={{
                width: `${baseWidth * 100}%`,
                height: `${baseHeight * 100}%`,
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                maxWidth: "none",
              }}
            />
          </div>
        </div>
        <div className="crop-editor__hint">Area exibida no poster</div>
      </div>

      <div className="crop-editor__controls">
        <label>
          Zoom minimo {MIN_ZOOM.toFixed(1)}x
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={transform.zoom}
            onChange={(event) => updateZoom(event.target.value)}
          />
        </label>

        <div className="crop-editor__meta">
          <span>X: {transform.x.toFixed(1)}%</span>
          <span>Y: {transform.y.toFixed(1)}%</span>
          <span>Zoom: {transform.zoom.toFixed(2)}x</span>
        </div>
      </div>
    </section>
  );
}
