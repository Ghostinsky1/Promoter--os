import { useState } from 'react';
import {
  ChevronDown, ChevronUp, Copy, Trash2, FileText,
  Plane, Hotel, Car, UtensilsCrossed, DollarSign
} from 'lucide-react';
import { formatCurrency } from '../../lib/calculations';
import { calculateArtistCost } from '../../lib/artistCalculations';
import { ArtistStatusBadge, ArtistProgressBar, getRoleBadge } from './ArtistStatusBadge';
import { ArtistOfferForm } from './ArtistOfferForm';
import type { EventArtist, EventArtistTask, ArtistOfferStatus } from '../../types';

interface ArtistCardProps {
  artist: EventArtist;
  tasks: EventArtistTask[];
  onUpdate: (patch: Partial<EventArtist>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGenerateSheet: () => void;
  onAddTask: (title: string, dueDate?: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<EventArtistTask>) => void;
  onDeleteTask: (taskId: string) => void;
}

function TravelIndicator({ active, icon: Icon, label }: { active: boolean; icon: typeof Plane; label: string }) {
  return (
    <div className={`flex items-center gap-1 text-[10px] ${active ? 'text-[#8FD3FF]' : 'text-gray-600'}`} title={label}>
      <Icon className="w-3 h-3" />
      <span className="hidden sm:inline">{active ? 'Yes' : 'No'}</span>
    </div>
  );
}

export function ArtistCard({
  artist,
  tasks,
  onUpdate,
  onDelete,
  onDuplicate,
  onGenerateSheet,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
}: ArtistCardProps) {
  const [expanded, setExpanded] = useState(false);
  const costs = calculateArtistCost(artist);
  const pendingTasks = tasks.filter(t => !t.completed).length;

  return (
    <div className={`bg-[#14171E] border rounded-2xl transition-all ${
      expanded ? 'border-[#8FD3FF]/30 shadow-lg shadow-[#8FD3FF]/5' : 'border-gray-800 hover:border-gray-700'
    }`}>
      {/* Card Header */}
      <div
        className="p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <h3 className="text-white font-bold text-base truncate">
                {artist.artist_name || 'Unnamed Artist'}
              </h3>
              {getRoleBadge(artist.role)}
              <ArtistStatusBadge
                status={artist.status}
                onChange={status => {
                  onUpdate({ status: status as ArtistOfferStatus });
                }}
              />
              {pendingTasks > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">
                  {pendingTasks} task{pendingTasks > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <ArtistProgressBar status={artist.status} />
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-[10px] text-gray-500 uppercase font-medium">Total Cost</div>
            <div className="text-lg font-bold text-[#8FD3FF]">{formatCurrency(costs.totalCost)}</div>
          </div>
        </div>

        {/* Summary Row */}
        <div className="mt-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-gray-500">Guarantee: </span>
              <span className="text-white font-semibold">{formatCurrency(costs.guarantee)}</span>
            </div>
            {costs.deposit > 0 && (
              <>
                <div>
                  <span className="text-gray-500">Deposit: </span>
                  <span className="text-white font-semibold">{formatCurrency(costs.deposit)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Balance: </span>
                  <span className="text-white font-semibold">{formatCurrency(costs.balance)}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <TravelIndicator active={artist.flight_covered} icon={Plane} label="Flight" />
            <TravelIndicator active={artist.hotel_covered} icon={Hotel} label="Hotel" />
            <TravelIndicator active={artist.ground_transport_covered} icon={Car} label="Transport" />
            <TravelIndicator active={artist.rider_included} icon={UtensilsCrossed} label="Rider" />
            {costs.deposit > 0 && (
              <div className={`flex items-center gap-1 text-[10px] ${
                artist.status === 'deposit_paid' || artist.status === 'fully_paid'
                  ? 'text-green-400' : 'text-amber-400'
              }`}>
                <DollarSign className="w-3 h-3" />
                <span className="hidden sm:inline">
                  {artist.status === 'deposit_paid' || artist.status === 'fully_paid' ? 'Paid' : 'Pending'}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-1 text-gray-500 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Notes Preview */}
        {!expanded && artist.internal_notes && (
          <p className="mt-2 text-[11px] text-gray-500 truncate">{artist.internal_notes}</p>
        )}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-[#2A3040]">
          {/* Action Buttons */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2A3040] bg-[#0B0D12]/50">
            <button
              onClick={e => { e.stopPropagation(); onGenerateSheet(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8FD3FF]/10 border border-[#8FD3FF]/30 text-[#8FD3FF] text-xs font-medium rounded-lg hover:bg-[#8FD3FF]/20 transition-colors"
            >
              <FileText className="w-3 h-3" />
              Generate Offer Sheet
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDuplicate(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#22262F] text-gray-400 text-xs font-medium rounded-lg hover:bg-[#2A3040] hover:text-white transition-colors"
            >
              <Copy className="w-3 h-3" />
              Duplicate
            </button>
            <div className="flex-1" />
            <button
              onClick={e => {
                e.stopPropagation();
                if (confirm(`Remove ${artist.artist_name || 'this artist'} from the event?`)) {
                  onDelete();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 text-xs font-medium rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Remove
            </button>
          </div>

          {/* Cost Summary Bar */}
          <div className="px-4 py-3 bg-[#0B0D12]/30 border-b border-[#2A3040]">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <div className="text-[10px] text-gray-500 uppercase">Guarantee</div>
                <div className="text-sm font-bold text-white">{formatCurrency(costs.guarantee)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase">Travel</div>
                <div className="text-sm font-bold text-white">{formatCurrency(costs.totalTravelCost)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase">Hospitality</div>
                <div className="text-sm font-bold text-white">{formatCurrency(costs.totalHospitalityCost)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase">Deposit</div>
                <div className="text-sm font-bold text-white">{formatCurrency(costs.deposit)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase">Total Cost</div>
                <div className="text-sm font-bold text-[#8FD3FF]">{formatCurrency(costs.totalCost)}</div>
              </div>
            </div>
          </div>

          {/* Full Form */}
          <div className="p-4">
            <ArtistOfferForm
              artist={artist}
              tasks={tasks}
              onUpdate={onUpdate}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
            />
          </div>
        </div>
      )}
    </div>
  );
}
