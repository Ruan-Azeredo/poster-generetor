import type { CSSProperties } from "react";

export function getCoverImageStyle(
  naturalAspect: number | null,
  containerAspect: number,
): CSSProperties {
  if (!naturalAspect || !Number.isFinite(naturalAspect) || naturalAspect <= 0) {
    return {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      maxWidth: "none",
      maxHeight: "none",
    };
  }

  const isWiderThanContainer = naturalAspect > containerAspect;

  return {
    width: isWiderThanContainer ? "auto" : "100%",
    height: isWiderThanContainer ? "100%" : "auto",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    maxWidth: "none",
    maxHeight: "none",
  };
}

