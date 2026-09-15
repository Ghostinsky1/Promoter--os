import fs from 'fs';
import { generateOfferPDF } from '../src/lib/generateOfferPDF';
import { generateArtistOfferSheet } from '../src/lib/generateArtistOfferSheet';
import { generateRunOfShowPDF } from '../src/lib/generateRunOfShowPDF';
import { generateSettlementPDF } from '../src/lib/generateSettlementPDF';
import * as J from 'jspdf';
const jsPDF: any = (J as any).jsPDF || (J as any).default;
const d = JSON.parse(fs.readFileSync(process.env.SAMPLE!, 'utf8'));
let out = '';
// capture saves
(jsPDF.prototype as any).save = function (name: string) { fs.writeFileSync(process.env.OUT + '/' + out + '.pdf', Buffer.from(this.output('arraybuffer'))); };
(globalThis as any).window = { open: () => {} };
(globalThis as any).URL.createObjectURL = () => '';
out = 'offer-estimate'; generateOfferPDF(d.offer, d.cs, false, false, 'estimate');
out = 'offer-artist'; generateOfferPDF(d.offer, d.cs, false, false, 'artist_offer');
if (d.artist) { const doc = generateArtistOfferSheet(d.artist, d.offer, d.cs); fs.writeFileSync(process.env.OUT + '/artist-sheet.pdf', Buffer.from(doc.output('arraybuffer'))); }
if (d.ros) { out = 'run-of-show'; generateRunOfShowPDF(d.offer, d.ros.schedule, d.ros.venue_contact, d.ros.event_date || d.offer.show.event_date, d.cs); }
if (d.settlement) { out = 'settlement'; generateSettlementPDF(d.offer, d.settlement, d.cs); }
console.log('done');
