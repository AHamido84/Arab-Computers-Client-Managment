import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Register IBM Plex Sans Arabic (covers Arabic + Latin) once per process.
 * Files live in src/pdf/fonts and are bundled with serverless functions via
 * `outputFileTracingIncludes` in next.config.ts.
 */
let registered = false;
export const PDF_FONT = "PlexArabic";

export function registerPdfFonts() {
  if (registered) return;
  const dir = path.join(process.cwd(), "src/pdf/fonts");
  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: path.join(dir, "IBMPlexSansArabic-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "IBMPlexSansArabic-Medium.ttf"), fontWeight: 500 },
      { src: path.join(dir, "IBMPlexSansArabic-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(dir, "IBMPlexSansArabic-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Never hyphenate (breaks Arabic words).
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

/** Strip bidi control marks emitted by Intl (the font has no glyphs for them). */
export const clean = (s: string | number | null | undefined) =>
  s == null ? "" : String(s).replace(/[‎‏؜‪-‮⁦-⁩]/g, "").trim();
