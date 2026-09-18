import { useRef, useState } from 'react';
import { Upload, Loader2, AlertTriangle, Eye, FileText, X, Check } from 'lucide-react';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { formatCurrency } from '../lib/calculations';
import { OfferWithShow } from '../types';

/**
 * PROMOTER OS — drop the venue's sheet instead of typing it.
 *
 * The review screen is mandatory and not a formality. A settlement is the
 * record of what a night actually cost; a silent bad parse corrupts it and
 * nobody finds out until the numbers are used for something. So nothing here
 * writes to the settlement until the promoter has looked at every field and
 * pressed the button.
 *
 * Flags follow EXTRACTION.md: they say "check this", never "they are stealing
 * from you". A flag is a question, never a verdict.
 */

interface ExtractedLine { label: string; amount: number | null; category: string }
interface ExtractedTier { type: string; price: number | null; sold: number | null; is_comp: boolean }
interface ExtractedChannel { label: string; gross: number | null; fees: number | null }
interface Flag { field: string; severity: 'check' | 'unreadable' | 'unusual'; note: string }

export interface Extracted {
  document_kind: string;
  event_name?: string | null;
  artist_name?: string | null;
  venue_name?: string | null;
  event_date?: string | null;
  ticket_tiers: ExtractedTier[];
  revenue_channels?: ExtractedChannel[];
  expenses: ExtractedLine[];
  artist_payout?: number | null;
  stated_gross_revenue?: number | null;
  stated_total_expenses?: number | null;
  stated_net_profit?: number | null;
  flags: Flag[];
}

const SEVERITY = {
  check: { label: 'Check this', cls: 'bg-amber-900/20 border-amber-700/40 text-amber-300' },
  unreadable: { label: "Couldn't read", cls: 'bg-gray-800 border-gray-700 text-gray-400' },
  unusual: { label: 'Unusual', cls: 'bg-blue-900/20 border-blue-800/40 text-blue-300' },
} as const;

