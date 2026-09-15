import { useState } from 'react';
import { PDFMode, PDF_MODES } from '../lib/pdfModes';
import { generateOfferPDF } from '../lib/generateOfferPDF';
import { Offer, CompanySettings } from '../types';
import { X, FileText, Download, Eye, Lock, DollarSign, AlertCircle, Check } from 'lucide-react';

interface PDFPreviewProps {
  offer: Offer;
  companySettings: CompanySettings | null;
  costsOnly: boolean;
  onClose: () => void;
}

const MODE_DETAILS: Record<PDFMode, { icon: typeof FileText; tag: string; shows: string[]; hides: string[] }> = {
  artist_offer: {
    icon: FileText,
    tag: 'Recommended',
    shows: ['Deal structure', 'Ticket scaling', 'Artist payment & terms'],
    hides: ['Your profit', 'Break-even', 'Expense details'],
  },
  estimate: {
    icon: DollarSign,
    tag: 'Internal',
    shows: ['Everything — profit, break-even, expenses, margins'],
    hides: [],
  },
};

export function PDFPreview({ offer, companySettings, costsOnly, onClose }: PDFPreviewProps) {
  const [selectedMode, setSelectedMode] = useState<PDFMode>('artist_offer');
  const currentMode = PDF_MODES[selectedMode];

  const handleGenerate = () => generateOfferPDF(offer, companySettings || undefined, false, costsOnly, selectedMode);
  const handlePreview = () => generateOfferPDF(offer, companySettings || undefined, true, costsOnly, selectedMode);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-[#14171E] border border-gray-800 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[94vh] overflow-y-auto shadow-2xl">
        <div className="border-b border-gray-800 p-5 sm:p-6 flex items-start justify-between gap-4">
          <div>
            <p className="font-label text-[11px] tracking-[0.2em] text-[#8FD3FF] uppercase mb-1">[ PDF ]</p>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Generate PDF</h2>
            <p className="text-gray-400 text-sm mt-1">Pick who this is for, then preview or download.</p>
          </div>
          <button className="text-gray-400 hover:text-white transition-colors" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(PDF_MODES) as PDFMode[]).map((m) => {
              const cfg = PDF_MODES[m];
              const d = MODE_DETAILS[m];
              const Icon = d.icon;
              const active = selectedMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMode(m)}
                  className={`text-left rounded-2xl border p-4 transition-colors ${
                    active ? 'border-[#8FD3FF] bg-[#8FD3FF]/10' : 'border-[#2A3040] bg-[#0B0D12] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-[#8FD3FF]/20' : 'bg-[#22262F]'}`}>
                        <Icon className={`h-4 w-4 ${active ? 'text-[#8FD3FF]' : 'text-gray-300'}`} />
                      </div>
                      {active && (
                        <div className="w-5 h-5 bg-[#8FD3FF] rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-[#04214D]" />
                        </div>
                      )}
                    </div>
                    <span className={`font-label text-[10px] tracking-widest uppercase px-2 py-1 rounded-lg ${
                      m === 'artist_offer' ? 'bg-[#8FD3FF] text-[#04214D]' : 'bg-[#22262F] text-gray-300'
                    }`}>
                      {d.tag}
                    </span>
                  </div>
                  <div className={`font-bold ${active ? 'text-[#8FD3FF]' : 'text-white'}`}>{cfg.name}</div>
                  <div className="text-xs text-gray-400 mb-3">{cfg.audience}</div>
                  <ul className="space-y-1.5 text-xs">
                    {d.shows.map((t) => (
                      <li key={t} className="flex items-center gap-2 text-gray-200"><Eye className="h-3 w-3 text-[#8FD3FF] flex-shrink-0" />{t}</li>
                    ))}
                    {d.hides.map((t) => (
                      <li key={t} className="flex items-center gap-2 text-gray-500"><Lock className="h-3 w-3 flex-shrink-0" />Hides {t.toLowerCase()}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {selectedMode === 'estimate' ? (
            <div className="rounded-2xl border border-[#FFB86B]/40 bg-[#FFB86B]/10 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-[#FFB86B] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[#FFB86B] font-semibold text-sm">Internal use only</p>
                <p className="text-gray-400 text-xs mt-0.5">This version shows your profit and break-even. Don't send it to artists or agents.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#8FD3FF]/30 bg-[#8FD3FF]/10 p-4 flex items-start gap-3">
              <Check className="h-5 w-5 text-[#8FD3FF] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[#8FD3FF] font-semibold text-sm">Safe to send</p>
                <p className="text-gray-400 text-xs mt-0.5">Clean, professional offer with none of your internal numbers.</p>
              </div>
            </div>
          )}

          {costsOnly && (
            <p className="text-xs text-gray-500">"Costs only" is on — the PDF will leave out revenue projections.</p>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handlePreview}
              className="bg-[#22262F] hover:bg-[#2A3040] border border-[#2A3040] text-white px-4 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Eye className="h-4 w-4 text-[#8FD3FF]" /> Preview
            </button>
            <button
              onClick={handleGenerate}
              className="bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] px-4 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Download className="h-4 w-4" /> Download {currentMode.name.split(' ')[0]}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
