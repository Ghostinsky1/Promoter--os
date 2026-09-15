import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OfferWithShow, ScheduleItem, VenueContact, CompanySettings } from '../types';
import { convertTo12Hour } from './timeHelpers';
import { PDF, useBrandFonts, drawHeader, drawFooters, tableTheme, label, body, card, headline } from './pdfTheme';

/** Run of Show — letter, print-friendly: white paper, one blue accent, ice-tint cards. */
export function generateRunOfShowPDF(
  offerData: OfferWithShow,
  schedule: ScheduleItem[],
  venueContact: VenueContact,
  eventDate: string,
  companySettings?: CompanySettings
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  useBrandFonts(doc);
  const m = 36;
  const W = 612;
  const cw = W - m * 2;

  let y = drawHeader(doc, {
    docType: 'Run of Show',
    title: offerData.show.event_name || offerData.show.artist_name,
    subtitle: offerData.show.venue_name,
    lines: [offerData.venue_full_address || ''].filter(Boolean),
    right: [formatDate(eventDate), `Capacity ${offerData.show.capacity}`],
    companyName: companySettings?.company_name,
    logoUrl: companySettings?.logo_url,
  });

  // Two info cards
  const cardH = 74;
  const half = (cw - 14) / 2;
  card(doc, m, y, half, cardH);
  card(doc, m + half + 14, y, half, cardH);
  label(doc, 'Event', m + 14, y + 16);
  label(doc, 'Venue contact', m + half + 28, y + 16);
  body(doc, false, 9.5);
  doc.text(`Date  ${formatDate(eventDate)}`, m + 14, y + 32);
  doc.text(`Venue  ${offerData.show.venue_name}`, m + 14, y + 46);
  doc.text(`Doors  ${offerData.doors_time ? convertTo12Hour(String(offerData.doors_time)) : 'TBA'}   ·   Show  ${offerData.show_time ? convertTo12Hour(String(offerData.show_time)) : 'TBA'}`, m + 14, y + 60);
  doc.text(`Name  ${venueContact.name || '—'}`, m + half + 28, y + 32);
  doc.text(`Phone  ${venueContact.phone || '—'}`, m + half + 28, y + 46);
  doc.text(`Email  ${venueContact.email || '—'}`, m + half + 28, y + 60);
  y += cardH + 24;

  // Schedule
  label(doc, '[ 01 ]  Schedule', m, y, { color: PDF.blue });
  y += 8;
  const CATEGORY: Record<string, string> = { production: 'Production', technical: 'Technical', artist: 'Artist', performance: 'Performance', venue: 'Venue', other: 'Other' };
  autoTable(doc, {
    startY: y,
    margin: { left: m, right: m },
    head: [['Time', 'Dur.', 'Activity', 'Category', 'Responsible']],
    body: schedule.map((it) => [convertTo12Hour(it.time), `${it.duration} min`, it.title, CATEGORY[it.category] || 'Other', it.responsible || '']),
    ...tableTheme(),
    columnStyles: { 0: { cellWidth: 62, fontStyle: 'bold' }, 1: { cellWidth: 48 }, 2: { cellWidth: 'auto', fontStyle: 'bold' }, 3: { cellWidth: 78 }, 4: { cellWidth: 110 } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3 && String(data.cell.raw) === 'Performance') {
        data.cell.styles.textColor = PDF.blue;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 22;

  // Notes
  if (y > 640) { doc.addPage(); y = 60; }
  label(doc, '[ 02 ]  Notes', m, y, { color: PDF.blue });
  y += 14;
  body(doc, false, 9, PDF.muted);
  ['All times are approximate and subject to change.',
   'Contact the venue production manager for any schedule changes.',
   'Artist load-in and sound check times to be confirmed.'].forEach((t) => { doc.text('·  ' + t, m, y); y += 12; });

  // Terms
  if (companySettings?.legal_terms) {
    y += 14;
    if (y > 660) { doc.addPage(); y = 60; }
    label(doc, '[ 03 ]  Terms & conditions', m, y, { color: PDF.blue });
    y += 14;
    body(doc, false, 8, PDF.muted);
    companySettings.legal_terms.split('\n').filter((l) => l.trim()).forEach((term) => {
      const lines = doc.splitTextToSize(term, cw);
      lines.forEach((line: string) => {
        if (y > 720) { doc.addPage(); y = 60; }
        doc.text(line, m, y); y += 10;
      });
      y += 3;
    });
  }

  drawFooters(doc, companySettings?.company_name, [companySettings?.email, companySettings?.phone].filter(Boolean).join('  ·  '));

  const filename = `Run_of_Show_${offerData.show.artist_name.replace(/\s+/g, '_')}_${formatDate(eventDate)}.pdf`;
  doc.save(filename);
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date) ? new Date(date.slice(0, 10) + 'T00:00:00') : new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