export function SettlementImport({
  offer,
  organizationId,
  onApply,
}: {
  offer: OfferWithShow;
  organizationId: string;
  /** Hands the approved numbers back to the settlement screen. Nothing is saved here. */
  onApply: (e: Extracted) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const reset = () => {
    setExtracted(null); setError(null); setUpgrade(false); setCost(null);
    setFileUrl(null); setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    setError(null); setUpgrade(false); setExtracted(null);
    if (file.size > 25 * 1024 * 1024) {
      setError('That file is over 25MB. Try exporting it smaller or photographing fewer pages.');
      return;
    }

    try {
      setBusy('Uploading');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in first.');

      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${organizationId}/${offer.id}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from('imports').upload(path, file, {
        contentType: file.type || 'application/pdf',
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: row, error: rowErr } = await supabase.from('document_imports').insert({
        organization_id: organizationId,
        user_id: user.id,
        offer_id: offer.id,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        kind: 'settlement',
        status: 'uploaded',
      }).select().single();
      if (rowErr) throw rowErr;

      const { data: signed } = await supabase.storage.from('imports').createSignedUrl(path, 3600);
      setFileUrl(signed?.signedUrl ?? null);
      setFileName(file.name);

      setBusy('Reading the document');
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/doc-extract`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ import_id: row.id }),
      });
      const payload = await res.json();
      if (!res.ok) {
        if (payload?.upgrade) setUpgrade(true);
        throw new Error(payload?.error || 'The document could not be read.');
      }

      if (payload.kind && payload.kind !== 'settlement') {
        setError(`That looks like ${payload.kind === 'unknown' ? 'something other than a settlement' : `a ${payload.kind.replace('_', ' ')}`}. It has been saved, but only settlements can be filled in automatically for now.`);
      }
      setExtracted(payload.extracted as Extracted);
      setCost(typeof payload.cost_usd === 'number' ? payload.cost_usd : null);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  if (extracted) {
    return (
      <ReviewScreen
        extracted={extracted}
        setExtracted={setExtracted}
        fileUrl={fileUrl}
        fileName={fileName}
        cost={cost}
        onCancel={reset}
        onApply={() => { onApply(extracted); reset(); }}
      />
    );
  }

  return (
    <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-6">
      <h2 className="text-xl font-bold text-white mb-1">Import a settlement</h2>
      <p className="text-[11px] text-gray-500 mb-4">
        Drop the venue's sheet — a PDF, an export, or a photo of the paper they handed you. You see
        every number before anything is saved.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      <button
        type="button"
        disabled={!!busy}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) handleFile(f);
        }}
        className="w-full py-10 border-2 border-dashed border-gray-700 rounded-2xl text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] hover:bg-[#8FD3FF]/5 transition-colors flex flex-col items-center gap-2 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
        <span className="text-sm font-medium">{busy ? `${busy}…` : 'Drop a settlement here, or click to choose'}</span>
        <span className="text-[11px] text-gray-600">
          {busy ? 'This takes about 15 seconds' : 'PDF, photo or screenshot · up to 25MB'}
        </span>
      </button>

      {error && (
        <div className="mt-4 bg-red-900/20 border border-red-800/40 rounded-xl p-4">
          <p className="text-sm text-red-300">{error}</p>
          {upgrade && (
            <p className="text-[11px] text-gray-400 mt-2">
              Scanning documents is on the Pro and Agency Scale plans.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The gate. Document on the left, every field editable on the right, flags
 * attached to what they concern. Nothing reaches the settlement until the
 * promoter presses the button at the bottom.
 */
function ReviewScreen({
  extracted, setExtracted, fileUrl, fileName, cost, onCancel, onApply,
}: {
  extracted: Extracted;
  setExtracted: (e: Extracted) => void;
  fileUrl: string | null;
  fileName: string;
  cost: number | null;
  onCancel: () => void;
  onApply: () => void;
}) {
  const [showDoc, setShowDoc] = useState(true);
  const flags = extracted.flags || [];
  const flagsFor = (field: string) =>
    flags.filter((f) => f.field?.toLowerCase().includes(field.toLowerCase()));

  const expensesTotal = (extracted.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const ticketsRevenue = (extracted.ticket_tiers || [])
    .filter((t) => !t.is_comp)
    .reduce((s, t) => s + (t.price || 0) * (t.sold || 0), 0);

  const patchExpense = (i: number, p: Partial<ExtractedLine>) =>
    setExtracted({ ...extracted, expenses: extracted.expenses.map((e, j) => (j === i ? { ...e, ...p } : e)) });
  const patchTier = (i: number, p: Partial<ExtractedTier>) =>
    setExtracted({ ...extracted, ticket_tiers: extracted.ticket_tiers.map((t, j) => (j === i ? { ...t, ...p } : t)) });

  const numCls = 'w-24 bg-[#14171E] border border-gray-700 text-white text-sm rounded-lg px-2 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-[#8FD3FF]';
  const txtCls = 'flex-1 min-w-0 bg-[#14171E] border border-gray-700 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#8FD3FF]';

  return (
    <div className="bg-[#14171E] border border-[#8FD3FF]/30 rounded-3xl p-6">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-white">Check these numbers before they go in</h2>
          <p className="text-[11px] text-gray-500 mt-1">
            Read from {fileName}. Everything is editable. Nothing is saved until you press the button
            at the bottom.
          </p>
        </div>
        <button onClick={onCancel} className="text-gray-500 hover:text-white" title="Throw this away">
          <X className="h-5 w-5" />
        </button>
      </div>

      {flags.length > 0 ? (
        <div className="mt-4 space-y-2">
          {flags.map((f, i) => (
            <div key={i} className={`rounded-xl border px-3 py-2 ${SEVERITY[f.severity]?.cls ?? SEVERITY.check.cls}`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold tracking-wide uppercase opacity-70">
                    {SEVERITY[f.severity]?.label ?? 'Check this'} · {f.field}
                  </p>
                  <p className="text-xs mt-0.5">{f.note}</p>
                </div>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-gray-600">
            These are questions, not verdicts. Most are arithmetic that needs a second look.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 text-xs text-green-400">
          <Check className="h-4 w-4" /> Nothing needed a second look. Still worth reading the numbers.
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <button
            onClick={() => setShowDoc(!showDoc)}
            className="text-[11px] text-gray-400 hover:text-[#8FD3FF] flex items-center gap-1 mb-2"
          >
            <Eye className="h-3 w-3" /> {showDoc ? 'Hide' : 'Show'} the document
          </button>
          {showDoc && fileUrl && (
            <iframe src={fileUrl} title="Uploaded settlement" className="w-full h-[520px] rounded-xl border border-gray-800 bg-white" />
          )}
          {showDoc && !fileUrl && (
            <div className="w-full h-40 rounded-xl border border-gray-800 flex items-center justify-center text-gray-600 text-xs gap-2">
              <FileText className="h-4 w-4" /> Preview unavailable
            </div>
          )}
        </div>

        <div className="space-y-5">
          <section>
            <h3 className="text-sm font-bold text-white mb-2">Tickets</h3>
            <div className="space-y-2">
              {(extracted.ticket_tiers || []).map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={t.type} onChange={(e) => patchTier(i, { type: e.target.value })} className={txtCls} />
                  <input type="number" step="0.01" value={t.price ?? ''} placeholder="price"
                    onChange={(e) => patchTier(i, { price: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    className={numCls} />
                  <input type="number" value={t.sold ?? ''} placeholder="sold"
                    onChange={(e) => patchTier(i, { sold: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                    className="w-20 bg-[#14171E] border border-gray-700 text-white text-sm rounded-lg px-2 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-[#8FD3FF]" />
                  {t.is_comp && <span className="text-[10px] text-gray-500 w-10">comp</span>}
                </div>
              ))}
              {(extracted.ticket_tiers || []).length === 0 && (
                <p className="text-xs text-gray-600">No ticket rows found. Type them in on the settlement.</p>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              Paid tickets add to {formatCurrency(ticketsRevenue)}
              {extracted.stated_gross_revenue != null && (
                <>; the document states {formatCurrency(extracted.stated_gross_revenue)}</>
              )}
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-white mb-2">Expenses</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {(extracted.expenses || []).map((e, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2">
                    <input value={e.label} onChange={(ev) => patchExpense(i, { label: ev.target.value })} className={txtCls} />
                    <input type="number" step="0.01" value={e.amount ?? ''} placeholder="0"
                      onChange={(ev) => patchExpense(i, { amount: ev.target.value === '' ? null : parseFloat(ev.target.value) })}
                      className={numCls} />
                    <button
                      onClick={() => setExtracted({ ...extracted, expenses: extracted.expenses.filter((_, j) => j !== i) })}
                      className="w-5 text-gray-600 hover:text-red-400 text-xs"
                      title="Drop this line"
                    >×</button>
                  </div>
                  {flagsFor(e.label).map((f, k) => (
                    <p key={k} className="text-[10px] text-amber-400 pl-1 mt-0.5">{f.note}</p>
                  ))}
                </div>
              ))}
              {(extracted.expenses || []).length === 0 && (
                <p className="text-xs text-gray-600">No expense lines found.</p>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              Lines add to {formatCurrency(expensesTotal)}
              {extracted.stated_total_expenses != null && (
                <>; the document states {formatCurrency(extracted.stated_total_expenses)}</>
              )}
            </p>
          </section>

          {extracted.artist_payout != null && (
            <section>
              <h3 className="text-sm font-bold text-white mb-2">Artist</h3>
              <div className="flex items-center gap-2">
                <span className={txtCls + ' bg-transparent border-transparent px-0'}>Paid to the artist</span>
                <input type="number" step="0.01" value={extracted.artist_payout ?? ''}
                  onChange={(e) => setExtracted({ ...extracted, artist_payout: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  className={numCls} />
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between">
        <span className="text-[11px] text-gray-600">
          {cost != null ? `This scan cost ${cost < 0.01 ? 'under a cent' : `${(cost * 100).toFixed(1)}¢`}.` : ''}
        </span>
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl">
            Throw it away
          </button>
          <button onClick={onApply} className="px-5 py-2 bg-[#8FD3FF] hover:bg-[#8FD3FF]/90 text-[#04214D] font-semibold text-sm rounded-xl">
            Put these into the settlement
          </button>
        </div>
      </div>
    </div>
  );
}
