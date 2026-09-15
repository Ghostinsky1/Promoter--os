export type PDFMode = 'estimate' | 'artist_offer';

export interface PDFModeConfig {
  id: PDFMode;
  name: string;
  description: string;
  audience: string;
  showProfit: boolean;
  showBreakEven: boolean;
  showExpenseBreakdown: boolean;
  showMargins: boolean;
  watermark: string | null;
  color: string;
}

export const PDF_MODES: Record<PDFMode, PDFModeConfig> = {
  estimate: {
    id: 'estimate',
    name: 'Estimate (Internal)',
    description: 'Full financial breakdown with profit and break-even',
    audience: 'Internal use only',
    showProfit: true,
    showBreakEven: true,
    showExpenseBreakdown: true,
    showMargins: true,
    watermark: 'INTERNAL ESTIMATE',
    color: '#6B7280'
  },
  artist_offer: {
    id: 'artist_offer',
    name: 'Artist Offer',
    description: 'Clean offer for artist/agent without internal financials',
    audience: 'Send to artist/agent',
    showProfit: false,
    showBreakEven: false,
    showExpenseBreakdown: false,
    showMargins: false,
    watermark: null,
    color: '#C4FF0D'
  }
} as const;
