import { generateOfferPDF } from '../src/lib/generateOfferPDF';
import { generateArtistOfferSheet } from '../src/lib/generateArtistOfferSheet';
import { generateRunOfShowPDF } from '../src/lib/generateRunOfShowPDF';
import { generateSettlementPDF } from '../src/lib/generateSettlementPDF';
import jsPDF from 'jspdf';
(window as any).__pdfs = {};
let out = '';
(jsPDF as any).API.save = function () { (window as any).__pdfs[out] = this.output('datauristring'); };
(window as any).renderAll = (d: any) => {
  out = 'offer-estimate'; generateOfferPDF(d.offer, d.cs, false, false, 'estimate');
  out = 'offer-artist'; generateOfferPDF(d.offer, d.cs, false, false, 'artist_offer');
  if (d.artist) { const doc = generateArtistOfferSheet(d.artist, d.offer, d.cs); (window as any).__pdfs['artist-sheet'] = doc.output('datauristring'); }
  if (d.ros) { out = 'run-of-show'; generateRunOfShowPDF(d.offer, d.ros.schedule, d.ros.venue_contact, d.ros.event_date || d.offer.show.event_date, d.cs); }
  if (d.settlement) { out = 'settlement'; generateSettlementPDF(d.offer, d.settlement, d.cs); }
  return Object.keys((window as any).__pdfs);
};
