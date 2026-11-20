import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { PosterImageTransform } from "../types/movie";
import { getCoverImageStyle } from "../utils/imageLayout";

interface ImageCropEditorProps {
  imageSrc: string;
  transform: PosterImageTransform;
  onTransformChange: (next: PosterImageTransform) => void;
  onReset: () => void;
  containerAspect?: number;
  title?: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const FALLBACK_ASPECT = 67 / 45;
const WORKSPACE_ASPECT = 4 / 3;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function ImageCropEditor({
  imageSrc,
  transform,
  onTransformChange,
  onReset,
  containerAspect = FALLBACK_ASPECT,
  title = "Ajuste da imagem do poster",
}: ImageCropEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
    zoom: number;
  } | null>(null);

  const [dragging, setDragging] = useState(false);
  const [imageAspect, setImageAspect] = useState<number | null>(null);

  const effectiveAspect = imageAspect ?? containerAspect;
  const baseWidth =
    effectiveAspect > containerAspect ? effectiveAspect / containerAspect : 1;
  const baseHeight =
    effectiveAspect > containerAspect ? 1 : containerAspect / effectiveAspect;

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

  const clampTransformRef = useRef(clampTransform);
  const onTransformChangeRef = useRef(onTransformChange);

  useEffect(() => {
    clampTransformRef.current = clampTransform;
    onTransformChangeRef.current = onTransformChange;
  }, [clampTransform, onTransformChange]);

  useEffect(() => {
    if (!dragging) return;

    function handlePointerMove(event: PointerEvent) {
      if (!dragStartRef.current || !stageRef.current) {
        return;
      }

      const { pointerX, pointerY, startX, startY, zoom } = dragStartRef.current;
      const rect = stageRef.current.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const dxPercent = ((event.clientX - pointerX) / rect.width) * 100;
      const dyPercent = ((event.clientY - pointerY) / rect.height) * 100;

      onTransformChangeRef.current(
        clampTransformRef.current({
          zoom,
          x: startX + dxPercent,
          y: startY + dyPercent,
        }),
      );
    }

    function stopDragging() {
      dragStartRef.current = null;
      setDragging(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [dragging]);

  function startDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !stageRef.current) {
      return;
    }

    event.preventDefault();
    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: transform.x,
      startY: transform.y,
      zoom: transform.zoom,
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

  const syncNaturalAspect = useCallback(
    (naturalWidth: number, naturalHeight: number) => {
      if (naturalWidth <= 0 || naturalHeight <= 0) {
        return;
      }

      const nextAspect = naturalWidth / naturalHeight;
      setImageAspect((prev) => (prev === nextAspect ? prev : nextAspect));

      const nextBaseWidth =
        nextAspect > containerAspect ? nextAspect / containerAspect : 1;
      const nextBaseHeight =
        nextAspect > containerAspect ? 1 : containerAspect / nextAspect;
      const clampedZoom = clamp(transform.zoom, MIN_ZOOM, MAX_ZOOM);
      const maxX = Math.max(0, ((nextBaseWidth * clampedZoom - 1) / 2) * 100);
      const maxY = Math.max(0, ((nextBaseHeight * clampedZoom - 1) / 2) * 100);
      const clampedX = clamp(transform.x, -maxX, maxX);
      const clampedY = clamp(transform.y, -maxY, maxY);

      if (
        clampedZoom !== transform.zoom ||
        clampedX !== transform.x ||
        clampedY !== transform.y
      ) {
        onTransformChange({
          zoom: clampedZoom,
          x: clampedX,
          y: clampedY,
        });
      }
    },
    [containerAspect, onTransformChange, transform.x, transform.y, transform.zoom],
  );

  const handleImgRef = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
        syncNaturalAspect(img.naturalWidth, img.naturalHeight);
      }
    },
    [syncNaturalAspect],
  );

  const isPortraitStage = containerAspect < WORKSPACE_ASPECT;

  return (
    <section className="crop-editor" aria-label="Editor de corte da imagem">
      <div className="crop-editor__head">
        <h2>{title}</h2>
        <button type="button" onClick={onReset}>
          Resetar
        </button>
      </div>

      <p>
        Arraste a imagem para escolher o recorte e ajuste o zoom mantendo a
        proporcao exata do poster.
      </p>

      <div
        className={`crop-editor__workspace${dragging ? " is-dragging" : ""}`}
        onPointerDown={startDragging}
      >
        <div
          ref={stageRef}
          className={`crop-editor__stage${isPortraitStage ? " crop-editor__stage--portrait" : ""}`}
          style={{ aspectRatio: containerAspect }}
        >
          <div
            className="crop-editor__image-layer"
            style={{
              transform: `translate3d(${transform.x}%, ${transform.y}%, 0) scale(${transform.zoom})`,
            }}
          >
            <img
              ref={handleImgRef}
              src={imageSrc}
              alt="Previa de corte"
              className="crop-editor__crop-image"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              draggable={false}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                syncNaturalAspect(naturalWidth, naturalHeight);
              }}
              style={getCoverImageStyle(imageAspect, containerAspect)}
            />
          </div>
          <div className="crop-editor__mask" aria-hidden />
        </div>
        <div className="crop-editor__hint">Area exibida no poster</div>
      </div>

      <div className="crop-editor__controls">
        <label>
          Zoom ({MIN_ZOOM.toFixed(1)}x - {MAX_ZOOM.toFixed(1)}x)
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
