const SYSTEM_FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const DEFAULT_FONT_FAMILY = `Inter, ${SYSTEM_FONT_STACK}`;

const GENERIC_FONT_FAMILIES = new Set([
  "cursive",
  "emoji",
  "fangsong",
  "fantasy",
  "math",
  "monospace",
  "sans-serif",
  "serif",
  "system-ui",
  "ui-monospace",
  "ui-rounded",
  "ui-sans-serif",
  "ui-serif"
]);

function stripOuterQuotes(value: string) {
  const trimmed = value.trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];

  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function getPrimaryFontFamily(fontFamily: string) {
  return stripOuterQuotes(fontFamily.split(",")[0] || "");
}

function quoteFontFamily(fontFamily: string) {
  return `"${fontFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function getFontFamilyStack(fontFamily: string | null) {
  const normalizedFontFamily = fontFamily?.trim();

  if (!normalizedFontFamily) {
    return DEFAULT_FONT_FAMILY;
  }

  if (normalizedFontFamily.includes(",")) {
    return normalizedFontFamily;
  }

  const primaryFontFamily = stripOuterQuotes(normalizedFontFamily);

  if (GENERIC_FONT_FAMILIES.has(primaryFontFamily.toLowerCase())) {
    return primaryFontFamily;
  }

  return `${quoteFontFamily(primaryFontFamily)}, ${SYSTEM_FONT_STACK}`;
}

export function getGoogleFontStylesheetUrl(fontFamily: string) {
  const primaryFontFamily = getPrimaryFontFamily(fontFamily);

  if (!primaryFontFamily || GENERIC_FONT_FAMILIES.has(primaryFontFamily.toLowerCase())) {
    return null;
  }

  if (!/^[a-zA-Z0-9 ]+$/.test(primaryFontFamily)) {
    return null;
  }

  const googleFontFamily = primaryFontFamily.trim().replace(/\s+/g, "+");

  return `https://fonts.googleapis.com/css2?family=${googleFontFamily}:wght@400;500;600;700;800&display=swap`;
}
