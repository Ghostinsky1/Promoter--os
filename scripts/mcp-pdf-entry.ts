import { generateOfferPDF, offerPDFFilename } from '../src/lib/generateOfferPDF';
import { generateArtistOfferSheet } from '../src/lib/generateArtistOfferSheet';
export function offerPdfBase64(offer: any, cs: any, mode: 'estimate' | 'artist_offer' = 'artist_offer', costsOnly = false): string {
  return generateOfferPDF(offer, cs || undefined, false, costsOnly, mode, 'base64') as string;
}
export function artistSheetBase64(artist: any, offer: any, cs: any): string {
  const doc = generateArtistOfferSheet(artist, offer, cs || undefined);
  return doc.output('datauristring').split(',')[1];
}
export { offerPDFFilename };
