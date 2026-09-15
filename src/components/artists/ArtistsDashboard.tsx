import { useState, useMemo } from 'react';
import {
  Users, Plus, DollarSign, Plane, UtensilsCrossed,
  AlertCircle, ArrowUpDown, Filter, ChevronDown
} from 'lucide-react';
import { formatCurrency } from '../../lib/calculations';
import { calculateArtistCost, calculateArtistsSummary } from '../../lib/artistCalculations';
import { ArtistCard } from './ArtistCard';
import { ArtistTemplateModal } from './ArtistTemplateModal';
import type { EventArtist, EventArtistTask, ArtistRole, ArtistOfferStatus } from '../../types';

interface ArtistsDashboardProps {
  artists: EventArtist[];
  artistTasks: Record<string, EventArtistTask[]>;
  onAddArtist: (role?: ArtistRole) => Promise<EventArtist | undefined>;
  onUpdateArtist: (id: string, patch: Partial<EventArtist>) => void;
  onDeleteArtist: (id: string) => void;
  onDuplicateArtist: (id: string) => void;
  onGenerateSheet: (artist: EventArtist) => void;
  onAddTask: (artistId: string, title: string, dueDate?: string) => void;
  onUpdateTask: (taskId: string, artistId: string, patch: Partial<EventArtistTask>) => void;
  onDeleteTask: (taskId: string, artistId: string) => void;
}

type SortKey = 'role' | 'status' | 'cost' | 'name';
type FilterStatus = 'all' | ArtistOfferStatus;
type FilterRole = 'all' | ArtistRole;

const ROLE_ORDER: Record<string, number> = { headliner: 0, direct_support: 1, support: 2, local_opener: 3 };
const STATUS_ORDER: Record<string, number> = {
  draft: 0, sent: 1, negotiating: 2, accepted: 3, contracted: 4, deposit_paid: 5, fully_paid: 6, declined: 7
};

