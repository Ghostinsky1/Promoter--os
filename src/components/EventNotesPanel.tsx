import { useState } from 'react';
import { FileText, Pin, Plus, X } from 'lucide-react';
import type { OfferNotes, PinnedNote } from '../types';

interface EventNotesPanelProps {
  notes: OfferNotes | null;
  onUpdateNotes: (text: string) => Promise<void>;
  onAddPin: (text: string) => Promise<void>;
  onRemovePin: (id: string) => Promise<void>;
}

export function EventNotesPanel({ notes, onUpdateNotes, onAddPin, onRemovePin }: EventNotesPanelProps) {
  const [newPin, setNewPin] = useState('');
  const [addingPin, setAddingPin] = useState(false);

  const pinnedNotes: PinnedNote[] = notes?.pinned_notes || [];

  const handleAddPin = async () => {
    if (!newPin.trim()) return;
    await onAddPin(newPin.trim());
    setNewPin('');
    setAddingPin(false);
  };

  return (
    <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-[#8FD3FF]" />
        <h2 className="text-base font-bold text-white">Event Notes</h2>
      </div>

      {/* Long-form Notes */}
      <textarea
        value={notes?.event_notes || ''}
        onChange={e => onUpdateNotes(e.target.value)}
        placeholder="Add event notes, reminders, context..."
        rows={5}
        className="w-full bg-[#0B0D12] border border-[#2A3040] rounded-lg px-3 py-2.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-[#8FD3FF]/50 resize-y min-h-[80px] leading-relaxed transition-colors"
      />

      {/* Pinned Notes */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Pin className="w-3 h-3 text-[#8FD3FF]" />
            <span className="text-xs font-semibold text-gray-300">Pinned Notes</span>
            {pinnedNotes.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#22262F] text-gray-500 font-medium">{pinnedNotes.length}</span>
            )}
          </div>
          <button
            onClick={() => setAddingPin(!addingPin)}
            className="text-[10px] text-[#8FD3FF] hover:text-[#6FB8F2] flex items-center gap-0.5 transition-colors"
          >
            <Plus className="w-3 h-3" />Add
          </button>
        </div>

        {addingPin && (
          <div className="flex gap-1.5 mb-2">
            <input
              type="text"
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              placeholder="Quick note..."
              className="flex-1 bg-[#0B0D12] border border-[#2A3040] rounded-md px-2.5 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-[#8FD3FF]/50"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleAddPin(); if (e.key === 'Escape') setAddingPin(false); }}
            />
            <button onClick={handleAddPin} className="px-2.5 py-1.5 bg-[#8FD3FF] text-[#04214D] text-xs font-bold rounded-md hover:bg-[#6FB8F2] transition-colors">Pin</button>
          </div>
        )}

        {pinnedNotes.length === 0 && !addingPin ? (
          <div className="text-center text-gray-600 text-[10px] py-2">No pinned notes</div>
        ) : (
          <div className="space-y-1">
            {pinnedNotes.map(pin => (
              <div key={pin.id} className="group flex items-start gap-2 py-1 px-2 rounded-lg hover:bg-[#22262F]/40 transition-colors">
                <div className="w-1 h-1 rounded-full bg-[#8FD3FF]/50 mt-1.5 flex-shrink-0" />
                <span className="text-xs text-gray-300 flex-1 leading-relaxed">{pin.text}</span>
                <button
                  onClick={() => onRemovePin(pin.id)}
                  className="p-0.5 rounded text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
