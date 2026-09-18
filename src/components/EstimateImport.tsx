import { useRef, useState } from 'react';
import { Upload, Loader2, AlertTriangle, Eye, X, Check, ArrowRight } from 'lucide-react';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { formatCurrency } from '../lib/calculations';
import { Expenses } from '../types';

/**
 * PROMOTER OS — build the estimate from the paperwork.
 *
 * Same engine as the settlement importer, pointed at the offer side: a venue's
 * quote, an agent's offer, a rider, or last time's settlement used as the
 * projection for the next one.
 *
 * Jose asked for replace-matching-and-add-the-rest. Replacing overwrites
 * numbers he typed by hand, so the review screen shows every replacement as
 * old -> new BEFORE it happens. A scan is allowed to change his work; it is not
 * allowed to change it quietly.
 */

interface Line { label: string; amount: number | null; category: string }
interface Tier { type: string; price: number | null; sold: number | null; is_comp: boolean }
interface Flag { field: string; severity: 'check' | 'unreadable' | 'unusual'; note: string }

interface ArtistDeal {
  guarantee?: number | null;
  deposit_pct?: number | null;
  deposit_amount?: number | null;
  artist_percentage?: number | null;
  deal_type?: string | null;
  payment_terms?: string | null;
}

export interface EstimateExtract {
  document_kind: string;
  artist_name?: string | null;
  venue_name?: string | null;
  event_date?: string | null;
  ticket_tiers: Tier[];
  expenses: Line[];
  artist_deal?: ArtistDeal | null;
  flags: Flag[];
}

const KIND_LABEL: Record<string, string> = {
  settlement: 'a past settlement',
  artist_offer: "an agent's offer",
  venue_quote: "a venue's quote",
  rider: 'a rider',
  invoice: 'an invoice',
  contract: 'a contract',
  ticket_report: 'a ticket report',
  unknown: 'something it could not place',
};

/** Which expense category a scanned line lands in. */
const BUCKET: Record<string, keyof Expenses> = {
  venue: 'general', staffing: 'general', hospitality: 'general', other: 'general',
  production: 'production', marketing: 'marketing', travel: 'talent',
};

const keyOf = (label: string) => label.toLowerCase().trim().replace(/\s+/g, '_');

export interface EstimatePlanRow {
  category: keyof Expenses;
  key: string;
  label: string;
  amount: number;
  /** The value already on the estimate, when this replaces one. */
  existing: number | null;
}

/** What applying this document would do, worked out before anything is applied. */
export function planFor(extract: EstimateExtract, expenses: Expenses): EstimatePlanRow[] {
  const rows: EstimatePlanRow[] = [];
  for (const line of extract.expenses || []) {
    if (!line.label) continue;
    const category = BUCKET[line.category] ?? 'general';
    const key = keyOf(line.label);
    const current = (expenses as any)?.[category]?.[key];
    rows.push({
      category,
      key,
      label: line.label,
      amount: Number.isFinite(Number(line.amount)) ? Number(line.amount) : 0,
      existing: typeof current === 'number' ? current : null,
    });
  }
  return rows;
}

