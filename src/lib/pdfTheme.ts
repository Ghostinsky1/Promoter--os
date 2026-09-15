import jsPDF from 'jspdf';
import { ArchivoBlackTTF, ChakraPetchTTF, SairaRegularTTF, SairaBoldTTF } from './pdfFonts';

/**
 * PROMTP print theme — matches gozaentertainment.com but built for paper:
 * white background, black ink, a single electric-blue accent, very light ice tints.
 * No dark bands or heavy fills (cheap to print). All positions are computed from the
 * page width so the same helpers work for pt- and mm-based documents.
 */
export type RGB = [number, number, number];

export const PDF = {
  ink: [8, 9, 13] as RGB,          // headline / primary text
  text: [31, 36, 48] as RGB,       // body text
  muted: [107, 114, 128] as RGB,   // secondary text
  blue: [17, 64, 240] as RGB,      // the one accent
  navy: [4, 33, 77] as RGB,        // small caps labels
  ice: [143, 211, 255] as RGB,     // highlight (used sparingly)
  iceTint: [235, 245, 255] as RGB, // card fill (~4% ink)
  tint: [246, 248, 251] as RGB,    // neutral fill
  rule: [210, 218, 230] as RGB,    // hairlines
  white: [255, 255, 255] as RGB,
  good: [17, 64, 240] as RGB,      // positive numbers (blue, not green)
  warn: [214, 84, 0] as RGB,       // warnings only
};

let registered = new WeakSet<jsPDF>();

/** Embed the brand fonts into this document. Safe to call more than once. */
export function useBrandFonts(doc: jsPDF) {
  if (registered.has(doc)) return;
  doc.addFileToVFS('ArchivoBlack.ttf', ArchivoBlackTTF);
  doc.addFont('ArchivoBlack.ttf', 'ArchivoBlack', 'normal');
  doc.addFileToVFS('ChakraPetch.ttf', ChakraPetchTTF);
  doc.addFont('ChakraPetch.ttf', 'ChakraPetch', 'normal');
  doc.addFileToVFS('Saira-Regular.ttf', SairaRegularTTF);
  doc.addFont('Saira-Regular.ttf', 'Saira', 'normal');
  doc.addFileToVFS('Saira-Bold.ttf', SairaBoldTTF);
  doc.addFont('Saira-Bold.ttf', 'Saira', 'bold');
  // Let existing code that asks for helvetica get the brand body face instead.
  doc.addFont('Saira-Regular.ttf', 'helvetica', 'normal');
  doc.addFont('Saira-Bold.ttf', 'helvetica', 'bold');
  doc.setFont('Saira', 'normal');
  registered.add(doc);
}

/** Unit helper: 1 "u" = 1pt on a letter-width page, whatever unit the doc uses. */
export function units(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  return { u: w / 612, w, h: doc.internal.pageSize.getHeight() };
}

export function label(doc: jsPDF, text: string, x: number, y: number, opts: { align?: 'left' | 'right' | 'center'; color?: RGB; size?: number } = {}) {
  doc.setFont('ChakraPetch', 'normal');
  doc.setFontSize(opts.size ?? 7);
  doc.setTextColor(...(opts.color ?? PDF.navy));
  doc.text(text.toUpperCase(), x, y, { align: opts.align ?? 'left', charSpace: 1.2 * units(doc).u } as any);
}

export function headline(doc: jsPDF, text: string, x: number, y: number, size = 20, opts: { align?: 'left' | 'right' | 'center'; maxWidth?: number; color?: RGB } = {}) {
  doc.setFont('ArchivoBlack', 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...(opts.color ?? PDF.ink));
  doc.text(text.toUpperCase(), x, y, { align: opts.align ?? 'left', maxWidth: opts.maxWidth } as any);
}

