import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OfferWithShow, ScheduleItem, VenueContact, CompanySettings } from '../types';
import { convertTo12Hour } from './timeHelpers';

export function generateRunOfShowPDF(
  offerData: OfferWithShow,
  schedule: ScheduleItem[],
  venueContact: VenueContact,
  eventDate: string,
  companySettings?: CompanySettings
) {
  const doc = new jsPDF();
  let yPos = 20;

  doc.setFillColor(15, 17, 19);
  doc.rect(0, 0, 210, 45, 'F');

  doc.setFillColor(196, 255, 13);
  doc.rect(0, 0, 210, 3, 'F');

  if (companySettings?.logo_url) {
    try {
      doc.addImage(companySettings.logo_url, 'PNG', 15, 12, 20, 20);
    } catch (error) {
      console.error('Failed to add logo:', error);
    }
  }

  doc.setTextColor(196, 255, 13);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text('RUN OF SHOW', 105, 20, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.text(offerData.show.artist_name.toUpperCase(), 105, 30, { align: 'center' });

  if (companySettings?.company_name) {
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    doc.text(companySettings.company_name.toUpperCase(), 190, 15, { align: 'right' });
  }

  yPos = 55;

  doc.setTextColor(0, 0, 0);
  doc.setFillColor(26, 31, 30);
  doc.roundedRect(15, yPos, 85, 35, 3, 3, 'F');
  doc.setFillColor(20, 23, 22);
  doc.roundedRect(105, yPos, 90, 35, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(196, 255, 13);
  doc.text('EVENT INFORMATION', 20, yPos + 8);
  doc.text('VENUE CONTACT', 110, yPos + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`Date: ${formatDate(eventDate)}`, 20, yPos + 16);
  doc.text(`Venue: ${offerData.show.venue_name}`, 20, yPos + 22);
  doc.text(`Capacity: ${offerData.show.capacity}`, 20, yPos + 28);

  doc.text(`Name: ${venueContact.name || 'N/A'}`, 110, yPos + 16);
  doc.text(`Phone: ${venueContact.phone || 'N/A'}`, 110, yPos + 22);
  doc.text(`Email: ${venueContact.email || 'N/A'}`, 110, yPos + 28);

  yPos += 45;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(196, 255, 13);
  doc.text('EVENT SCHEDULE', 105, yPos, { align: 'center' });
  yPos += 10;

  doc.setFillColor(20, 23, 22);
  doc.roundedRect(15, yPos, 180, 10, 2, 2, 'F');
  doc.setTextColor(196, 255, 13);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('TIME', 20, yPos + 7);
  doc.text('DURATION', 50, yPos + 7);
  doc.text('ACTIVITY', 80, yPos + 7);
  doc.text('RESPONSIBLE', 150, yPos + 7);
  yPos += 12;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  schedule.forEach((item, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(15, yPos - 2, 180, 8, 1, 1, 'F');
    }

    const categoryColors: Record<string, [number, number, number]> = {
      production: [59, 130, 246],
      technical: [168, 85, 247],
      artist: [236, 72, 153],
      performance: [196, 255, 13],
      venue: [249, 115, 22],
      other: [107, 114, 128]
    };
    const color = categoryColors[item.category] || categoryColors.other;
    doc.setFillColor(...color);
    doc.circle(17, yPos + 2, 1.5, 'F');

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(convertTo12Hour(item.time), 20, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${item.duration} min`, 53, yPos + 5);

    doc.setFont('helvetica', 'bold');
    const titleText = doc.splitTextToSize(item.title, 65);
    doc.text(titleText[0], 80, yPos + 5);

    doc.setFont('helvetica', 'normal');
    const responsibleText = doc.splitTextToSize(item.responsible, 40);
    doc.text(responsibleText[0], 150, yPos + 5);

    yPos += 8;

    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
  });

  yPos += 12;

  doc.setFillColor(26, 31, 30);
  doc.roundedRect(15, yPos - 5, 180, 25, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(196, 255, 13);
  doc.text('CATEGORY LEGEND', 20, yPos + 2);
  yPos += 10;

  const legend = [
    { category: 'production', label: 'Production', color: [59, 130, 246] as [number, number, number] },
    { category: 'technical', label: 'Technical', color: [168, 85, 247] as [number, number, number] },
    { category: 'artist', label: 'Artist', color: [236, 72, 153] as [number, number, number] },
    { category: 'performance', label: 'Performance', color: [196, 255, 13] as [number, number, number] },
    { category: 'venue', label: 'Venue', color: [249, 115, 22] as [number, number, number] }
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  legend.forEach((item, index) => {
    const x = 20 + (index * 35);
    doc.setFillColor(...item.color);
    doc.circle(x, yPos, 1.5, 'F');
    doc.text(item.label, x + 5, yPos + 2);
  });

  yPos += 15;

  if (yPos < 240) {
    doc.setFillColor(20, 23, 22);
    doc.roundedRect(15, yPos, 180, 30, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(196, 255, 13);
    doc.text('IMPORTANT NOTES', 20, yPos + 8);
    yPos += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('• All times are approximate and subject to change', 20, yPos);
    yPos += 5;
    doc.text('• Contact venue production manager for any schedule changes', 20, yPos);
    yPos += 5;
    doc.text('• Artist load-in and sound check times to be confirmed', 20, yPos);
    yPos += 15;
  }

  if (companySettings?.legal_terms) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    } else {
      yPos += 15;
    }

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TERMS & CONDITIONS', 20, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
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
  }

  doc.setFillColor(15, 17, 19);
  doc.rect(0, 282, 210, 15, 'F');

  doc.setFillColor(196, 255, 13);
  doc.rect(0, 282, 210, 1, 'F');

  doc.setFontSize(8);
  doc.setTextColor(196, 255, 13);
  doc.setFont('helvetica', 'bold');
  doc.text('Generated by Atlas', 105, 288, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text(new Date().toLocaleDateString(), 105, 292, { align: 'center' });

  const filename = `Run_of_Show_${offerData.show.artist_name.replace(/\s+/g, '_')}_${formatDate(eventDate)}.pdf`;
  doc.save(filename);
}

function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
