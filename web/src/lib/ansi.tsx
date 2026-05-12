import Anser from "anser";
import type { CSSProperties, ReactNode } from "react";

export function renderAnsi(text: string): ReactNode {
  if (!text) return null;
  const parsed = Anser.ansiToJson(text, { use_classes: false, remove_empty: false, json: true });
  return parsed.map((chunk, i) => {
    const style: CSSProperties = {};
    if (chunk.fg) style.color = `rgb(${chunk.fg})`;
    if (chunk.bg) style.backgroundColor = `rgb(${chunk.bg})`;
    const decos: string[] = Array.isArray(chunk.decorations)
      ? chunk.decorations
      : chunk.decoration
        ? [chunk.decoration]
        : [];
    if (decos.includes("bold")) style.fontWeight = "bold";
    if (decos.includes("italic")) style.fontStyle = "italic";
    if (decos.includes("underline")) style.textDecoration = "underline";
    if (decos.includes("dim")) style.opacity = 0.7;
    if (Object.keys(style).length === 0) return chunk.content;
    return (
      <span key={i} style={style}>
        {chunk.content}
      </span>
    );
  });
}
