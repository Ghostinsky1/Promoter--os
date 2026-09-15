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

  yPos += 2;
  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Projected', 'Actual', 'Variance']],
    body: [
      [
        'Revenue',
        formatCurrency((offer.calculations as any).grossRevenue ?? offer.calculations.netGross ?? offer.calculations.grossPotential ?? 0),
        formatCurrency(settlement.actual_revenue),
        formatCurrency(settlement.variance_revenue),
      ],
      [
        'Expenses',
        formatCurrency(offer.calculations.totalExpenses),
        formatCurrency(settlement.actual_total_expenses),
        formatCurrency(settlement.variance_expenses),
      ],
      [
        'Net Profit',
        formatCurrency(offer.calculations.netProfit),
        formatCurrency(settlement.actual_profit),
        formatCurrency(settlement.variance_profit),
      ],
    ],
    ...tableTheme(doc),
    columnStyles: {
      0: { fontStyle: 'bold' },
      3: {
        textColor: (rowIndex: number) => {
          const values = [settlement.variance_revenue, settlement.variance_expenses, settlement.variance_profit];
          return values[rowIndex] >= 0 ? [22, 163, 74] : [220, 38, 38];
        }
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

  (['talent', 'general', 'marketing', 'production'] as const).forEach(category => {
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    expenseData.push([
      { content: categoryName, colSpan: 4, styles: { fontStyle: 'bold', fillColor: PDF.tint, textColor: PDF.navy } }
    ]);

    Object.entries(offer.expenses[category]).forEach(([key, projectedValue]) => {
      const actualValue = settlement.actual_expenses[category][key] || 0;
      const variance = actualValue - projectedValue;
      expenseData.push([
        `  ${key}`,
        formatCurrency(projectedValue),
        formatCurrency(actualValue),
        formatCurrency(variance),
      ]);
    });
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Expense Item', 'Projected', 'Actual', 'Variance']],
    body: expenseData,
    ...tableTheme(doc),

    columnStyles: {
      3: {
        textColor: (rowIndex: number, _column: number) => {
          if (!expenseData[rowIndex] || expenseData[rowIndex].length === 1) return [0, 0, 0];
          const varianceText = expenseData[rowIndex][3];
          if (typeof varianceText === 'string' && varianceText.includes('-')) {
            return [22, 163, 74];
          }
          return [220, 38, 38];
        }
      }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  if (settlement.notes && settlement.notes.trim()) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    brandLabel(doc, '[ 04 ]  Settlement notes', 20, yPos, { color: PDF.blue });

    yPos += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const notesLines = doc.splitTextToSize(settlement.notes, 170);
    doc.text(notesLines, 20, yPos);
  }

  if (companySettings?.legal_terms) {
    yPos = (doc as any).lastAutoTable.finalY + 15;

    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    } else {
      yPos += 15;
    }

    brandLabel(doc, '[ 05 ]  Terms & conditions', 20, yPos, { color: PDF.blue });

    yPos += 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);

    const terms = companySettings.legal_terms.split('\n').filter(line => line.trim());
    terms.forEach(term => {
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }
      const lines = doc.splitTextToSize(term, 170);
      lines.forEach((line: string) => {
        doc.text(line, 20, yPos);
        yPos += 4;
      });
    });

    doc.setTextColor(0);
  }

  const filename = `Settlement_${offer.show.artist_name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  drawFooters(doc, companySettings?.company_name, [companySettings?.email, companySettings?.phone].filter(Boolean).join('  ·  '));
  doc.save(filename);
}
