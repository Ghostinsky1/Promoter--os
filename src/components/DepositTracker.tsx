import { useState } from 'react';
import { DollarSign, Plus, Trash2, StickyNote, Check, Clock, Wallet } from 'lucide-react';
import { formatCurrency } from '../lib/calculations';
import type { OfferDeposit } from '../types';

interface DepositTrackerProps {
  deposits: OfferDeposit[];
  depositsPaidTotal: number;
  depositsDueTotal: number;
  artistDepositAmount?: number;
  artistDepositDueDate?: string;
  onAdd: (deposit: Partial<OfferDeposit>) => Promise<OfferDeposit | undefined>;
  onUpdate: (id: string, patch: Partial<OfferDeposit>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const RELATED_TYPES: { value: OfferDeposit['related_type']; label: string }[] = [
  { value: 'artist', label: 'Artist' },
  { value: 'venue', label: 'Venue' },
  { value: 'expense', label: 'Expense' },
  { value: 'other', label: 'Other' },
];

const METHODS = ['Check', 'Wire', 'ACH', 'Credit Card', 'Cash', 'Other'];

export function DepositTracker({
  deposits,
  depositsPaidTotal,
  depositsDueTotal,
  artistDepositAmount,
  artistDepositDueDate,
  onAdd,
  onUpdate,
  onDelete,
}: DepositTrackerProps) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<OfferDeposit['related_type']>('other');
  const [newDueDate, setNewDueDate] = useState('');
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<{ id: string; text: string } | null>(null);

  const hasArtistDeposit = deposits.some(d => d.related_type === 'artist' && d.label.toLowerCase().includes('artist'));
  const showArtistSuggestion = artistDepositAmount && artistDepositAmount > 0 && !hasArtistDeposit;

  const handleAdd = async () => {
    if (!newLabel.trim() || !newAmount) return;
    await onAdd({
      label: newLabel.trim(),
      amount: parseFloat(newAmount) || 0,
      related_type: newType,
      due_date: newDueDate || undefined,
      paid: false,
    });
    setNewLabel('');
    setNewAmount('');
    setNewType('other');
    setNewDueDate('');
    setAdding(false);
  };

  const handleCreateFromArtist = async () => {
    if (!artistDepositAmount) return;
    await onAdd({
      label: 'Artist Guarantee Deposit',
      amount: artistDepositAmount,
      related_type: 'artist',
      due_date: artistDepositDueDate || undefined,
      paid: false,
    });
  };

  const togglePaid = (dep: OfferDeposit) => {
    onUpdate(dep.id, {
      paid: !dep.paid,
      paid_date: !dep.paid ? new Date().toISOString().split('T')[0] : undefined,
    });
  };

  const saveNote = (id: string) => {
    if (!editingNote) return;
    onUpdate(id, { note: editingNote.text });
    setEditingNote(null);
  };

  return (
    <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#8FD3FF]" />
          <h2 className="text-base font-bold text-white">Deposits</h2>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="text-xs text-[#8FD3FF] hover:text-[#6FB8F2] flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />Add
        </button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-green-900/15 border border-green-800/25 rounded-lg p-2.5">
          <div className="text-[10px] text-green-400/70 uppercase tracking-wide font-medium">Paid</div>
          <div className="text-sm font-bold text-green-400">{formatCurrency(depositsPaidTotal)}</div>
        </div>
        <div className="bg-yellow-900/15 border border-yellow-800/25 rounded-lg p-2.5">
          <div className="text-[10px] text-yellow-400/70 uppercase tracking-wide font-medium">Due</div>
          <div className="text-sm font-bold text-yellow-400">{formatCurrency(depositsDueTotal)}</div>
        </div>
      </div>

      {/* Artist Deposit Suggestion */}
      {showArtistSuggestion && (
        <button
          onClick={handleCreateFromArtist}
          className="w-full mb-3 p-2.5 border border-dashed border-[#8FD3FF]/30 rounded-lg text-xs text-[#8FD3FF] hover:bg-[#8FD3FF]/5 transition-colors text-left flex items-center gap-2"
        >
          <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Create deposit from artist deal ({formatCurrency(artistDepositAmount)})</span>
        </button>
      )}

      {/* Add Inline Row */}
      {adding && (
        <div className="mb-3 p-3 bg-[#0B0D12] border border-[#2A3040] rounded-lg space-y-2">
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Deposit label..."
            className="w-full bg-[#2A3040] border border-[#2A3040] rounded-md px-2.5 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-[#8FD3FF]/50"
            autoFocus
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              placeholder="Amount"
              className="bg-[#2A3040] border border-[#2A3040] rounded-md px-2.5 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-[#8FD3FF]/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <select
              value={newType}
              onChange={e => setNewType(e.target.value as OfferDeposit['related_type'])}
              className="bg-[#2A3040] border border-[#2A3040] rounded-md px-2 py-1.5 text-xs text-gray-300 outline-none focus:border-[#8FD3FF]/50"
            >
              {RELATED_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              type="date"
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)}
              className="bg-[#2A3040] border border-[#2A3040] rounded-md px-2 py-1.5 text-xs text-gray-300 outline-none focus:border-[#8FD3FF]/50"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={handleAdd} className="px-3 py-1 bg-[#8FD3FF] text-[#04214D] text-xs font-bold rounded-md hover:bg-[#6FB8F2] transition-colors">Add</button>
          </div>
        </div>
      )}

      {/* Deposit List */}
      {deposits.length === 0 && !adding ? (
        <div className="text-center text-gray-500 text-xs py-4">No deposits tracked yet</div>
      ) : (
        <div className="space-y-1">
          {deposits.map(dep => (
            <div key={dep.id} className="group">
              <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#22262F]/60 transition-colors">
                <button
                  onClick={() => togglePaid(dep)}
                  className={`w-4 h-4 rounded flex-shrink-0 border transition-all flex items-center justify-center ${
                    dep.paid
                      ? 'bg-green-500/20 border-green-500 text-green-400'
                      : 'border-gray-600 hover:border-gray-400'
                  }`}
                >
                  {dep.paid && <Check className="w-2.5 h-2.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-medium truncate ${dep.paid ? 'text-gray-500 line-through' : 'text-white'}`}>{dep.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      dep.related_type === 'artist' ? 'bg-cyan-900/30 text-cyan-400' :
                      dep.related_type === 'venue' ? 'bg-orange-900/30 text-orange-400' :
                      dep.related_type === 'expense' ? 'bg-blue-900/30 text-blue-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>{dep.related_type}</span>
                  </div>
                  {dep.due_date && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5 text-gray-500" />
                      <span className="text-[10px] text-gray-500">{new Date(dep.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  )}
                </div>
                <span className={`text-xs font-bold flex-shrink-0 ${dep.paid ? 'text-green-400' : 'text-white'}`}>
                  {formatCurrency(dep.amount)}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => {
                      if (expandedNote === dep.id) { setExpandedNote(null); setEditingNote(null); }
                      else { setExpandedNote(dep.id); setEditingNote({ id: dep.id, text: dep.note || '' }); }
                    }}
                    className={`p-0.5 rounded hover:bg-[#22262F] transition-colors ${dep.note ? 'text-[#8FD3FF]' : 'text-gray-500'}`}
                  >
                    <StickyNote className="w-3 h-3" />
                  </button>
                  <select
                    value={dep.method || ''}
                    onChange={e => onUpdate(dep.id, { method: e.target.value || undefined })}
                    className="bg-transparent border-none text-[10px] text-gray-500 outline-none w-12 p-0 cursor-pointer"
                  >
                    <option value="">--</option>
                    {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <button onClick={() => onDelete(dep.id)} className="p-0.5 rounded text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {expandedNote === dep.id && editingNote && (
                <div className="ml-6 mb-1 flex gap-1">
                  <input
                    type="text"
                    value={editingNote.text}
                    onChange={e => setEditingNote({ id: dep.id, text: e.target.value })}
                    placeholder="Add a note..."
                    className="flex-1 bg-[#0B0D12] border border-[#2A3040] rounded-md px-2 py-1 text-[10px] text-gray-300 outline-none focus:border-[#8FD3FF]/50"
                    onKeyDown={e => { if (e.key === 'Enter') saveNote(dep.id); }}
                  />
                  <button onClick={() => saveNote(dep.id)} className="px-2 py-1 bg-[#8FD3FF]/20 text-[#8FD3FF] text-[10px] rounded-md hover:bg-[#8FD3FF]/30 transition-colors">Save</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
