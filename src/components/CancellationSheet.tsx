import { useState } from 'react';
import { Plus, Trash2, Save, Loader2, AlertTriangle } from 'lucide-react';
import { OfferWithShow } from '../types';
import { formatCurrency } from '../lib/calculations';
import {
  Cancellation, CancellationLine, cancellationLoss,
  newCancellationLine, prefillCancellation, readCancellation,
} from '../lib/cancellation';

/**
 * What the dead show cost.
 *
 * Shown on a cancelled offer instead of the profit it will never make. Starts
 * pre-filled from what the offer already knows was committed, because retyping
 * the deposit you already entered is how a promoter ends up not filling this
 * in at all.
 */
export function CancellationSheet({
  offer,
  onSave,
}: {
  offer: OfferWithShow;
  onSave: (c: Cancellation) => Promise<void>;
}) {
  const existing = readCancellation(offer);
  const [sheet, setSheet] = useState<Cancellation>(
    existing.completed || existing.lines.length > 0 ? existing : prefillCancellation(offer),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loss = cancellationLoss(sheet);
  const patchLine = (id: string, patch: Partial<CancellationLine>) =>
    setSheet((s) => ({ ...s, lines: s.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ ...sheet, completed: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } finally {
      setSaving(false);
    }
  };

  const numInput =
    'w-24 bg-[#22262F] border border-gray-700 text-white text-sm rounded-lg px-2 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-[#8FD3FF]';

  return (
    <div className="bg-[#14171E] border border-red-800/40 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="h-4 w-4 text-red-400" />
        <h2 className="text-base font-bold text-white">What this cancellation cost you</h2>
      </div>
      <p className="text-[11px] text-gray-500 mb-4">
        The show is dead, so the projected profit is gone. Put in what you actually spent and it
        counts against your month instead of disappearing.
      </p>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-[10px] text-gray-500 px-1">
          <span className="flex-1">What you spent</span>
          <span className="w-24 text-right">Spent</span>
          <span className="w-24 text-right">Got back</span>
          <span className="w-6" />
        </div>

        {sheet.lines.length === 0 && (
          <p className="text-xs text-gray-600 py-3 text-center">
            Nothing listed yet. Add the deposits, ads and anything else you paid out.
          </p>
        )}

        {sheet.lines.map((line) => {
          const net = Math.max(0, (line.amount || 0) - (line.recovered || 0));
          return (
            <div key={line.id}>
              <div className="flex items-center gap-2">
                <input
                  value={line.label}
                  placeholder="What was it?"
                  onChange={(e) => patchLine(line.id, { label: e.target.value })}
                  className="flex-1 min-w-0 bg-[#22262F] border border-gray-700 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#8FD3FF]"
                />
                <input
                  type="number" step="0.01" value={line.amount || ''}
                  placeholder="0"
                  onChange={(e) => patchLine(line.id, { amount: parseFloat(e.target.value) || 0 })}
                  className={numInput}
                />
                <input
                  type="number" step="0.01" value={line.recovered || ''}
                  placeholder="0"
                  onChange={(e) => patchLine(line.id, { recovered: parseFloat(e.target.value) || 0 })}
                  className={numInput}
                />
                <button
                  type="button"
                  onClick={() => setSheet((s) => ({ ...s, lines: s.lines.filter((l) => l.id !== line.id) }))}
                  title="Remove this line"
                  className="w-6 text-gray-600 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {(line.note || net !== (line.amount || 0)) && (
                <div className="flex justify-between pl-2 pr-8 mt-0.5">
                  <span className="text-[10px] text-gray-600">{line.note}</span>
                  {net !== (line.amount || 0) && (
                    <span className="text-[10px] text-gray-500">out {formatCurrency(net)}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setSheet((s) => ({ ...s, lines: [...s.lines, newCancellationLine()] }))}
          className="w-full py-2 border border-dashed border-gray-700 rounded-lg text-[11px] text-gray-500 hover:border-[#8FD3FF] hover:text-[#8FD3FF] transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="h-3 w-3" /> Add a line
        </button>
      </div>

      {/* Refunds. Handing back money you never earned is not a loss -- the fee on it is. */}
      <div className="border-t border-gray-800 pt-3 mb-3">
        <label className="flex items-center gap-2 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sheet.refunds.soldTickets}
            onChange={(e) => setSheet((s) => ({ ...s, refunds: { ...s.refunds, soldTickets: e.target.checked } }))}
            className="accent-[#8FD3FF]"
          />
          <span className="text-xs text-gray-300">Tickets had already sold</span>
        </label>

        {sheet.refunds.soldTickets && (
          <div className="pl-5 space-y-2">
            {([
              ['tickets', 'Tickets refunded', '', 'How many you handed back'],
              ['revenue', 'Ticket money returned', '$', 'Not a loss on its own — you never earned it'],
              ['feesLost', 'Card fees you did NOT get back', '$', 'This part is real money gone'],
            ] as const).map(([key, label, prefix, hint]) => (
              <div key={key}>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-gray-400">{label}</span>
                  <div className="flex items-center gap-1">
                    {prefix && <span className="text-xs text-gray-500">{prefix}</span>}
                    <input
                      type="number" step="0.01"
                      value={(sheet.refunds as any)[key] || ''}
                      placeholder="0"
                      onChange={(e) =>
                        setSheet((s) => ({ ...s, refunds: { ...s.refunds, [key]: parseFloat(e.target.value) || 0 } }))
                      }
                      className={numInput}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-600 mt-0.5">{hint}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <textarea
        value={sheet.notes}
        onChange={(e) => setSheet((s) => ({ ...s, notes: e.target.value }))}
        placeholder="Why it got cancelled, and anything you want to remember next time"
        rows={2}
        className="w-full bg-[#22262F] border border-gray-700 text-white text-xs rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-1 focus:ring-[#8FD3FF]"
      />

      <div className="flex items-center justify-between border-t border-gray-800 pt-3">
        <div>
          <div className="text-[11px] text-gray-500">This cancellation cost you</div>
          <div className="text-2xl font-bold text-red-400">-{formatCurrency(loss)}</div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-[#8FD3FF] hover:bg-[#8FD3FF]/90 disabled:opacity-50 text-[#04214D] font-semibold text-sm rounded-xl flex items-center gap-2 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved' : 'Save the loss'}
        </button>
      </div>
    </div>
  );
}
