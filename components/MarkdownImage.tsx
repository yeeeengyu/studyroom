import type { ComponentProps, CSSProperties } from "react";
import { assetUrl } from "@/lib/api";

type MarkdownImageProps = ComponentProps<"img"> & {
  node?: unknown;
};

type ParsedImageAlt = {
  alt: string;
  width?: CSSProperties["width"];
};

function parseImageAlt(alt: string): ParsedImageAlt {
  const separatorIndex = alt.lastIndexOf("|");
  if (separatorIndex === -1) return { alt };

  const label = alt.slice(0, separatorIndex).trim();
  const size = alt.slice(separatorIndex + 1).trim().toLowerCase();
  const match = size.match(/^(\d{1,4})(px|%)?$/);
  if (!match) return { alt };

  const value = Number(match[1]);
  const unit = match[2] || "px";
  if (value < 1 || (unit === "%" && value > 100)) return { alt };

  return { alt: label, width: `${value}${unit}` };
}

export function MarkdownImage({
  node: _node,
  src = "",
  alt = "",
  className,
  style,
  ...props
}: MarkdownImageProps) {
  const parsed = parseImageAlt(String(alt));
  const classes = ["markdown-image", className].filter(Boolean).join(" ");
  const imageStyle = parsed.width ? { ...style, width: parsed.width } : style;

  return (
    <img
      {...props}
      src={assetUrl(String(src))}
      alt={parsed.alt}
      className={classes}
      style={imageStyle}
    />
  );
}