export function body(doc: jsPDF, bold = false, size = 9, color: RGB = PDF.text) {
  doc.setFont('Saira', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

/** Thin electric-blue rule. */
export function rule(doc: jsPDF, x1: number, y: number, x2: number, color: RGB = PDF.blue, width = 1) {
  const { u } = units(doc);
  doc.setDrawColor(...color);
  doc.setLineWidth(width * u);
  doc.line(x1, y, x2, y);
}

/** Light card: ice tint fill, hairline border, rounded corners. Ink-cheap. */
export function card(doc: jsPDF, x: number, y: number, w: number, h: number, fill: RGB = PDF.iceTint) {
  const { u } = units(doc);
  doc.setFillColor(...fill);
  doc.setDrawColor(...PDF.rule);
  doc.setLineWidth(0.6 * u);
  doc.roundedRect(x, y, w, h, 8 * u, 8 * u, 'FD');
}

export interface HeaderOpts {
  docType: string;          // e.g. "ARTIST OFFER", "RUN OF SHOW"
  title: string;            // artist / event name
  subtitle?: string;        // venue
  lines?: string[];         // address, date...
  right?: string[];         // right column: date, offer #, etc.
  companyName?: string;
  logoUrl?: string | null;
}

/** Brand header. Returns the y where content can start. */
export function drawHeader(doc: jsPDF, o: HeaderOpts): number {
  useBrandFonts(doc);
  const { u, w } = units(doc);
  const m = 36 * u;
  let y = 34 * u;

  // Top strip: wordmark left, company right, blue rule under it
  doc.setFont('ArchivoBlack', 'normal'); doc.setFontSize(11); doc.setTextColor(...PDF.blue);
  doc.text('PROMTP', m, y);
  const wm = doc.getTextWidth('PROMTP');
  label(doc, o.docType, m + wm + 14 * u, y, { color: PDF.muted });
  if (o.companyName) label(doc, o.companyName, w - m, y, { align: 'right', color: PDF.navy });
  rule(doc, m, y + 8 * u, w - m, PDF.blue, 1.2);
  y += 34 * u;

  // Logo (small, optional)
  let textX = m;
  if (o.logoUrl) {
    try { doc.addImage(o.logoUrl, 'PNG', m, y - 6 * u, 40 * u, 40 * u); textX = m + 50 * u; } catch (_) { /* skip */ }
  }

  headline(doc, o.title, textX, y + 12 * u, 20, { maxWidth: (w - m - textX) - 150 * u });
  const titleLines = doc.splitTextToSize(o.title.toUpperCase(), (w - m - textX) - 150 * u).length;
  let ly = y + 12 * u + titleLines * 22 * u;
  if (o.subtitle) { body(doc, true, 10, PDF.ink); doc.text(o.subtitle, textX, ly); ly += 12 * u; }
  (o.lines || []).forEach((line) => { if (line) { body(doc, false, 9, PDF.muted); doc.text(line, textX, ly); ly += 11 * u; } });

  // Right column
  let ry = y + 12 * u;
  (o.right || []).forEach((line, i) => {
    if (i === 0) { body(doc, true, 10, PDF.ink); } else { body(doc, false, 9, PDF.muted); }
    doc.text(line, w - m, ry, { align: 'right' }); ry += 12 * u;
  });

  return Math.max(ly, ry) + 10 * u;
}

/** Footer on every page: hairline, company/contact left, page x of y right. */
export function drawFooters(doc: jsPDF, companyName?: string, contact?: string) {
  useBrandFonts(doc);
  const { u, w, h } = units(doc);
  const m = 36 * u;
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const y = h - 28 * u;
    rule(doc, m, y - 10 * u, w - m, PDF.rule, 0.6);
    label(doc, [companyName, contact].filter(Boolean).join('  ·  ') || 'PROMTP', m, y, { color: PDF.muted, size: 6.5 });
    label(doc, `Page ${p} of ${total}`, w - m, y, { align: 'right', color: PDF.muted, size: 6.5 });
  }
}

/** Shared jspdf-autotable styling: light head, hairlines, no zebra (saves ink). */
export function tableTheme(doc?: jsPDF) {
  const u = doc ? units(doc).u : 1;
  return {
    theme: 'plain' as const,
    styles: { font: 'Saira', fontStyle: 'normal' as const, fontSize: 8.5, textColor: PDF.text, cellPadding: 4 * u, lineColor: PDF.rule, lineWidth: 0.5 * u },
    headStyles: { font: 'ChakraPetch', fontStyle: 'normal' as const, fontSize: 6.5, textColor: PDF.navy, fillColor: PDF.iceTint, lineWidth: 0 },
    bodyStyles: { fillColor: PDF.white },
    alternateRowStyles: { fillColor: PDF.white },
    footStyles: { font: 'Saira', fontStyle: 'bold' as const, textColor: PDF.ink, fillColor: PDF.tint },
  };
}