export function ArtistsDashboard({
  artists,
  artistTasks,
  onAddArtist,
  onUpdateArtist,
  onDeleteArtist,
  onDuplicateArtist,
  onGenerateSheet,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
}: ArtistsDashboardProps) {
  const [sortBy, setSortBy] = useState<SortKey>('role');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterRole, setFilterRole] = useState<FilterRole>('all');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [templateModal, setTemplateModal] = useState<{ show: boolean; artistId?: string }>({ show: false });

  const summary = useMemo(() => calculateArtistsSummary(artists), [artists]);

  const filtered = useMemo(() => {
    let list = [...artists];
    if (filterStatus !== 'all') list = list.filter(a => a.status === filterStatus);
    if (filterRole !== 'all') list = list.filter(a => a.role === filterRole);

    list.sort((a, b) => {
      switch (sortBy) {
        case 'role': return (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
        case 'status': return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        case 'cost': return calculateArtistCost(b).totalCost - calculateArtistCost(a).totalCost;
        case 'name': return (a.artist_name || '').localeCompare(b.artist_name || '');
        default: return a.sort_order - b.sort_order;
      }
    });
    return list;
  }, [artists, filterStatus, filterRole, sortBy]);

  const handleAddArtist = async (role: ArtistRole) => {
    setShowAddMenu(false);
    const newArtist = await onAddArtist(role);
    if (newArtist) {
      setTemplateModal({ show: true, artistId: newArtist.id });
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Dashboard */}
      {artists.length > 0 && (
        <div className="bg-[#1A1D1F] border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-[#C4FF0D]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Artist Summary</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#252A29] text-gray-400 font-medium">
              {summary.count} artist{summary.count !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#252A29] rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3 h-3 text-[#C4FF0D]" />
                <span className="text-[10px] text-gray-500 uppercase font-medium">Guarantees</span>
              </div>
              <div className="text-sm font-bold text-white">{formatCurrency(summary.totalGuarantees)}</div>
            </div>
            <div className="bg-[#252A29] rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] text-gray-500 uppercase font-medium">Deposits</span>
              </div>
              <div className="text-sm font-bold text-white">{formatCurrency(summary.totalDeposits)}</div>
            </div>
            <div className="bg-[#252A29] rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] text-gray-500 uppercase font-medium">Balances</span>
              </div>
              <div className="text-sm font-bold text-white">{formatCurrency(summary.totalBalances)}</div>
            </div>
            <div className="bg-[#252A29] rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Plane className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] text-gray-500 uppercase font-medium">Travel</span>
              </div>
              <div className="text-sm font-bold text-white">{formatCurrency(summary.totalTravelCosts)}</div>
            </div>
            <div className="bg-[#252A29] rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <UtensilsCrossed className="w-3 h-3 text-orange-400" />
                <span className="text-[10px] text-gray-500 uppercase font-medium">Hospitality</span>
              </div>
              <div className="text-sm font-bold text-white">{formatCurrency(summary.totalHospitalityCosts)}</div>
            </div>
            <div className="bg-gradient-to-br from-[#C4FF0D]/10 to-[#C4FF0D]/5 border border-[#C4FF0D]/20 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3 h-3 text-[#C4FF0D]" />
                <span className="text-[10px] text-[#C4FF0D]/70 uppercase font-medium">Total</span>
              </div>
              <div className="text-sm font-bold text-[#C4FF0D]">{formatCurrency(summary.totalArtistCosts)}</div>
            </div>
          </div>

          {/* Alerts */}
          {(summary.unpaidDeposits > 0 || summary.missingTravelInfo > 0) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {summary.unpaidDeposits > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1">
                  <AlertCircle className="w-3 h-3" />
                  {summary.unpaidDeposits} unpaid deposit{summary.unpaidDeposits > 1 ? 's' : ''}
                </div>
              )}
              {summary.missingTravelInfo > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-1">
                  <AlertCircle className="w-3 h-3" />
                  {summary.missingTravelInfo} missing travel info
                </div>
              )}
              {summary.mostExpensiveArtist && (
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 bg-gray-500/10 border border-gray-500/20 rounded-lg px-2.5 py-1">
                  Top cost: {summary.mostExpensiveArtist}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#C4FF0D] text-black text-xs font-bold rounded-xl hover:bg-[#A3D60A] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Artist
              <ChevronDown className="w-3 h-3" />
            </button>
            {showAddMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                <div className="absolute top-full mt-1 left-0 bg-[#1A1D1F] border border-gray-800 rounded-xl shadow-xl z-20 py-1 min-w-[180px]">
                  {([
                    { role: 'headliner' as ArtistRole, label: 'Headliner' },
                    { role: 'direct_support' as ArtistRole, label: 'Direct Support' },
                    { role: 'support' as ArtistRole, label: 'Support' },
                    { role: 'local_opener' as ArtistRole, label: 'Local Opener' },
                  ]).map(({ role, label }) => (
                    <button
                      key={role}
                      onClick={() => handleAddArtist(role)}
                      className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-[#252A2E] hover:text-white transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {artists.length > 1 && (
            <>
              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                <Filter className="w-3 h-3" />
              </div>
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value as FilterRole)}
                className="bg-[#1A1D1F] border border-gray-800 rounded-lg px-2 py-1.5 text-[11px] text-gray-400 outline-none focus:border-[#C4FF0D]/50"
              >
                <option value="all">All Roles</option>
                <option value="headliner">Headliner</option>
                <option value="direct_support">Direct Support</option>
                <option value="support">Support</option>
                <option value="local_opener">Local Opener</option>
              </select>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as FilterStatus)}
                className="bg-[#1A1D1F] border border-gray-800 rounded-lg px-2 py-1.5 text-[11px] text-gray-400 outline-none focus:border-[#C4FF0D]/50"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="negotiating">Negotiating</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
                <option value="contracted">Contracted</option>
                <option value="deposit_paid">Deposit Paid</option>
                <option value="fully_paid">Fully Paid</option>
              </select>
            </>
          )}
        </div>

        {artists.length > 1 && (
          <div className="flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3 text-gray-500" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              className="bg-[#1A1D1F] border border-gray-800 rounded-lg px-2 py-1.5 text-[11px] text-gray-400 outline-none focus:border-[#C4FF0D]/50"
            >
              <option value="role">Sort by Role</option>
              <option value="status">Sort by Status</option>
              <option value="cost">Sort by Cost</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
        )}
      </div>

      {/* Artist Cards */}
      {filtered.length === 0 && artists.length === 0 && (
        <div className="bg-[#1A1D1F] border border-gray-800 border-dashed rounded-2xl p-10 text-center">
          <div className="w-14 h-14 bg-[#C4FF0D]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-[#C4FF0D]" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No Artists Yet</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
            Add artists to this event to manage individual offers, track deposits, and calculate total event costs.
          </p>
          <button
            onClick={() => handleAddArtist('headliner')}
            className="px-6 py-2.5 bg-[#C4FF0D] text-black text-sm font-bold rounded-xl hover:bg-[#A3D60A] transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add First Artist
          </button>
        </div>
      )}

      {filtered.length === 0 && artists.length > 0 && (
        <div className="bg-[#1A1D1F] border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-500">No artists match the current filters.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(artist => (
          <ArtistCard
            key={artist.id}
            artist={artist}
            tasks={artistTasks[artist.id] || []}
            onUpdate={patch => onUpdateArtist(artist.id, patch)}
            onDelete={() => onDeleteArtist(artist.id)}
            onDuplicate={() => onDuplicateArtist(artist.id)}
            onGenerateSheet={() => onGenerateSheet(artist)}
            onAddTask={(title, date) => onAddTask(artist.id, title, date)}
            onUpdateTask={(taskId, patch) => onUpdateTask(taskId, artist.id, patch)}
            onDeleteTask={taskId => onDeleteTask(taskId, artist.id)}
          />
        ))}
      </div>

      {/* Template Modal */}
      {templateModal.show && templateModal.artistId && (
        <ArtistTemplateModal
          onApply={(template) => {
            if (templateModal.artistId) {
              onUpdateArtist(templateModal.artistId, template);
            }
            setTemplateModal({ show: false });
          }}
          onSkip={() => setTemplateModal({ show: false })}
        />
      )}
    </div>
  );
}
