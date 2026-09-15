import jsPDF from 'jspdf';
import { calculateArtistCost } from './artistCalculations';
import type { EventArtist, OfferWithShow, CompanySettings } from '../types';

function drawRoundedRect(doc: jsPDF, x: number, y: number, width: number, height: number, radius: number) {
  doc.roundedRect(x, y, width, height, radius, radius, 'FD');
}

function formatMoney(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime12(time24: string): string {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const ROLE_LABELS: Record<string, string> = {
  headliner: 'Headliner',
  direct_support: 'Direct Support',
  support: 'Support',
  local_opener: 'Local Opener',
};

export function generateArtistOfferSheet(
  artist: EventArtist,
  offer: OfferWithShow,
  companySettings?: CompanySettings
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const margin = 36;
  const pageWidth = 612;
  const contentWidth = pageWidth - margin * 2;

  const black: [number, number, number] = [15, 17, 19];
  const darkGray: [number, number, number] = [107, 114, 128];
  const gray: [number, number, number] = [156, 163, 175];
  const lightGray: [number, number, number] = [249, 250, 251];
  const borderGray: [number, number, number] = [229, 231, 235];
  const green: [number, number, number] = [16, 185, 129];
  const limeGreen: [number, number, number] = [196, 255, 13];

  const costs = calculateArtistCost(artist);
  let y = 30;

  if (companySettings?.logo_url) {
    try {
      doc.addImage(companySettings.logo_url, 'PNG', (pageWidth - 80) / 2, y, 80, 40);
      y += 52;
    } catch (_) { /* skip logo */ }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...black);
  doc.text('ARTIST OFFER', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...darkGray);
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth - margin, y, { align: 'right' });
  y += 24;

  doc.setDrawColor(...limeGreen);
  doc.setLineWidth(3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  // Event Info Box
  doc.setFillColor(...lightGray);
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.5);
  const eventBoxH = 70;
  drawRoundedRect(doc, margin, y, contentWidth, eventBoxH, 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...black);
  doc.text(offer.show.event_name || offer.show.artist_name, margin + 14, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...darkGray);
  doc.text(offer.show.venue_name, margin + 14, y + 32);
  if (offer.venue_full_address) {
    doc.text(offer.venue_full_address, margin + 14, y + 44);
  }
  doc.text(formatDateLong(offer.show.event_date), margin + 14, y + 56);

  if (offer.show.capacity) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Capacity: ${offer.show.capacity.toLocaleString()}`, pageWidth - margin - 14, y + 18, { align: 'right' });
  }
  y += eventBoxH + 16;

  // Artist Info Box
  doc.setFillColor(...lightGray);
  doc.setDrawColor(...borderGray);
  const artistBoxH = 45;
  drawRoundedRect(doc, margin, y, contentWidth, artistBoxH, 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...black);
  doc.text(artist.artist_name || 'TBA', margin + 14, y + 18);

  const roleLbl = ROLE_LABELS[artist.role] || artist.role;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...darkGray);
  doc.text(roleLbl.toUpperCase(), margin + 14 + doc.getTextWidth(artist.artist_name || 'TBA') + 10, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...green);
  doc.text(formatMoney(costs.guarantee), pageWidth - margin - 14, y + 18, { align: 'right' });

  if (artist.set_length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.text(`Set: ${artist.set_length} min`, margin + 14, y + 34);
  }
  if (artist.performance_time) {
    doc.text(`Performance: ${formatTime12(artist.performance_time)}`, margin + 120, y + 34);
  }
  y += artistBoxH + 16;

  // Payment Terms
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...black);
  doc.text('PAYMENT TERMS', margin, y);
  y += 14;

  doc.setFillColor(...lightGray);
  doc.setDrawColor(...borderGray);
  const payBoxH = 55;
  drawRoundedRect(doc, margin, y, contentWidth, payBoxH, 8);

  const colW = contentWidth / 3;
  const labels = ['Guarantee', 'Deposit', 'Balance Due'];
  const values = [formatMoney(costs.guarantee), formatMoney(costs.deposit), formatMoney(costs.balance)];

  for (let i = 0; i < 3; i++) {
    const cx = margin + 14 + colW * i;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text(labels[i].toUpperCase(), cx, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...black);
    doc.text(values[i], cx, y + 32);
  }

  if (artist.deposit_type === 'percentage' && artist.deposit_percentage) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...darkGray);
    doc.text(`(${artist.deposit_percentage}% of guarantee)`, margin + 14 + colW, y + 44);
  }
  y += payBoxH + 16;

  // Travel Terms (if any)
  const hasTravel = artist.flight_covered || artist.hotel_covered || artist.ground_transport_covered;
  if (hasTravel) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...black);
    doc.text('TRAVEL', margin, y);
    y += 14;

    let travelLines: string[] = [];
    if (artist.flight_covered) {
      travelLines.push(`Flights: Provided (budget ${formatMoney(artist.flight_budget || 0)})`);
    }
    if (artist.hotel_covered) {
      const nights = artist.hotel_nights || 1;
      const rooms = artist.hotel_rooms || 1;
      travelLines.push(`Hotel: ${rooms} room${rooms > 1 ? 's' : ''} x ${nights} night${nights > 1 ? 's' : ''} (${formatMoney(artist.hotel_budget || 0)}/night)`);
    }
    if (artist.ground_transport_covered) {
      travelLines.push(`Ground Transport: Provided (${formatMoney(artist.ground_transport_budget || 0)})`);
    }
    if (artist.airport_pickup) {
      travelLines.push('Airport Pickup: Yes');
    }

    const tBoxH = 18 + travelLines.length * 14;
    doc.setFillColor(...lightGray);
    doc.setDrawColor(...borderGray);
    drawRoundedRect(doc, margin, y, contentWidth, tBoxH, 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    let ty = y + 15;
    for (const line of travelLines) {
      doc.text(line, margin + 14, ty);
      ty += 14;
    }
    y += tBoxH + 16;
  }

  // Hospitality (if any)
  const hasHospitality = artist.rider_included || artist.hospitality_buyout > 0 || artist.dinner_buyout > 0 || artist.drink_tickets > 0;
  if (hasHospitality) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...black);
    doc.text('HOSPITALITY', margin, y);
    y += 14;

    let hospLines: string[] = [];
    if (artist.rider_included) hospLines.push('Artist Rider: Included');
    if (artist.hospitality_buyout > 0) hospLines.push(`Hospitality Buyout: ${formatMoney(artist.hospitality_buyout)}`);
    if (artist.dinner_buyout > 0) hospLines.push(`Dinner Buyout: ${formatMoney(artist.dinner_buyout)}`);
    if (artist.drink_tickets > 0) hospLines.push(`Drink Tickets: ${artist.drink_tickets}`);
    if (artist.backstage_needs) hospLines.push(`Backstage: ${artist.backstage_needs}`);

    const hBoxH = 18 + hospLines.length * 14;
    doc.setFillColor(...lightGray);
    doc.setDrawColor(...borderGray);
    drawRoundedRect(doc, margin, y, contentWidth, hBoxH, 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    let hy = y + 15;
    for (const line of hospLines) {
      doc.text(line, margin + 14, hy);
      hy += 14;
    }
    y += hBoxH + 16;
  }

  // Other Terms
  const hasOther = artist.guest_list_spots > 0 || artist.merch_cut > 0 || artist.meet_and_greet || artist.soundcheck_time || artist.special_terms;
  if (hasOther) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...black);
    doc.text('OTHER TERMS', margin, y);
    y += 14;

    let otherLines: string[] = [];
    if (artist.guest_list_spots > 0) otherLines.push(`Guest List: ${artist.guest_list_spots} spots`);
    if (artist.merch_cut > 0) otherLines.push(`Merch: ${artist.merch_cut}% venue cut`);
    if (artist.meet_and_greet) otherLines.push('Meet & Greet: Yes');
    if (artist.soundcheck_time) otherLines.push(`Soundcheck: ${formatTime12(artist.soundcheck_time)}`);
    if (artist.special_terms) otherLines.push(artist.special_terms);

    const oBoxH = 18 + otherLines.length * 14;
    doc.setFillColor(...lightGray);
    doc.setDrawColor(...borderGray);
    drawRoundedRect(doc, margin, y, contentWidth, oBoxH, 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    let oy = y + 15;
    for (const line of otherLines) {
      doc.text(line, margin + 14, oy, { maxWidth: contentWidth - 28 });
      oy += 14;
    }
    y += oBoxH + 16;
  }

  // Total Cost Summary
  doc.setDrawColor(...limeGreen);
  doc.setLineWidth(3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...black);
  doc.text('TOTAL ARTIST COST', margin, y);
  doc.setFontSize(14);
  doc.setTextColor(...green);
  doc.text(formatMoney(costs.totalCost), pageWidth - margin, y, { align: 'right' });
  y += 20;

  if (costs.totalTravelCost > 0 || costs.totalHospitalityCost > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...darkGray);
    const breakdown = [
      `Guarantee: ${formatMoney(costs.guarantee)}`,
      costs.totalTravelCost > 0 ? `Travel: ${formatMoney(costs.totalTravelCost)}` : null,
      costs.totalHospitalityCost > 0 ? `Hospitality: ${formatMoney(costs.totalHospitalityCost)}` : null,
    ].filter(Boolean).join('  |  ');
    doc.text(breakdown, margin, y);
    y += 16;
  }

  // Footer - Company info
  if (companySettings?.company_name || companySettings?.email || companySettings?.phone) {
    y = Math.max(y + 20, 720);
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    const parts = [companySettings.company_name, companySettings.email, companySettings.phone].filter(Boolean);
    doc.text(parts.join('  |  '), pageWidth / 2, y, { align: 'center' });
  }

  return doc;
}
