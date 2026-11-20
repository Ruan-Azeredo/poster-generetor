import { useCallback, useState } from "react";

import type { PosterImageTransform } from "../types/movie";
import { getCoverImageStyle } from "../utils/imageLayout";

interface PosterImageFrameProps {
  src: string;
  alt: string;
  transform: PosterImageTransform;
  containerAspect: number;
}

export function PosterImageFrame({
  src,
  alt,
  transform,
  containerAspect,
}: PosterImageFrameProps) {
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);

  const handleImgRef = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const nextAspect = img.naturalWidth / img.naturalHeight;
      setNaturalAspect((prev) => (prev === nextAspect ? prev : nextAspect));
    }
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `translate3d(${transform.x}%, ${transform.y}%, 0) scale(${transform.zoom})`,
        transformOrigin: "center center",
        zIndex: 1,
      }}
    >
      <img
        ref={handleImgRef}
        src={src}
        alt={alt}
        className="poster-image"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (naturalWidth > 0 && naturalHeight > 0) {
            setNaturalAspect(naturalWidth / naturalHeight);
          }
        }}
        style={getCoverImageStyle(naturalAspect, containerAspect)}
      />
    </div>
  );
}
