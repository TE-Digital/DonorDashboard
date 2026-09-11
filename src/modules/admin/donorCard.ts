// src/modules/admin/donorCard.ts
//
// The card a donor receives about a student.
//
// Three facts go on it — an approved photo, an approved display name, a
// donor-facing description — and there is no route from this file to anything
// else about the child. No guardian, no phone, no address, no village, no
// grades, no amounts. A card assembled by hiding fields from the student record
// is one careless edit away from leaking one; a card that never receives those
// fields cannot.
//
// The preview on screen and the downloaded file are the *same SVG string*. Not
// "the same design" — the identical bytes, rendered as an <img> in the browser
// and rasterised to PNG for the download. That is the only way "the export
// matches the preview" stays true after somebody changes the layout.

import type { DonorCard } from "./studentProfile";

export const CARD_WIDTH = 720;
export const CARD_HEIGHT = 960;

/** Rough width of one character at a given size, for wrapping without a DOM. */
const CHAR_W = 0.52;

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const THAI = /[฀-๿]/;

/**
 * The pieces a line may break between.
 *
 * English breaks at spaces. Thai is written without them, so splitting on
 * whitespace hands the wrapper one enormous "word" and the card prints a single
 * line that runs off the edge. Intl.Segmenter knows Thai word boundaries; where
 * a browser lacks it, a Thai run falls back to fixed-size chunks, which is
 * uglier but never overflows. Each piece keeps its own trailing space, so
 * joining pieces restores the original text exactly.
 */
const breakPieces = (text: string): string[] => {
  if (!THAI.test(text)) {
    return text.split(/(?<=\s)/).filter((piece) => piece.length > 0);
  }
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale: string, options: { granularity: "word" }) => { segment: (input: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) {
    return Array.from(new Segmenter("th", { granularity: "word" }).segment(text), (s) => s.segment);
  }
  return text.match(/.{1,6}/gsu) ?? [text];
};

/**
 * Greedy wrap at a measured character budget.
 *
 * Deliberately not DOM measurement: this same function has to produce the same
 * lines whether it runs for the preview or for the export, and a hidden node's
 * measurement depends on whichever fonts happened to have loaded.
 */
export const wrapText = (text: string, fontSize: number, maxWidth: number, maxLines: number): string[] => {
  const budget = Math.max(8, Math.floor(maxWidth / (fontSize * CHAR_W)));
  const clean = text.trim().replace(/\s+/g, " ");
  const pieces = breakPieces(clean);
  const lines: string[] = [];
  let line = "";

  for (const piece of pieces) {
    const candidate = line + piece;
    if (candidate.trimEnd().length <= budget) {
      line = candidate;
      continue;
    }
    if (line.trim()) lines.push(line.trimEnd());
    if (lines.length === maxLines) break;
    line = piece.trimStart();
  }

  if (line.trim() && lines.length < maxLines) lines.push(line.trimEnd());

  if (lines.length === maxLines && clean.length > lines.join("").replace(/\s+/g, "").length + lines.length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = `${last.slice(0, Math.max(0, budget - 1)).trimEnd()}…`;
  }

  return lines;
};

/** Figtree has no Thai glyphs; Noto Sans Thai keeps a Thai card from falling back mid-line. */
const CARD_FONT = "Figtree, 'Noto Sans Thai', system-ui, sans-serif";

export interface CardBranding {
  /** The organisation's name, printed once at the foot. */
  organisation: string;
  /** The brand colour, read from the theme so the card follows branding. */
  accent: string;
}

/**
 * The card, as one self-contained SVG string.
 *
 * `photoHref` must already be a data: URI. A remote URL would taint the canvas
 * the download rasterises through, and the export would fail silently in some
 * browsers and throw in others.
 */
export const donorCardSvg = (
  card: DonorCard,
  branding: CardBranding,
  photoHref: string | null,
): string => {
  const name = escapeXml(card.displayName.trim() || "Student");
  const description = wrapText(card.description.trim(), 26, CARD_WIDTH - 128, 9);

  const photoCx = CARD_WIDTH / 2;
  const photoCy = 300;
  const photoR = 140;

  const photo = photoHref
    ? `<clipPath id="portrait"><circle cx="${photoCx}" cy="${photoCy}" r="${photoR}"/></clipPath>
       <image href="${photoHref}" x="${photoCx - photoR}" y="${photoCy - photoR}" width="${photoR * 2}" height="${photoR * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#portrait)"/>`
    : `<circle cx="${photoCx}" cy="${photoCy}" r="${photoR}" fill="#edf2f0"/>
       <text x="${photoCx}" y="${photoCy + 22}" text-anchor="middle" font-size="72" fill="#91a49d" font-family="${CARD_FONT}">${escapeXml(name.charAt(0).toUpperCase())}</text>`;

  const descriptionLines = description
    .map(
      (line, index) =>
        `<text x="${CARD_WIDTH / 2}" y="${560 + index * 40}" text-anchor="middle" font-size="26" fill="#41554e" font-family="${CARD_FONT}">${escapeXml(line)}</text>`,
    )
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" role="img" aria-label="Donor card for ${name}">
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#ffffff"/>
  <rect width="${CARD_WIDTH}" height="8" fill="${escapeXml(branding.accent)}"/>
  ${photo}
  <text x="${CARD_WIDTH / 2}" y="${photoCy + photoR + 78}" text-anchor="middle" font-size="42" font-weight="600" fill="#1c302a" font-family="${CARD_FONT}">${name}</text>
${descriptionLines}
  <rect x="64" y="${CARD_HEIGHT - 110}" width="${CARD_WIDTH - 128}" height="1" fill="#e3eae7"/>
  <text x="${CARD_WIDTH / 2}" y="${CARD_HEIGHT - 64}" text-anchor="middle" font-size="20" fill="#6a7d76" font-family="${CARD_FONT}">${escapeXml(branding.organisation)}</text>
</svg>`;
};

/** The same SVG, as something an <img> can show. */
export const svgDataUri = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/**
 * Fetches the approved photo and inlines it.
 *
 * Returns null rather than failing when the photo cannot be read: a card with
 * an initial where a face should be is still a card, and a download that throws
 * because a bucket was slow is not.
 */
export const inlinePhoto = async (url: string | null): Promise<string | null> => {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Could not inline the donor photo", error);
    return null;
  }
};

/** Rasterises the card SVG and hands the browser a PNG to save. */
export const downloadCardPng = async (svg: string, fileName: string): Promise<string | null> =>
  new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      // Twice the layout size, so the file is usable in print as well as email.
      const canvas = document.createElement("canvas");
      canvas.width = CARD_WIDTH * 2;
      canvas.height = CARD_HEIGHT * 2;

      const context = canvas.getContext("2d");
      if (!context) {
        resolve(
          "We couldn't draw the card in this browser. Try downloading again, or use a different browser.",
        );
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(
            "We couldn't draw the card in this browser. Try downloading again, or use a different browser.",
          );
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Revoked on the next tick: Safari needs the object alive for the click.
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve(null);
      }, "image/png");
    };

    image.onerror = () =>
      resolve(
        "We couldn't draw the card in this browser. Try downloading again, or use a different browser.",
      );
    image.src = svgDataUri(svg);
  });

/** `anucha-donor-card.png` — no id, no personal data in the filename. */
export const cardFileName = (displayName: string): string => {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "student"}-donor-card.png`;
};
