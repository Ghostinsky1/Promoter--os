import { extraRevenueAt, ensureCalculations } from './calculations';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OfferWithShow, CompanySettings } from '../types';
import { convertTo12Hour } from './timeHelpers';
import { PDFMode, PDF_MODES } from './pdfModes';
import { PDF, useBrandFonts, drawHeader, drawFooters, tableTheme, label as brandLabel } from './pdfTheme';

// Helper function to draw rounded rectangle
function drawRoundedRect(doc: jsPDF, x: number, y: number, width: number, height: number, radius: number) {
  doc.roundedRect(x, y, width, height, radius, radius, 'FD');
}

export type PDFOutput = 'save' | 'preview' | 'base64';

export function offerPDFFilename(offer: OfferWithShow): string {
  const clean = (t: string) => t.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const baseName = clean(offer.show.event_name || offer.show.artist_name || 'Offer');
  const date = (offer.show.event_date || '').slice(0, 10) || clean(formatDateShort(offer.show.event_date));
  return `${baseName}_Offer_${date}.pdf`;
}

export function generateOfferPDF(offer: OfferWithShow, companySettings?: CompanySettings, preview: boolean = false, costsOnly: boolean = false, mode: PDFMode = 'estimate', output?: PDFOutput): string | void {
  const pdfMode = PDF_MODES[mode];
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter'
  });

  const margin = 30;
  const pageWidth = 612;
  const pageHeight = 792;
  const contentWidth = pageWidth - (margin * 2);

  useBrandFonts(doc);
  const black = PDF.ink;
  const white = PDF.white;
  const limeGreen = PDF.blue;        // accent borders / highlight rows
  const gray = PDF.text;
  const lightGray = PDF.iceTint;     // card fills (very light, ink-cheap)
  const borderGray = PDF.rule;
  const darkGray = PDF.muted;
  const green = PDF.good;
  const lightGreen = PDF.iceTint;
  const orange = PDF.warn;

  // Some offers (AI connector, imports, older builds) carry no calculations at
  // all. Without this the whole PDF prints NaN.
  const calc = ensureCalculations(offer);
  offer = { ...offer, calculations: calc } as typeof offer;

  const facilityFee = offer.facility_fee_per_ticket ?? 2.00;
  const totalAllotment = offer.ticket_tiers.reduce((sum, t) => sum + t.allotment, 0);
  const totalComps = offer.ticket_tiers.reduce((sum, t) => sum + t.comps, 0);
  const totalSellable = totalAllotment - totalComps;

  const grossPotential = offer.ticket_tiers.reduce((sum, t) => sum + (t.allotment * t.price), 0);
  const totalFacilityFee = totalSellable * facilityFee;
  const adjustedGrossPotential = grossPotential - totalFacilityFee;
  const salesTaxAmount = adjustedGrossPotential * (offer.sales_tax_pct / 100);
  const netGrossPotential = adjustedGrossPotential - salesTaxAmount;

  const ascapFee = netGrossPotential * (offer.ascap_rate ?? 0.0023);
  const bmiFee = netGrossPotential * (offer.bmi_rate ?? 0.003);
  const sesacFee = netGrossPotential * (offer.sesac_rate ?? 0.000214);
  const insuranceFee = totalSellable * (offer.insurance_per_attendee ?? 0.62);
  const ccFee = netGrossPotential * (offer.cc_fee_rate ?? 0.012);
  const variableFromRates = ascapFee + bmiFee + sesacFee + insuranceFee + ccFee;

  // calculations.totalExpenses ALREADY includes variable expenses. Adding the
  // recomputed ones on top double-charged every fee on every PDF, which made
  // shows look far more expensive on paper than in the app.
  const totalVariableExpenses = offer.calculations.variableExpensesTotal ?? variableFromRates;
  const totalFixedExpenses = offer.calculations.fixedExpensesTotal
    ?? Math.max(0, offer.calculations.totalExpenses - totalVariableExpenses);

  const artistWalkout = offer.calculations.artistTotalPayout;
  // What the artist receives is net of withholding; what the SHOW costs is the
  // full guarantee, because the withheld part is still money you hand over.
  const withholding = 1 - ((offer.tax_withholding_pct ?? 0) / 100);
  const artistCost = withholding > 0 ? artistWalkout / withholding : artistWalkout;
  const artistDeductionsTotal = (offer.artist_deductions || []).reduce((sum, d) => sum + (d.amount || 0), 0);

  // Bar, parking, sponsorship — promoter money, internal view only.
  const extraRevenueLines = (offer as any).include_extra_revenue ? ((offer as any).extra_revenue || []) : [];
  const extraRevenueTotal = extraRevenueAt(extraRevenueLines, totalSellable, true);

  const yourProfit = netGrossPotential - totalFixedExpenses - totalVariableExpenses - artistCost + extraRevenueTotal;

  const addressLines = (offer.venue_full_address || '').split('\n').map((l: string) => l.trim()).filter(Boolean);
  let y = drawHeader(doc, {
    docType: mode === 'artist_offer' ? 'Artist Offer' : 'Internal Estimate',
    title: (offer.show.event_name || offer.show.artist_name || ''),
    subtitle: offer.show.venue_name,
    lines: addressLines,
    right: [formatDateLong(offer.show.event_date), `Offer #${offer.id.replace('offer_', '').slice(-6)}`, `Prepared ${formatDateShort(new Date())}`],
    companyName: companySettings?.company_name,
    logoUrl: companySettings?.logo_url,
  });

  // === DEAL CARDS (Three Modern Rounded Cards) ===
  const cardY = y;
  const cardWidth = 174;
  const cardHeight = 65;
  const cardGap = 15;

  // Card 1: Deal Type
  doc.setFillColor(...lightGray);
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(1);
  drawRoundedRect(doc, margin, cardY, cardWidth, cardHeight, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...darkGray);
  doc.text('DEAL TYPE', margin + 12, cardY + 18);

  let dealTypeText = 'Flat Fee';
  if (offer.deal_type === 'guarantee_vs_percentage') {
    dealTypeText = 'Guarantee vs %';
  } else if (offer.deal_type === 'percentage_only') {
    dealTypeText = 'Percentage Only';
  } else if (offer.deal_type === 'door_deal') {
    dealTypeText = 'Door Deal';
  } else if (offer.deal_type === 'promoter_profit') {
    const artistPct = offer.artist_backend_pct || 85;
    const promoterPct = offer.promoter_backend_pct || 15;
    dealTypeText = `${artistPct}/${promoterPct} Split`;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...black);
  doc.text(dealTypeText, margin + 12, cardY + 42, { maxWidth: cardWidth - 24 });

  // Card 2: Guarantee
  const card2X = margin + cardWidth + cardGap;
  doc.setFillColor(...lightGray);
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(1);
  drawRoundedRect(doc, card2X, cardY, cardWidth, cardHeight, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...darkGray);
  doc.text('GUARANTEE', card2X + 12, cardY + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...black);
  doc.text(formatMoney(offer.guarantee || 0), card2X + 12, cardY + 42);

  // Card 3: Artist Gets (Lime Green Border)
  const card3X = margin + (cardWidth + cardGap) * 2;
  doc.setFillColor(...lightGreen);
  doc.setDrawColor(...limeGreen);
  doc.setLineWidth(2);
  drawRoundedRect(doc, card3X, cardY, cardWidth, cardHeight, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...darkGray);
  doc.text('ARTIST GETS', card3X + 12, cardY + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...green);
  doc.text(formatMoney(artistWalkout), card3X + 12, cardY + 42);

  y = cardY + cardHeight + 20;

  // === TICKET SCALING SECTION ===
  if (mode !== 'artist_offer') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...black);
    doc.text('TICKET SCALING', margin, y);
    y += 20;

  const tableData = offer.ticket_tiers.map(tier => {
    const sellable = tier.allotment - tier.comps;
    const tierRevenue = tier.allotment * tier.price;
    const netAfterFees = tier.price - facilityFee;
    const breakEvenTickets = netAfterFees > 0 ? Math.ceil((totalFixedExpenses + totalVariableExpenses + artistCost) / netAfterFees) : 0;
    const grossShort = tierRevenue >= 1000 ? `$${(tierRevenue / 1000).toFixed(1)}K` : formatMoney(tierRevenue);

    const row = [
      tier.type,
      tier.allotment.toString(),
      sellable.toString(),
      formatMoney(tier.price),
      formatMoney(tier.price)
    ];

    if (pdfMode.showBreakEven) {
      row.push(breakEvenTickets > totalSellable ? 'N/A' : breakEvenTickets.toString());
    }

    row.push(grossShort);
    return row;
  });

  const totalGrossShort = grossPotential >= 1000 ? `$${(grossPotential / 1000).toFixed(1)}K` : formatMoney(grossPotential);

  const totalsRow: any[] = [
    { content: 'TOTALS', styles: { fontStyle: 'bold', textColor: black } },
    { content: totalAllotment.toString(), styles: { fontStyle: 'bold', textColor: black } },
    { content: totalSellable.toString(), styles: { fontStyle: 'bold', textColor: black } },
    { content: '', styles: { textColor: black } },
    { content: '', styles: { textColor: black } }
  ];

  if (pdfMode.showBreakEven) {
    totalsRow.push({ content: '', styles: { textColor: black } });
  }

  totalsRow.push({ content: totalGrossShort, styles: { fontStyle: 'bold', textColor: black } });
  tableData.push(totalsRow);

  const tableHeaders = ['Type', 'Qty', 'Sellable', 'Price', 'Net'];
  if (pdfMode.showBreakEven) {
    tableHeaders.push('Break Even');
  }
  tableHeaders.push('Gross');

  const columnStyles: any = {
    0: { halign: 'left', cellWidth: 70 },
    1: { halign: 'center', cellWidth: 50 },
    2: { halign: 'center', cellWidth: 60 },
    3: { halign: 'right', cellWidth: 70 },
    4: { halign: 'right', cellWidth: 70 }
  };

  if (pdfMode.showBreakEven) {
    columnStyles[5] = { halign: 'center', cellWidth: 80 };
    columnStyles[6] = { halign: 'right', cellWidth: 72 };
  } else {
    columnStyles[5] = { halign: 'right', cellWidth: 80 };
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [tableHeaders],
    body: tableData,
    ...tableTheme(),
    headStyles: { ...tableTheme().headStyles, halign: 'center', cellPadding: 6 },
    columnStyles,
    didParseCell: function(data) {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = PDF.tint;
        data.cell.styles.textColor = PDF.ink;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 11;
      }
    }
  });

    y = (doc as any).lastAutoTable.finalY + 20;
  }

  // === FINANCIAL SUMMARY CARDS (Two Rounded Cards) ===
  if (mode !== 'artist_offer') {
  const summaryY = y;
  const summaryColWidth = 268;

  // Left Card: Financial Summary
  doc.setFillColor(...lightGray);
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(1);
  drawRoundedRect(doc, margin, summaryY, summaryColWidth, 130, 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...black);
  doc.text('FINANCIAL SUMMARY', margin + 15, summaryY + 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...darkGray);
  doc.text('Gross Potential', margin + 15, summaryY + 45);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(formatMoney(grossPotential), margin + summaryColWidth - 15, summaryY + 45, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.text('Facility Fees', margin + 15, summaryY + 63);
  doc.setTextColor(...orange);
  doc.text(`-${formatMoney(totalFacilityFee)}`, margin + summaryColWidth - 15, summaryY + 63, { align: 'right' });

  doc.setTextColor(...darkGray);
  doc.text('Sales Tax', margin + 15, summaryY + 81);
  doc.setTextColor(...orange);
  doc.text(`-${formatMoney(salesTaxAmount)}`, margin + summaryColWidth - 15, summaryY + 81, { align: 'right' });

  // Divider line
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(1);
  doc.line(margin + 15, summaryY + 95, margin + summaryColWidth - 15, summaryY + 95);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...black);
  doc.text('Net Gross', margin + 15, summaryY + 115);
  doc.text(formatMoney(netGrossPotential), margin + summaryColWidth - 15, summaryY + 115, { align: 'right' });

  // Right Card: Expenses & Profit or Artist Payment
  const expenseX = margin + summaryColWidth + 16;

  if (pdfMode.showProfit) {
    // ESTIMATE MODE - Show expenses & profit with lime border
    doc.setFillColor(...lightGreen);
    doc.setDrawColor(...green);
    doc.setLineWidth(2);
    drawRoundedRect(doc, expenseX, summaryY, summaryColWidth, 130, 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...black);
    doc.text('EXPENSES & PROFIT', expenseX + 15, summaryY + 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.text('Fixed Expenses', expenseX + 15, summaryY + 45);
    doc.setTextColor(...orange);
    doc.text(formatMoney(totalFixedExpenses), expenseX + summaryColWidth - 15, summaryY + 45, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);
    doc.text('Variable Expenses', expenseX + 15, summaryY + 63);
    doc.setTextColor(...orange);
    doc.text(formatMoney(totalVariableExpenses), expenseX + summaryColWidth - 15, summaryY + 63, { align: 'right' });

    doc.setTextColor(...darkGray);
    doc.text('Artist Payment', expenseX + 15, summaryY + 81);
    doc.setTextColor(...orange);
    doc.text(formatMoney(artistCost), expenseX + summaryColWidth - 15, summaryY + 81, { align: 'right' });

    // Divider line
    doc.setDrawColor(...green);
    doc.setLineWidth(2);
    doc.line(expenseX + 15, summaryY + 95, expenseX + summaryColWidth - 15, summaryY + 95);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...green);
    doc.text('YOUR PROFIT', expenseX + 15, summaryY + 115);
    doc.setFontSize(14);
    doc.text(formatMoney(yourProfit), expenseX + summaryColWidth - 15, summaryY + 113, { align: 'right' });
  } else {
    // ARTIST OFFER MODE - Clean payment card with lime border
    doc.setFillColor(...lightGreen);
    doc.setDrawColor(...limeGreen);
    doc.setLineWidth(3);
    drawRoundedRect(doc, expenseX, summaryY, summaryColWidth, 130, 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...black);
    doc.text('ARTIST PAYMENT', expenseX + 15, summaryY + 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.text('Deal Structure', expenseX + 15, summaryY + 45);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...black);

    let dealText = 'Flat Fee';
    if (offer.deal_type === 'guarantee_vs_percentage') {
      dealText = 'Guarantee vs %';
    } else if (offer.deal_type === 'promoter_profit') {
      const artistPct = offer.artist_backend_pct || 85;
      const promoterPct = offer.promoter_backend_pct || 15;
      dealText = `${artistPct}/${promoterPct} Split`;
    }
    doc.text(dealText, expenseX + 15, summaryY + 62);

    // Divider line
    doc.setDrawColor(...limeGreen);
    doc.setLineWidth(2);
    doc.line(expenseX + 15, summaryY + 78, expenseX + summaryColWidth - 15, summaryY + 78);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.text('Amount', expenseX + 15, summaryY + 97);
    doc.setFontSize(18);
    doc.setTextColor(...green);
    doc.text(formatMoney(artistWalkout), expenseX + summaryColWidth - 15, summaryY + 95, { align: 'right' });
  }

    y = summaryY + 140;
  }

  // === SHOW DETAILS (Rounded Gray Card) ===
  doc.setFillColor(...lightGray);
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(1);
  drawRoundedRect(doc, margin, y, contentWidth, 62, 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...black);
  doc.text('SHOW DETAILS', margin + 15, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  const showLine1 = `Doors: ${formatTimeHR(offer.doors_time)}  •  Show: ${formatTimeHR(offer.show_time)}  •  Curfew: ${formatTimeHR(offer.curfew_time)}`;
  doc.text(showLine1, margin + 15, y + 38);

  const merchText = offer.merch_rate_soft ? `${offer.merch_rate_soft}% Artist` : '100% Artist';
  const showLine2 = `Age Limit: ${offer.age_limit || '18+'}  •  Merch: ${merchText}  •  Comps: ${totalComps} tickets`;
  doc.text(showLine2, margin + 15, y + 51);

  y += 78;

  // === ARTIST ACCOMMODATIONS (Rounded Gray Card) ===
  if (offer.include_hotel || offer.include_transport || offer.include_flights || offer.include_rider) {
    let accomLineCount = 0;
    if (offer.include_hotel && offer.hotel_budget) accomLineCount++;
    if (offer.include_transport && offer.transport_budget) accomLineCount++;
    if (offer.include_flights && offer.flight_budget) accomLineCount++;
    if (offer.include_rider && offer.rider_cap) accomLineCount++;

    const accomBoxHeight = 40 + accomLineCount * 11;

    doc.setFillColor(...lightGray);
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(1);
    drawRoundedRect(doc, margin, y, contentWidth, accomBoxHeight, 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...black);
    doc.text('ARTIST ACCOMMODATIONS', margin + 15, y + 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...gray);

    let accomY = y + 35;
    if (offer.include_hotel && offer.hotel_budget) {
      const hotelText = offer.hotel_notes
        ? `Hotel: ${offer.hotel_notes} (${offer.hotel_nights || 1} night${(offer.hotel_nights || 1) > 1 ? 's' : ''})`
        : `Hotel: ${offer.hotel_nights || 1} night${(offer.hotel_nights || 1) > 1 ? 's' : ''} - ${formatMoney(offer.hotel_budget)}/night`;
      doc.text(hotelText, margin + 15, accomY);
      accomY += 11;
    }

    if (offer.include_transport && offer.transport_budget) {
      const transportText = offer.transport_notes
        ? `Transport: ${offer.transport_notes}`
        : `Transport: ${formatMoney(offer.transport_budget)}`;
      doc.text(transportText, margin + 15, accomY);
      accomY += 11;
    }

    if (offer.include_flights && offer.flight_budget) {
      const flightText = offer.flight_notes
        ? `Flights: ${offer.flight_notes} (${formatMoney(offer.flight_budget)})`
        : `Flights: ${formatMoney(offer.flight_budget)}`;
      doc.text(flightText, margin + 15, accomY);
      accomY += 11;
    }

    if (offer.include_rider && offer.rider_cap) {
      const riderText = offer.rider_notes
        ? `Rider: ${offer.rider_notes} (up to ${formatMoney(offer.rider_cap)})`
        : `Rider: Up to ${formatMoney(offer.rider_cap)}`;
      doc.text(riderText, margin + 15, accomY);
    }

    y += accomBoxHeight + 16;
  }

  // === ARTIST LINEUP (Per-artist details) ===
  const supportActs = offer.support_acts || [];
  if (supportActs.length > 0) {
    if (y > pageHeight - margin - 120) {
      doc.addPage();
      y = margin + 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...black);
    doc.text('ARTIST LINEUP', margin, y);
    y += 16;

    if (mode === 'artist_offer') {
      // Artist offer mode: simple list with name, role, set length only
      const lineupBoxHeight = 30 + supportActs.length * 16;
      if (y + lineupBoxHeight > pageHeight - margin - 40) {
        doc.addPage();
        y = margin + 20;
      }
      doc.setFillColor(...lightGray);
      doc.setDrawColor(...borderGray);
      doc.setLineWidth(1);
      drawRoundedRect(doc, margin, y, contentWidth, lineupBoxHeight, 12);

      let listY = y + 18;
      supportActs.forEach((act) => {
        const actRole = (act.role || 'support').toUpperCase();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...black);
        doc.text(act.name || 'TBA', margin + 15, listY);
        const nw = doc.getTextWidth(act.name || 'TBA');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...darkGray);
        const info = [actRole, act.set_length ? `${act.set_length} min` : '', act.genre || ''].filter(Boolean).join('  •  ');
        doc.text(info, margin + 15 + nw + 8, listY);
        listY += 16;
      });

      y += lineupBoxHeight + 8;
    } else {
      // Internal modes: full details with deal, payment, accommodations
      supportActs.forEach((act) => {
        const actRole = (act.role || 'support').toUpperCase();
        const actDeal = act.deal_type === 'percentage' ? 'Percentage' : act.deal_type === 'door_deal' ? 'Door Deal' : 'Flat Fee';
        const actPayment = act.payment_method || 'deposit_balance';

        const hasAccom = act.include_hotel || act.include_transport || act.include_flights || act.include_rider;
        let accomLines = 0;
        if (act.include_hotel && act.hotel_budget) accomLines++;
        if (act.include_transport && act.transport_budget) accomLines++;
        if (act.include_flights && act.flight_budget) accomLines++;
        if (act.include_rider && act.rider_cap) accomLines++;

        let boxHeight = 55;
        if (actPayment === 'deposit_balance' && act.deposit_due_date) boxHeight += 11;
        if (act.set_length) boxHeight += 11;
        if (hasAccom) boxHeight += 5 + accomLines * 11;

        if (y + boxHeight > pageHeight - margin - 40) {
          doc.addPage();
          y = margin + 20;
        }

        doc.setFillColor(...lightGray);
        doc.setDrawColor(...borderGray);
        doc.setLineWidth(1);
        drawRoundedRect(doc, margin, y, contentWidth, boxHeight, 12);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...black);
        doc.text(act.name || 'TBA', margin + 15, y + 16);

        const nameWidth = doc.getTextWidth(act.name || 'TBA');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...darkGray);
        doc.text(actRole, margin + 15 + nameWidth + 8, y + 16);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...green);
        doc.text(formatMoney(act.guarantee || 0), margin + contentWidth - 15, y + 16, { align: 'right' });

        let lineY = y + 30;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...gray);

        let termsText = `Deal: ${actDeal}`;
        if (actPayment === 'deposit_balance') {
          const depAmt = act.deposit_type === 'fixed'
            ? (act.deposit_value || 0)
            : ((act.guarantee || 0) * ((act.deposit_value || 0) / 100));
          termsText += `  •  Deposit: ${formatMoney(depAmt)}`;
          if (act.deposit_value) {
            termsText += act.deposit_type === 'fixed' ? '' : ` (${act.deposit_value}%)`;
          }
          termsText += `  •  Balance: ${formatMoney((act.guarantee || 0) - depAmt)}`;
        } else if (actPayment === 'full_upfront') {
          termsText += '  •  Full Payment Upfront';
        } else if (actPayment === 'day_of_settlement') {
          const days = act.settlement_days ?? 7;
          termsText += days === 0 ? '  •  Settlement: Same day' : `  •  Settlement: ${days} days after`;
        }
        doc.text(termsText, margin + 15, lineY, { maxWidth: contentWidth - 30 });
        lineY += 11;

        if (actPayment === 'deposit_balance' && act.deposit_due_date) {
          doc.text(`Deposit Due: ${formatDateLong(act.deposit_due_date)}`, margin + 15, lineY);
          lineY += 11;
        }

        if (act.set_length) {
          doc.text(`Set: ${act.set_length} min${act.genre ? `  •  Genre: ${act.genre}` : ''}`, margin + 15, lineY);
          lineY += 11;
        }

        if (hasAccom) {
          lineY += 2;
          if (act.include_hotel && act.hotel_budget) {
            const hotelText = act.hotel_notes
              ? `Hotel: ${act.hotel_notes} (${act.hotel_nights || 1} night${(act.hotel_nights || 1) > 1 ? 's' : ''})`
              : `Hotel: ${act.hotel_nights || 1} night${(act.hotel_nights || 1) > 1 ? 's' : ''} - ${formatMoney(act.hotel_budget)}/night`;
            doc.text(hotelText, margin + 15, lineY);
            lineY += 11;
          }
          if (act.include_transport && act.transport_budget) {
            const tText = act.transport_notes ? `Transport: ${act.transport_notes}` : `Transport: ${formatMoney(act.transport_budget)}`;
            doc.text(tText, margin + 15, lineY);
            lineY += 11;
          }
          if (act.include_flights && act.flight_budget) {
            const fText = act.flight_notes
              ? `Flights: ${act.flight_notes} (${formatMoney(act.flight_budget)})`
              : `Flights: ${formatMoney(act.flight_budget)}`;
            doc.text(fText, margin + 15, lineY);
            lineY += 11;
          }
          if (act.include_rider && act.rider_cap) {
            const rText = act.rider_notes
              ? `Rider: ${act.rider_notes} (up to ${formatMoney(act.rider_cap)})`
              : `Rider: Up to ${formatMoney(act.rider_cap)}`;
            doc.text(rText, margin + 15, lineY);
            lineY += 11;
          }
        }

        y += boxHeight + 8;
      });
    }

    y += 4;
  }

  doc.addPage();
  y = mode === 'artist_offer' ? 25 : margin + 15;

  doc.setFont('ArchivoBlack', 'normal');
  doc.setFontSize(mode === 'artist_offer' ? 14 : 12);
  doc.setTextColor(...black);
  doc.text('DEAL TERMS & CONDITIONS', margin, y);
  y += mode === 'artist_offer' ? 12 : 8;

  doc.setDrawColor(...limeGreen);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += mode === 'artist_offer' ? 20 : 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(mode === 'artist_offer' ? 11 : 9);
  doc.setTextColor(...black);
  doc.text('COMPS BREAKDOWN:', margin, y);
  y += mode === 'artist_offer' ? 16 : 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(mode === 'artist_offer' ? 9 : 7);
  doc.setTextColor(...gray);
  const compLineSpacing = mode === 'artist_offer' ? 12 : 8;
  doc.text(`• Artist Comps: ${offer.comps_artist || 0}`, margin + 20, y);
  y += compLineSpacing;
  doc.text(`• Venue Comps: ${offer.comps_venue || 0}`, margin + 20, y);
  y += compLineSpacing;
  doc.text(`• Promoter Comps: ${offer.comps_promoter || 0}`, margin + 20, y);
  y += compLineSpacing;
  doc.text('• On Top', margin + 20, y);
  y += mode === 'artist_offer' ? 18 : 12;

  // Itemized Expenses Section (only show if enabled for this mode)
  if (pdfMode.showExpenseBreakdown) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...black);
    doc.text('ITEMIZED EXPENSES:', margin, y);
    y += 10;

  // Check if we need a new page
  if (y > pageHeight - margin - 200) {
    doc.addPage();
    y = margin + 20;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  // Talent Expenses
  const talentExpenses = Object.entries(offer.expenses.talent || {}).filter(([_, value]) => value > 0);
  if (talentExpenses.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...darkGray);
    doc.text('Talent:', margin + 20, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    talentExpenses.forEach(([name, amount]) => {
      if (y > pageHeight - margin - 80) {
        doc.addPage();
        y = margin + 20;
      }
      doc.text(`• ${name}`, margin + 30, y);
      doc.text(formatMoney(amount), pageWidth - margin - 20, y, { align: 'right' });
      y += 8;
    });
    y += 4;
  }

  // Support Acts
  const expSupportActs = offer.support_acts || [];
  if (expSupportActs.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...darkGray);
    doc.text('Support Acts:', margin + 20, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    expSupportActs.forEach((act) => {
      if (y > pageHeight - margin - 80) {
        doc.addPage();
        y = margin + 20;
      }
      const actLabel = `• ${act.name}${act.type ? ` (${act.type})` : ''}`;
      doc.text(actLabel, margin + 30, y);
      doc.text(formatMoney(act.guarantee || 0), pageWidth - margin - 20, y, { align: 'right' });
      y += 8;
    });
    y += 4;
  }

  // Production Expenses
  const productionExpenses = Object.entries(offer.expenses.production || {}).filter(([_, value]) => value > 0);
  if (productionExpenses.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...darkGray);
    doc.text('Production:', margin + 20, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    productionExpenses.forEach(([name, amount]) => {
      if (y > pageHeight - margin - 80) {
        doc.addPage();
        y = margin + 20;
      }
      doc.text(`• ${name}`, margin + 30, y);
      doc.text(formatMoney(amount), pageWidth - margin - 20, y, { align: 'right' });
      y += 8;
    });
    y += 4;
  }

  // Marketing Expenses
  const marketingExpenses = Object.entries(offer.expenses.marketing || {}).filter(([_, value]) => value > 0);
  if (marketingExpenses.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...darkGray);
    doc.text('Marketing:', margin + 20, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    marketingExpenses.forEach(([name, amount]) => {
      if (y > pageHeight - margin - 80) {
        doc.addPage();
        y = margin + 20;
      }
      doc.text(`• ${name}`, margin + 30, y);
      doc.text(formatMoney(amount), pageWidth - margin - 20, y, { align: 'right' });
      y += 8;
    });
    y += 4;
  }

  // General Expenses
  const generalExpenses = Object.entries(offer.expenses.general || {}).filter(([_, value]) => value > 0);
  if (generalExpenses.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...darkGray);
    doc.text('General:', margin + 20, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    generalExpenses.forEach(([name, amount]) => {
      if (y > pageHeight - margin - 80) {
        doc.addPage();
        y = margin + 20;
      }
      doc.text(`• ${name}`, margin + 30, y);
      doc.text(formatMoney(amount), pageWidth - margin - 20, y, { align: 'right' });
      y += 8;
    });
    y += 4;
  }

  // Variable Expenses
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkGray);
  doc.text('Variable:', margin + 20, y);
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...gray);

  if (ascapFee > 0) {
    doc.text(`• ASCAP Fee`, margin + 30, y);
    doc.text(formatMoney(ascapFee), pageWidth - margin - 20, y, { align: 'right' });
    y += 8;
  }
  if (bmiFee > 0) {
    doc.text(`• BMI Fee`, margin + 30, y);
    doc.text(formatMoney(bmiFee), pageWidth - margin - 20, y, { align: 'right' });
    y += 8;
  }
  if (sesacFee > 0) {
    doc.text(`• SESAC Fee`, margin + 30, y);
    doc.text(formatMoney(sesacFee), pageWidth - margin - 20, y, { align: 'right' });
    y += 8;
  }
  if (insuranceFee > 0) {
    doc.text(`• Insurance`, margin + 30, y);
    doc.text(formatMoney(insuranceFee), pageWidth - margin - 20, y, { align: 'right' });
    y += 8;
  }
  if (ccFee > 0) {
    doc.text(`• Credit Card Fees`, margin + 30, y);
    doc.text(formatMoney(ccFee), pageWidth - margin - 20, y, { align: 'right' });
    y += 8;
  }

  // Total line
  y += 4;
  doc.setDrawColor(...darkGray);
  doc.setLineWidth(1);
  doc.line(margin + 30, y, pageWidth - margin - 20, y);
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...black);
  doc.text('Total Fixed Expenses:', margin + 30, y);
  doc.text(formatMoney(totalFixedExpenses), pageWidth - margin - 20, y, { align: 'right' });
  y += 9;
  doc.text('Total Variable Expenses:', margin + 30, y);
  doc.text(formatMoney(totalVariableExpenses), pageWidth - margin - 20, y, { align: 'right' });
  y += 9;
  doc.setFontSize(9);
  doc.text('Show Expenses (excl. artist):', margin + 30, y);
  doc.text(formatMoney(totalFixedExpenses + totalVariableExpenses), pageWidth - margin - 20, y, { align: 'right' });
  y += 9;

  // The artist fee is a cost of the night. Leaving it out of the total made every
  // show look cheaper on paper than it actually is.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Artist payment:', margin + 30, y);
  doc.text(formatMoney(artistCost), pageWidth - margin - 20, y, { align: 'right' });
  y += 9;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...black);
  doc.text('TOTAL COST OF SHOW:', margin + 30, y);
  doc.text(formatMoney(totalFixedExpenses + totalVariableExpenses + artistCost), pageWidth - margin - 20, y, { align: 'right' });
  y += 10;

  if (extraRevenueTotal > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text('Bar & other revenue (yours, not the artist\u2019s):', margin + 30, y);
    doc.text(`+ ${formatMoney(extraRevenueTotal)}`, pageWidth - margin - 20, y, { align: 'right' });
    y += 10;
  }
  } // End of showExpenseBreakdown

  // Check if we need a new page before starting terms section
  if (y > pageHeight - margin - 60) {
    doc.addPage();
    y = margin + 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(mode === 'artist_offer' ? 11 : 9);
  doc.setTextColor(...black);
  doc.text('PAYMENT TERMS:', margin, y);
  y += mode === 'artist_offer' ? 14 : 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(mode === 'artist_offer' ? 9 : 8);
  doc.setTextColor(...gray);

  // Display payment terms based on payment method
  const paymentMethod = offer.payment_method || 'deposit_balance';

  if (paymentMethod === 'deposit_balance') {
    // Traditional deposit + balance payment
    const depositAmount = offer.calculations.artistTotalPayout * (offer.deposit_pct / 100);
    const balanceAmount = offer.calculations.artistTotalPayout - depositAmount;

    doc.text(`Deposit: ${formatMoney(depositAmount)} (${offer.deposit_pct}% of total)`, margin + 20, y);
    y += mode === 'artist_offer' ? 12 : 9;

    if (offer.deposit_due_date) {
      doc.text(`Deposit Due: ${formatDateLong(new Date(offer.deposit_due_date))}`, margin + 20, y);
    } else {
      doc.text('Deposit Due: 30 days before event', margin + 20, y);
    }
    y += mode === 'artist_offer' ? 12 : 9;

    doc.text(`Balance: ${formatMoney(balanceAmount)}`, margin + 20, y);
    y += mode === 'artist_offer' ? 12 : 9;

    // Display balance due date based on balance_due_timing
    const balanceDueTiming = offer.balance_due_timing || 'at_settlement';
    let balanceDueText = 'Balance Due: ';

    if (balanceDueTiming === 'at_settlement') {
      balanceDueText += 'At Event Settlement';
    } else if (balanceDueTiming === '5_days_before') {
      balanceDueText += '5 days before event';
    } else if (balanceDueTiming === '30_days_before') {
      balanceDueText += '30 days before event';
    } else if (balanceDueTiming === '60_days_before') {
      balanceDueText += '60 days before event';
    } else if (balanceDueTiming === 'upon_signing') {
      balanceDueText += 'Upon contract signing';
    } else if (balanceDueTiming === 'custom' && offer.custom_balance_due_date) {
      balanceDueText += formatDateLong(new Date(offer.custom_balance_due_date));
    } else {
      balanceDueText += 'At Event Settlement';
    }

    doc.text(balanceDueText, margin + 20, y);
    y += mode === 'artist_offer' ? 16 : 11;

  } else if (paymentMethod === 'full_upfront') {
    // Full payment before event
    doc.text(`Full Payment: ${formatMoney(offer.calculations.artistTotalPayout)}`, margin + 20, y);
    y += mode === 'artist_offer' ? 12 : 9;

    if (offer.full_payment_due_date) {
      doc.text(`Payment Due: ${formatDateLong(new Date(offer.full_payment_due_date))}`, margin + 20, y);
    } else {
      doc.text('Payment Due: Before event', margin + 20, y);
    }
    y += mode === 'artist_offer' ? 16 : 11;

  } else if (paymentMethod === 'day_of_settlement') {
    // Payment after event settlement
    doc.text(`Payment Amount: ${formatMoney(offer.calculations.artistTotalPayout)}`, margin + 20, y);
    y += mode === 'artist_offer' ? 12 : 9;

    doc.text('Payment Method: Day of Event Settlement', margin + 20, y);
    y += mode === 'artist_offer' ? 12 : 9;

    const settlementDays = offer.settlement_days || 7;
    const settlementText = settlementDays === 0
      ? 'Same day as event'
      : `${settlementDays} day${settlementDays > 1 ? 's' : ''} after event`;

    doc.text(`Payment Due: ${settlementText}`, margin + 20, y);
    y += mode === 'artist_offer' ? 12 : 9;
    doc.text('Payment will be made after event settlement is completed.', margin + 20, y, { maxWidth: contentWidth - 40 });
    y += mode === 'artist_offer' ? 16 : 11;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(mode === 'artist_offer' ? 11 : 9);
  doc.setTextColor(...black);
  doc.text('CANCELLATION POLICY:', margin, y);
  y += mode === 'artist_offer' ? 14 : 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(mode === 'artist_offer' ? 9 : 8);
  doc.setTextColor(...gray);
  doc.text('Standard cancellation terms apply as per signed agreement.', margin + 20, y, { maxWidth: contentWidth - 40 });
  y += mode === 'artist_offer' ? 16 : 11;

  if (companySettings?.legal_terms) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(mode === 'artist_offer' ? 11 : 9);
    doc.setTextColor(...black);
    doc.text('ADDITIONAL TERMS:', margin, y);
    y += mode === 'artist_offer' ? 14 : 9;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(mode === 'artist_offer' ? 8 : 7);
    doc.setTextColor(...gray);

    const terms = companySettings.legal_terms.split('\n').map(l => l.replace(/^[\s•·\-–]+/, '').trim()).filter(line => line.length > 1);
    const termLineSpacing = mode === 'artist_offer' ? 10 : 7;
    const termGap = mode === 'artist_offer' ? 2 : 1;
    // The page footer rule sits at pageHeight - 38; stop well clear of it.
    const termsBottom = pageHeight - 58;
    const newTermsPage = () => { doc.addPage(); y = margin + 20; };

    // Group each numbered clause with the bullets beneath it, so a heading is never
    // stranded at the foot of one page with its terms on the next.
    const groups: { heading: string | null; items: string[] }[] = [];
    terms.forEach(t => {
      if (/^\d+\.\s/.test(t)) groups.push({ heading: t, items: [] });
      else if (groups.length) groups[groups.length - 1].items.push(t);
      else groups.push({ heading: null, items: [t] });
    });

    const measure = (text: string, bold: boolean) => {
      doc.setFont('Saira', bold ? 'bold' : 'normal');
      return doc.splitTextToSize(text, contentWidth - 20).length * termLineSpacing;
    };

    groups.forEach(group => {
      // A clause can legitimately run longer than one page, so only require the
      // heading plus its first bullet to fit before committing to start it here.
      let keepTogether = group.heading ? measure(group.heading, true) : 0;
      if (group.items.length) keepTogether += measure(`• ${group.items[0]}`, false);
      if (y + keepTogether > termsBottom) newTermsPage();

      const drawWrapped = (text: string, bold: boolean) => {
        doc.setFont('Saira', bold ? 'bold' : 'normal');
        doc.setTextColor(...(bold ? PDF.ink : PDF.text));
        doc.splitTextToSize(text, contentWidth - 20).forEach((line: string) => {
          if (y > termsBottom) newTermsPage();
          doc.text(line, margin + 20, y);
          y += termLineSpacing;
        });
      };

      if (group.heading) drawWrapped(group.heading, true);
      group.items.forEach(item => drawWrapped(`• ${item}`, false));
      y += termGap;
    });

    y += mode === 'artist_offer' ? 12 : 8;
  }

  // Position signature section at bottom of page if there's room
  const signatureSectionHeight = 80; // Approximate height needed for signature section
  if (y > pageHeight - margin - signatureSectionHeight - 20) {
    // Not enough room, start new page
    doc.addPage();
    y = margin + 40;
  } else if (y < pageHeight - margin - signatureSectionHeight - 100) {
    // Plenty of room, push signatures toward bottom of page
    y = pageHeight - margin - signatureSectionHeight - 40;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(mode === 'artist_offer' ? 12 : 10);
  doc.setTextColor(...black);
  doc.text('AGREEMENT:', margin, y);
  y += mode === 'artist_offer' ? 30 : 25;

  doc.setDrawColor(...black);
  doc.setLineWidth(mode === 'artist_offer' ? 1.5 : 1);
  doc.line(margin, y, margin + 210, y);
  y += mode === 'artist_offer' ? 18 : 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(mode === 'artist_offer' ? 10 : 9);
  doc.setTextColor(...darkGray);
  doc.text('Artist Signature', margin, y);
  y += mode === 'artist_offer' ? 18 : 15;
  doc.text('Date: __________', margin, y);

  y -= mode === 'artist_offer' ? 36 : 30;
  doc.line(pageWidth / 2 + 10, y, pageWidth / 2 + 220, y);
  y += mode === 'artist_offer' ? 18 : 15;
  doc.text('Promoter Signature', pageWidth / 2 + 10, y);
  y += mode === 'artist_offer' ? 18 : 15;
  doc.text('Date: __________', pageWidth / 2 + 10, y);

  drawFooters(doc, companySettings?.company_name, [companySettings?.email, companySettings?.phone].filter(Boolean).join('  ·  '));
  if (pdfMode.watermark) {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      brandLabel(doc, pdfMode.watermark, pageWidth / 2, pageHeight - 40, { align: 'center', color: PDF.muted, size: 7 });
    }
  }

  const out: PDFOutput = output ?? (preview ? 'preview' : 'save');
  if (out === 'base64') {
    // raw base64 (no data: prefix) for email attachments
    return doc.output('datauristring').split(',')[1];
  }
  if (out === 'preview') {
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } else {
    doc.save(offerPDFFilename(offer));
  }
}

function formatMoney(amount: number): string {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatDateShort(date: string | Date): string {
  let d: Date;
  if (typeof date === 'string') {
    // Handle ISO date strings (YYYY-MM-DD) without timezone conversion
    const [year, month, day] = date.split('T')[0].split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = date;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateLong(date: string | Date): string {
  let d: Date;
  if (typeof date === 'string') {
    // Handle ISO date strings (YYYY-MM-DD) without timezone conversion
    const [year, month, day] = date.split('T')[0].split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = date;
  }
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTimeHR(time: string | undefined | null): string {
  if (!time) return 'TBA';
  return convertTo12Hour(time);
}
