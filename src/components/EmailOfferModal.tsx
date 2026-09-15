import { useMemo, useState } from 'react';
import { X, Send, Loader2, Check, Paperclip, AlertCircle } from 'lucide-react';
import { OfferWithShow, CompanySettings, EventArtist } from '../types';
import { PDFMode, PDF_MODES } from '../lib/pdfModes';
import { generateOfferPDF, offerPDFFilename } from '../lib/generateOfferPDF';
import { sendEmail, parseRecipients } from '../lib/email';
import { parseLocalDate } from '../lib/dateHelpers';

interface EmailOfferModalProps {
  offer: OfferWithShow;
  companySettings: CompanySettings | null;
  artists: EventArtist[];
  costsOnly: boolean;
  onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailOfferModal({ offer, companySettings, artists, costsOnly, onClose }: EmailOfferModalProps) {
  const eventDate = useMemo(() => {
    const d = parseLocalDate(offer.show.event_date);
    return d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  }, [offer.show.event_date]);

  const headliner = useMemo(
    () => artists.find((a) => a.role === 'headliner' && a.contact_email) || artists.find((a) => a.contact_email),
    [artists],
  );

  const senderName = companySettings?.contact_name || companySettings?.company_name || '';
  const companyName = companySettings?.company_name || '';

  const [to, setTo] = useState(headliner?.contact_email || '');
  const [subject, setSubject] = useState(`Offer: ${offer.show.artist_name} — ${offer.show.venue_name}${eventDate ? ` · ${eventDate}` : ''}`);
  const [message, setMessage] = useState(
    `Hi${headliner?.artist_name ? ` ${headliner.artist_name} team` : ''},\n\n` +
      `Please find attached our offer for ${offer.show.artist_name} at ${offer.show.venue_name}${eventDate ? ` on ${eventDate}` : ''}.\n\n` +
      `Let us know if you have any questions — happy to jump on a call to walk through the details.\n\n` +
      `Thanks,\n${senderName || ''}${companyName && senderName !== companyName ? `\n${companyName}` : ''}`.trimEnd(),
  );
  const [mode, setMode] = useState<PDFMode>('artist_offer');
  const [attach, setAttach] = useState(true);
  const [copySelf, setCopySelf] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recipients = parseRecipients(to);
  const invalid = recipients.filter((r) => !EMAIL_RE.test(r));
  const canSend = recipients.length > 0 && invalid.length === 0 && subject.trim() && message.trim() && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const attachments = [];
      if (attach) {
        const base64 = generateOfferPDF(offer, companySettings || undefined, false, costsOnly, mode, 'base64');
        if (typeof base64 !== 'string' || !base64) throw new Error('Could not build the PDF attachment.');
        attachments.push({ filename: offerPDFFilename(offer), content: base64, type: 'application/pdf' });
      }
      const result = await sendEmail({
        to: recipients,
        subject: subject.trim(),
        message: message.trim(),
        copySelf,
        senderName: senderName || undefined,
        companyName: companyName || undefined,
        attachments,
      });
      setSent(result.sent_to);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong sending the email.');
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    'w-full bg-[#0B0D12] border border-[#2A3040] rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#8FD3FF] focus:border-transparent';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 sm:p-6">
      <div className="bg-[#14171E] border border-gray-800 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="border-b border-gray-800 p-5 sm:p-6 flex items-start justify-between gap-4">
          <div>
            <p className="font-label text-[11px] tracking-[0.2em] text-[#8FD3FF] uppercase mb-1">[ Email ]</p>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Send this offer</h2>
            <p className="text-gray-400 text-sm mt-1">
              Sent from support@gozaentertainment.com · replies go to your account email
            </p>
          </div>
          <button className="text-gray-400 hover:text-white transition-colors" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-[#8FD3FF]/15 flex items-center justify-center mb-4">
              <Check className="h-7 w-7 text-[#8FD3FF]" />
            </div>
            <h3 className="text-white text-lg font-bold mb-1">Email sent</h3>
            <p className="text-gray-400 text-sm">
              Delivered to {sent.join(', ')}
              {copySelf ? ' with a copy to you.' : '.'}
            </p>
            <button
              onClick={onClose}
              className="mt-6 bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] px-5 py-2 rounded-xl font-bold text-sm transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">To</label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="agent@example.com, manager@example.com"
                className={inputCls}
              />
              {invalid.length > 0 && (
                <p className="text-xs text-orange-400 mt-1">Check these addresses: {invalid.join(', ')}</p>
              )}
              {!to && artists.length > 0 && !headliner && (
                <p className="text-xs text-gray-500 mt-1">No contact email on the artist cards yet — type one above.</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className={`${inputCls} resize-y leading-relaxed`}
              />
            </div>

            <div className="rounded-2xl border border-[#2A3040] bg-[#0B0D12] p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attach}
                  onChange={(e) => setAttach(e.target.checked)}
                  className="w-4 h-4 text-[#8FD3FF] bg-[#22262F] border-gray-700 rounded focus:ring-2 focus:ring-[#8FD3FF]"
                />
                <Paperclip className="h-4 w-4 text-[#8FD3FF]" />
                <span className="font-medium">Attach PDF</span>
                <span className="text-gray-500 text-xs">{offerPDFFilename(offer)}</span>
              </label>

              {attach && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                  {(Object.keys(PDF_MODES) as PDFMode[]).map((m) => {
                    const cfg = PDF_MODES[m];
                    const active = mode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                          active ? 'border-[#8FD3FF] bg-[#8FD3FF]/10' : 'border-[#2A3040] hover:border-gray-600'
                        }`}
                      >
                        <div className={`text-sm font-bold ${active ? 'text-[#8FD3FF]' : 'text-white'}`}>{cfg.name}</div>
                        <div className="text-xs text-gray-500">{cfg.audience}</div>
                      </button>
                    );
                  })}
                  {mode === 'estimate' && (
                    <p className="sm:col-span-2 text-xs text-orange-400 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" /> The internal estimate includes your profit and expense breakdown. Don't send it to the artist.
                    </p>
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={copySelf}
                  onChange={(e) => setCopySelf(e.target.checked)}
                  className="w-4 h-4 text-[#8FD3FF] bg-[#22262F] border-gray-700 rounded focus:ring-2 focus:ring-[#8FD3FF]"
                />
                <span className="font-medium">Send me a copy</span>
              </label>
            </div>

            {error && (
              <div className="rounded-xl border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-300 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="bg-[#8FD3FF] hover:bg-[#6FB8F2] disabled:opacity-50 disabled:cursor-not-allowed text-[#04214D] px-5 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Sending…' : 'Send email'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
