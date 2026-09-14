import DOMPurify from "isomorphic-dompurify";

// Strict allowlist: only the shapes/markup a diagram needs, nothing
// executable, nothing that can reach outside the page.
const ALLOWED_TAGS = [
  "svg",
  "g",
  "path",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "rect",
  "text",
  "tspan",
  "defs",
  "marker",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "title",
  "desc",
];

const ALLOWED_ATTR = [
  "viewBox",
  "width",
  "height",
  "xmlns",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "transform",
  "font-size",
  "font-family",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "id",
  "class",
  "style",
  "gradientUnits",
  "gradientTransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "marker-end",
  "marker-start",
  "marker-width",
  "marker-height",
  "orient",
  "refX",
  "refY",
];

const MAX_ELEMENTS = 80;

/**
 * Sanitizes model-generated SVG before it ever touches the DOM: strict tag/attr
 * allowlist (no <script>, no foreignObject, no event handlers, no external
 * refs/links), plus a coarse element-count cap so a runaway diagram can't
 * bloat the page. Returns null if the input isn't safe/valid to render.
 */
export function sanitizeSvg(rawSvg: string): string | null {
  const trimmed = rawSvg.trim();
  if (!trimmed.startsWith("<svg") || !trimmed.includes("</svg>")) {
    return null;
  }

  const clean = DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ["script", "foreignObject", "style", "image", "a", "iframe", "use", "animate"],
    FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "href", "xlink:href"],
    ALLOW_DATA_ATTR: false,
  }).trim();

  if (!clean || !clean.startsWith("<svg") || !clean.includes("</svg>")) {
    return null;
  }

  const elementCount = (clean.match(/<[a-zA-Z]/g) ?? []).length;
  if (elementCount === 0 || elementCount > MAX_ELEMENTS) {
    return null;
  }

  return clean;
}
