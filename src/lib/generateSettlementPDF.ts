import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OfferWithShow, CompanySettings } from '../types';
import { formatCurrency } from './calculations';
import { parseLocalDate } from './dateHelpers';
import { PDF, useBrandFonts, drawHeader, drawFooters, tableTheme, label as brandLabel } from './pdfTheme';

interface ActualTicketTier {
  type: string;
  price: number;
  actual_sold: number;
  projected_sold: number;
}

interface Settlement {
  actual_attendance: ActualTicketTier[];
  actual_expenses: {
    talent: Record<string, number>;
    general: Record<string, number>;
    marketing: Record<string, number>;
    production: Record<string, number>;
  };
  actual_revenue: number;
  actual_total_expenses: number;
  actual_profit: number;
  variance_revenue: number;
  variance_expenses: number;
  variance_profit: number;
  notes: string;
  settled_at?: string;
}

export function generateSettlementPDF(offer: OfferWithShow, settlement: Settlement, companySettings?: CompanySettings) {
  const doc = new jsPDF();
  useBrandFonts(doc);
  const eventDate = parseLocalDate(offer.show.event_date);
  const dateStr = eventDate ? eventDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Invalid date';
  let yPos = drawHeader(doc, {
    docType: 'Settlement Report',
    title: offer.show.event_name || offer.show.artist_name,
    subtitle: offer.show.venue_name,
    lines: [`Capacity ${offer.show.capacity}`],
    right: [dateStr, `Settled ${settlement.settled_at ? new Date(settlement.settled_at).toLocaleDateString() : new Date().toLocaleDateString()}`],
    companyName: companySettings?.company_name,
    logoUrl: companySettings?.logo_url,
  });

  yPos += 15;
  brandLabel(doc, '[ 01 ]  Financial summary', 20, yPos, { color: PDF.blue });

  // Money that is committed whether or not it is typed into an expense line:
  // the artist fee, and the accommodation kept in its own fields on the offer.
  const anyOffer = offer as any;
  const nz = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const accommodationRows: { label: string; amount: number }[] = [];
  if (anyOffer.include_hotel && nz(anyOffer.hotel_budget) > 0) {
    const nights = nz(anyOffer.hotel_nights) || 1;
    accommodationRows.push({ label: nights > 1 ? `Hotel (${nights} nights)` : 'Hotel', amount: nz(anyOffer.hotel_budget) * nights });
  }
  if (anyOffer.include_transport && nz(anyOffer.transport_budget) > 0) accommodationRows.push({ label: 'Ground transport', amount: nz(anyOffer.transport_budget) });
  if (anyOffer.include_flights && nz(anyOffer.flight_budget) > 0) accommodationRows.push({ label: 'Flights', amount: nz(anyOffer.flight_budget) });
  if (anyOffer.include_rider && nz(anyOffer.rider_cap) > 0) accommodationRows.push({ label: 'Rider / hospitality', amount: nz(anyOffer.rider_cap) });

  const guarantee = nz(offer.guarantee);
  const depositPaid = anyOffer.artist_deposit_status === 'paid' ? guarantee * (nz(offer.deposit_pct) / 100) : 0;

  const projectedShowExpenses = nz(offer.calculations.totalExpenses);
  const actualShowExpenses = nz(settlement.actual_total_expenses);

  // The stored variance_* columns are only as fresh as the last save, so an
  // edited expense left the Variance column disagreeing with the two numbers
  // printed beside it. Each variance is worked out from the row it belongs to.
  const summaryRows = [
    {
      label: 'Revenue',
      projected: nz((offer.calculations as any).grossRevenue ?? offer.calculations.netGross ?? offer.calculations.grossPotential),
      actual: nz(settlement.actual_revenue),
      variance: nz(settlement.actual_revenue) - nz((offer.calculations as any).grossRevenue ?? offer.calculations.netGross ?? offer.calculations.grossPotential),
    },
    {
      label: 'Show expenses (excl. artist)',
      projected: projectedShowExpenses,
      actual: actualShowExpenses,
      variance: actualShowExpenses - projectedShowExpenses,
    },
    {
      label: 'Artist payout',
      projected: guarantee,
      actual: guarantee,
      variance: 0,
    },
    {
      label: 'Net Profit',
      projected: nz(offer.calculations.netProfit),
      actual: nz(settlement.actual_profit),
      variance: nz(settlement.actual_profit) - nz(offer.calculations.netProfit),
    },
  ];

  yPos += 2;
  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Projected', 'Actual', 'Variance']],
    // The artist fee is NOT inside actual_total_expenses, so a summary of
    // Revenue / Expenses / Net Profit did not reconcile: 2,120 - 2,473.03 read
    // as -353.03 while the report printed -1,153.03, the missing 800 being the
    // guarantee. Anyone checking the math on a document addressed to the artist
    // hit a dead end. The artist now gets its own row so the column adds up.
    body: summaryRows.map(r => [r.label, formatCurrency(r.projected), formatCurrency(r.actual), formatCurrency(r.variance)]),
    ...tableTheme(doc),
    columnStyles: {
      0: { fontStyle: 'bold' },
      3: {
        textColor: (rowIndex: number) => (summaryRows[rowIndex]?.variance ?? 0) >= 0 ? [22, 163, 74] : [220, 38, 38],
      }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  brandLabel(doc, '[ 02 ]  Attendance breakdown', 20, yPos, { color: PDF.blue });

  yPos += 2;
  const attendanceData = settlement.actual_attendance.map(tier => [
    tier.type,
    formatCurrency(tier.price),
    tier.projected_sold.toString(),
    tier.actual_sold.toString(),
    (tier.actual_sold - tier.projected_sold).toString(),
    formatCurrency(tier.actual_sold * tier.price),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Tier', 'Price', 'Projected', 'Actual', 'Variance', 'Revenue']],
    body: attendanceData,
    ...tableTheme(doc),
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  brandLabel(doc, '[ 03 ]  Expense breakdown', 20, yPos, { color: PDF.blue });

  yPos += 2;
  const expenseData: any[] = [];

  /**
   * This section used to walk the PROJECTED line items only, looking each one
   * up by exact name in the settlement. Three things went wrong with that:
   *
   *   - a whole category that exists only in the settlement (the `fees`
   *     category: card processing and refunds, $121.34 on After Hours Vol 1)
   *     was never printed at all;
   *   - a settlement line whose name did not match a projected one was dropped,
   *     while its money stayed inside the total;
   *   - accommodation lives in its own fields on the offer, not in the expense
   *     block, so hotel ($198.36) never appeared either.
   *
   * The reader was left with rows that summed to $319.70 less than the total
   * the same page reported. Now: every category and every line present on
   * EITHER side is printed, accommodation is printed, rows that are zero on
   * both sides are hidden, and anything still unaccounted for is shown as its
   * own line rather than silently vanishing. The section carries its own total
   * so it can be checked against the summary at a glance.
   */
  const nzn = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const prettyName = (k: string) =>
    k.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

  const projectedBlock = (offer.expenses || {}) as Record<string, Record<string, number>>;
  const actualBlock = (settlement.actual_expenses || {}) as unknown as Record<string, Record<string, number>>;

  // Known categories first so the order stays familiar, then anything else that
  // turned up on either side -- `fees` today, whatever gets added tomorrow.
  const known = ['talent', 'general', 'marketing', 'production'];
  const categories = [
    ...known.filter((c) => projectedBlock[c] || actualBlock[c]),
    ...[...new Set([...Object.keys(projectedBlock), ...Object.keys(actualBlock)])]
      .filter((c) => !known.includes(c))
      .sort(),
  ];

  let printedProjected = 0;
  let printedActual = 0;

  for (const category of categories) {
    const proj = projectedBlock[category] || {};
    const act = actualBlock[category] || {};
    const keys = [...new Set([...Object.keys(proj), ...Object.keys(act)])];

    const rows = keys
      .map((key) => ({ key, projected: nzn(proj[key]), actual: nzn(act[key]) }))
      // A line that is zero on both sides is noise. On this settlement that hid
      // eight rows of $0.00 / $0.00 / $0.00 behind the numbers that mattered.
      .filter((r) => r.projected !== 0 || r.actual !== 0);

    if (rows.length === 0) continue;

    expenseData.push([
      { content: prettyName(category), colSpan: 4, styles: { fontStyle: 'bold', fillColor: PDF.tint, textColor: PDF.navy } },
    ]);

    for (const r of rows) {
      printedProjected += r.projected;
      printedActual += r.actual;
      expenseData.push([
        `  ${prettyName(r.key)}`,
        formatCurrency(r.projected),
        formatCurrency(r.actual),
        formatCurrency(r.actual - r.projected),
      ]);
    }
  }

  // Accommodation is committed money kept outside the expense block.
  if (accommodationRows.length > 0) {
    expenseData.push([
      { content: 'Artist Travel & Accommodation', colSpan: 4, styles: { fontStyle: 'bold', fillColor: PDF.tint, textColor: PDF.navy } },
    ]);
    for (const a of accommodationRows) {
      printedProjected += a.amount;
      printedActual += a.amount;
      expenseData.push([`  ${a.label}`, formatCurrency(a.amount), formatCurrency(a.amount), formatCurrency(0)]);
    }
  }

  // Whatever is left over is stated, not swallowed. If this row ever appears
  // with a real number on it, something is recorded in the total that has no
  // line item behind it, and the reader can see that rather than guess.
  const unaccounted = actualShowExpenses - printedActual;
  if (Math.abs(unaccounted) >= 0.01) {
    expenseData.push([
      '  Recorded in the total, not itemized',
      formatCurrency(0),
      formatCurrency(unaccounted),
      formatCurrency(unaccounted),
    ]);
    printedActual += unaccounted;
  }

  expenseData.push([
    { content: 'TOTAL SHOW EXPENSES', styles: { fontStyle: 'bold' } },
    { content: formatCurrency(printedProjected), styles: { fontStyle: 'bold' } },
    { content: formatCurrency(printedActual), styles: { fontStyle: 'bold' } },
    { content: formatCurrency(printedActual - printedProjected), styles: { fontStyle: 'bold' } },
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Expense Item', 'Projected', 'Actual', 'Variance']],
    body: expenseData,
    ...tableTheme(doc),

    columnStyles: {
      3: {
        textColor: (rowIndex: number, _column: number) => {
          const row = expenseData[rowIndex];
          if (!row || row.length === 1) return [0, 0, 0];
          const cell = row[3];
          const text = typeof cell === 'string' ? cell : cell?.content;
          if (typeof text !== 'string') return [0, 0, 0];
          // On budget is not a problem, so it is not painted red.
          if (/^-?\$0(\.00)?$/.test(text.trim())) return [0, 0, 0];
          return text.includes('-') ? [22, 163, 74] : [220, 38, 38];
        }
      }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // A document titled "Settlement Report" and handed to an artist never said
  // anywhere what the artist was actually paid. It does now.
  if (yPos > 220) { doc.addPage(); yPos = 20; }
  brandLabel(doc, '[ 04 ]  Artist payment', 20, yPos, { color: PDF.blue });
  yPos += 2;

  const withholdingPct = nz(offer.tax_withholding_pct);
  const withheld = guarantee * (withholdingPct / 100);
  const artistRows: any[] = [['Guarantee', formatCurrency(guarantee)]];
  if (withholdingPct > 0) {
    artistRows.push([`Tax withholding (${withholdingPct}%)`, `-${formatCurrency(withheld)}`]);
  }
  if (depositPaid > 0) artistRows.push(['Deposit already paid', `-${formatCurrency(depositPaid)}`]);
  artistRows.push([
    { content: 'BALANCE DUE AT SETTLEMENT', styles: { fontStyle: 'bold' } },
    { content: formatCurrency(guarantee - withheld - depositPaid), styles: { fontStyle: 'bold' } },
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Artist payment', 'Amount']],
    body: artistRows,
    ...tableTheme(doc),
    columnStyles: { 0: { fontStyle: 'normal' }, 1: { halign: 'right' } },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Everything below flows from a single yPos. Each block advances it by the height it
  // actually drew, so no section can land on top of the one before it.
  const TOP = 20;
  const TEXT_W = 170;
  // The footer rule sits at height - 38u (see drawFooters); stop well clear of it.
  const BOTTOM = doc.internal.pageSize.getHeight() - 24;

  /** Start a new page when the next block needs more room than is left. */
  const ensureRoom = (needed: number) => {
    if (yPos + needed > BOTTOM) {
      doc.addPage();
      yPos = TOP;
      return true;
    }
    return false;
  };

  /** Draw wrapped text one line at a time, breaking pages and advancing yPos. */
  const flowText = (text: string, lineHeight: number) => {
    const lines: string[] = doc.splitTextToSize(text, TEXT_W);
    lines.forEach((line: string) => {
      ensureRoom(lineHeight);
      doc.text(line, 20, yPos);
      yPos += lineHeight;
    });
  };

  /** A heading never prints alone at the foot of a page. */
  const sectionHeading = (text: string, firstLineHeight: number) => {
    ensureRoom(8 + firstLineHeight);
    brandLabel(doc, text, 20, yPos, { color: PDF.blue });
    yPos += 8;
  };

  if (settlement.notes && settlement.notes.trim()) {
    const LH = 4.5;
    sectionHeading('[ 05 ]  Settlement notes', LH);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40);

    // Blank lines in the notes are paragraph breaks, not text to draw.
    settlement.notes.split(/\n/).forEach((para) => {
      if (para.trim()) flowText(para, LH);
      else yPos += LH * 0.6;
    });

    doc.setTextColor(0);
    yPos += 10;
  }

  if (companySettings?.legal_terms) {
    const LH = 4;
    sectionHeading('[ 06 ]  Terms & conditions', LH);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);

    companySettings.legal_terms.split(/\n/).forEach((term) => {
      if (term.trim()) flowText(term, LH);
      else yPos += LH * 0.6;
    });

    doc.setTextColor(0);
  }

  const filename = `Settlement_${offer.show.artist_name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  drawFooters(doc, companySettings?.company_name, [companySettings?.email, companySettings?.phone].filter(Boolean).join('  ·  '));
  doc.save(filename);
}