export function EstimateImport({
  offerId,
  organizationId,
  expenses,
  onApply,
}: {
  offerId: string;
  organizationId: string;
  expenses: Expenses;
  onApply: (rows: EstimatePlanRow[], deal: ArtistDeal | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [extract, setExtract] = useState<EstimateExtract | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [takeDeal, setTakeDeal] = useState(true);
  const [showDoc, setShowDoc] = useState(true);

  const reset = () => {
    setExtract(null); setError(null); setUpgrade(false); setCost(null);
    setFileUrl(null); setFileName(''); setSkipped(new Set()); setTakeDeal(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    setError(null); setUpgrade(false); setExtract(null);
    if (file.size > 25 * 1024 * 1024) {
      setError('That file is over 25MB. Export it smaller or photograph fewer pages.');
      return;
    }
    try {
      setBusy('Uploading');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in first.');

      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${organizationId}/${offerId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from('imports')
        .upload(path, file, { contentType: file.type || 'application/pdf', upsert: false });
      if (upErr) throw upErr;

      const { data: row, error: rowErr } = await supabase.from('document_imports').insert({
        organization_id: organizationId,
        user_id: user.id,
        offer_id: offerId,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        kind: 'estimate_source',
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
        headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ import_id: row.id }),
      });
      const payload = await res.json();
      if (!res.ok) {
        if (payload?.upgrade) setUpgrade(true);
        throw new Error(payload?.error || 'The document could not be read.');
      }
      setExtract(payload.extracted as EstimateExtract);
      setCost(typeof payload.cost_usd === 'number' ? payload.cost_usd : null);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  if (!extract) {
    return (
      <div className="bg-[#0B0D12] border border-gray-700 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-1">Build this from a document</h3>
        <p className="text-[11px] text-gray-500 mb-4">
          A venue's quote, an agent's offer, a rider, or last time's settlement. It reads the numbers
          and shows you exactly what it would change before it changes anything.
        </p>

        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        <button
          type="button"
          disabled={!!busy}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && !busy) handleFile(f); }}
          className="w-full py-8 border-2 border-dashed border-gray-700 rounded-xl text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] hover:bg-[#8FD3FF]/5 transition-colors flex flex-col items-center gap-2 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          <span className="text-sm font-medium">{busy ? `${busy}…` : 'Drop a document here, or click to choose'}</span>
          <span className="text-[11px] text-gray-600">{busy ? 'About 15 seconds' : 'PDF or photo · up to 25MB · about 3¢ a scan'}</span>
        </button>

        {error && (
          <div className="mt-4 bg-red-900/20 border border-red-800/40 rounded-xl p-3">
            <p className="text-xs text-red-300">{error}</p>
            {upgrade && <p className="text-[11px] text-gray-400 mt-1">Scanning is on the Pro and Agency Scale plans.</p>}
          </div>
        )}
      </div>
    );
  }

  const plan = planFor(extract, expenses);
  const replacing = plan.filter((r) => r.existing !== null && r.existing !== r.amount);
  const adding = plan.filter((r) => r.existing === null);
  const unchanged = plan.filter((r) => r.existing !== null && r.existing === r.amount);
  const deal = extract.artist_deal || null;
  const hasDeal = !!deal && Object.values(deal).some((v) => v !== null && v !== undefined && v !== '');

  const toggle = (k: string) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const rowKey = (r: EstimatePlanRow) => `${r.category}.${r.key}`;
  const chosen = plan.filter((r) => !skipped.has(rowKey(r)));

  const Row = ({ r }: { r: EstimatePlanRow }) => {
    const k = rowKey(r);
    const off = skipped.has(k);
    return (
      <label className={`flex items-center gap-2 py-1.5 cursor-pointer ${off ? 'opacity-40' : ''}`}>
        <input type="checkbox" checked={!off} onChange={() => toggle(k)} className="accent-[#8FD3FF]" />
        <span className="flex-1 min-w-0 text-xs text-gray-300 truncate">{r.label}</span>
        <span className="text-[10px] text-gray-600 w-16 text-right">{r.category}</span>
        {r.existing !== null && r.existing !== r.amount ? (
          <span className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 line-through">{formatCurrency(r.existing)}</span>
            <ArrowRight className="h-3 w-3 text-gray-600" />
            <span className="text-white font-semibold w-20 text-right">{formatCurrency(r.amount)}</span>
          </span>
        ) : (
          <span className="text-xs text-white font-semibold w-20 text-right">{formatCurrency(r.amount)}</span>
        )}
      </label>
    );
  };

  return (
    <div className="bg-[#0B0D12] border border-[#8FD3FF]/30 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-bold text-white">
            Read {KIND_LABEL[extract.document_kind] || 'that document'}
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            From {fileName}. Nothing has changed yet — untick anything you don't want.
          </p>
        </div>
        <button onClick={reset} className="text-gray-500 hover:text-white"><X className="h-4 w-4" /></button>
      </div>

      {extract.flags?.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {extract.flags.map((f, i) => (
            <div key={i} className="flex items-start gap-2 bg-amber-900/15 border border-amber-800/30 rounded-lg px-2.5 py-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-300">{f.note}</p>
            </div>
          ))}
        </div>
      )}

      {fileUrl && (
        <>
          <button onClick={() => setShowDoc(!showDoc)} className="mt-3 text-[11px] text-gray-400 hover:text-[#8FD3FF] flex items-center gap-1">
            <Eye className="h-3 w-3" /> {showDoc ? 'Hide' : 'Show'} the document
          </button>
          {showDoc && <iframe src={fileUrl} title="Uploaded document" className="mt-2 w-full h-64 rounded-xl border border-gray-800 bg-white" />}
        </>
      )}

      {hasDeal && (
        <div className="mt-4 border-t border-gray-800 pt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={takeDeal} onChange={(e) => setTakeDeal(e.target.checked)} className="accent-[#8FD3FF]" />
            <span className="text-xs font-semibold text-white">Artist deal from this document</span>
          </label>
          <div className="pl-6 mt-1 space-y-0.5 text-[11px] text-gray-400">
            {deal!.guarantee != null && <p>Guarantee {formatCurrency(deal!.guarantee)}</p>}
            {deal!.deposit_pct != null && <p>Deposit {deal!.deposit_pct}%</p>}
            {deal!.deposit_amount != null && deal!.deposit_pct == null && <p>Deposit {formatCurrency(deal!.deposit_amount)}</p>}
            {deal!.artist_percentage != null && <p>Artist share {deal!.artist_percentage}%</p>}
            {deal!.payment_terms && <p className="text-gray-500">{deal!.payment_terms}</p>}
          </div>
        </div>
      )}

      {replacing.length > 0 && (
        <div className="mt-4 border-t border-gray-800 pt-3">
          <p className="text-[11px] font-bold text-amber-400 mb-1">
            Replaces {replacing.length} line{replacing.length === 1 ? '' : 's'} you already have
          </p>
          {replacing.map((r) => <Row key={rowKey(r)} r={r} />)}
        </div>
      )}

      {adding.length > 0 && (
        <div className="mt-4 border-t border-gray-800 pt-3">
          <p className="text-[11px] font-bold text-gray-400 mb-1">Adds {adding.length} new line{adding.length === 1 ? '' : 's'}</p>
          {adding.map((r) => <Row key={rowKey(r)} r={r} />)}
        </div>
      )}

      {unchanged.length > 0 && (
        <p className="mt-3 text-[11px] text-gray-600">
          {unchanged.length} line{unchanged.length === 1 ? '' : 's'} already match the document. Nothing to do there.
        </p>
      )}

      {plan.length === 0 && !hasDeal && (
        <p className="mt-4 text-xs text-gray-500">
          Nothing usable came out of that document. Check it is the right file, or type the numbers in.
        </p>
      )}

      <div className="mt-5 pt-3 border-t border-gray-800 flex items-center justify-between">
        <span className="text-[11px] text-gray-600">
          {cost != null ? `Scan cost ${cost < 0.01 ? 'under a cent' : `${(cost * 100).toFixed(1)}¢`}.` : ''}
        </span>
        <div className="flex gap-2">
          <button onClick={reset} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg">
            Throw it away
          </button>
          <button
            onClick={() => { onApply(chosen, hasDeal && takeDeal ? deal : null); reset(); }}
            disabled={chosen.length === 0 && !(hasDeal && takeDeal)}
            className="px-4 py-1.5 bg-[#8FD3FF] hover:bg-[#8FD3FF]/90 disabled:opacity-40 text-[#04214D] font-semibold text-xs rounded-lg flex items-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Apply {chosen.length > 0 ? `${chosen.length} line${chosen.length === 1 ? '' : 's'}` : 'the deal'}
          </button>
        </div>
      </div>
    </div>
  );
}
