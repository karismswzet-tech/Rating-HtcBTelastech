// ASTM D130 / IP 154 reference constants (must mirror backend)
export const ASTM_RATINGS = [
  { rating: "1a", category: "Slight Tarnish",   color: "#E2955B", description: "Light orange, almost the same as a freshly polished strip." },
  { rating: "1b", category: "Slight Tarnish",   color: "#CD773E", description: "Dark orange color." },
  { rating: "2a", category: "Moderate Tarnish", color: "#A84C32", description: "Claret red." },
  { rating: "2b", category: "Moderate Tarnish", color: "#795270", description: "Lavender." },
  { rating: "2c", category: "Moderate Tarnish", color: "#57678B", description: "Multicolored with lavender blue or silver, or both, overlaid on claret red." },
  { rating: "2d", category: "Moderate Tarnish", color: "#A1A1A5", description: "Silvery." },
  { rating: "2e", category: "Moderate Tarnish", color: "#C5A059", description: "Brassy or gold." },
  { rating: "3a", category: "Dark Tarnish",     color: "#8E354A", description: "Magenta overcast on brassy strip." },
  { rating: "3b", category: "Dark Tarnish",     color: "#50594B", description: "Multicolored with red and green showing (peacock), but no gray." },
  { rating: "4a", category: "Corrosion",        color: "#322B29", description: "Transparent black, dark gray or brown, with peacock green barely showing." },
  { rating: "4b", category: "Corrosion",        color: "#1E1E22", description: "Graphite or lusterless black." },
  { rating: "4c", category: "Corrosion",        color: "#111111", description: "Glossy or jet black." },
];

export const CATEGORY_STYLE = {
  "Slight Tarnish":   { bg: "bg-amber-50",  text: "text-amber-700",  ring: "ring-amber-200" },
  "Moderate Tarnish": { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200" },
  "Dark Tarnish":     { bg: "bg-rose-50",   text: "text-rose-700",   ring: "ring-rose-200" },
  "Corrosion":        { bg: "bg-slate-100", text: "text-slate-800",  ring: "ring-slate-300" },
};

export function getReadableTextOn(hexColor) {
  const c = hexColor.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Relative luminance
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return L > 0.6 ? "#0F172A" : "#FFFFFF";
}
