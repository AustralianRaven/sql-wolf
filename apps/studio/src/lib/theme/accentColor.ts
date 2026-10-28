import { generateRadixColors } from "@/vendor/radix-ui/generate-radix-color";

// SqlWolf: the user's accent colour overrides the theme's primary scale.
// Every --primary-<role> alias resolves through --primary-<n> on the same
// element, so overriding the numbered steps inline on <body> recolours them all.
const STEPS = Array.from({ length: 12 }, (_, i) => i + 1);
const PROPS = [
  ...STEPS.map((n) => `--primary-${n}`),
  ...STEPS.map((n) => `--primary-a${n}`),
  "--primary-contrast",
  "--primary-surface",
];

export function applyAccentColor(el: HTMLElement, accent?: string | null): void {
  PROPS.forEach((prop) => el.style.removeProperty(prop));
  if (!accent) {
    return;
  }

  const dark = el.classList.contains("dark-theme");
  const background =
    getComputedStyle(el).getPropertyValue("--background").trim() ||
    (dark ? "#090909" : "#ffffff");

  let colors: ReturnType<typeof generateRadixColors>;
  try {
    colors = generateRadixColors({
      appearance: dark ? "dark" : "light",
      accent,
      gray: background,
      background,
    });
  } catch (e) {
    console.warn("Invalid accent colour", accent, e);
    return;
  }

  colors.accentScale.forEach((color, i) => {
    el.style.setProperty(`--primary-${i + 1}`, color);
  });
  colors.accentScaleAlpha.forEach((color, i) => {
    el.style.setProperty(`--primary-a${i + 1}`, color);
  });
  el.style.setProperty("--primary-contrast", colors.accentContrast);
  el.style.setProperty("--primary-surface", colors.accentSurface);
}
