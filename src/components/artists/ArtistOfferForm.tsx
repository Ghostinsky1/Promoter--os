import { useState } from 'react';
import {
  Plane, Hotel, Car, UtensilsCrossed, Music, Clock, Users,
  Building2, Plus, Trash2, Check, Calendar
} from 'lucide-react';
import { formatCurrency } from '../../lib/calculations';
import type { EventArtist, EventArtistTask, ArtistRole } from '../../types';

interface ArtistOfferFormProps {
  artist: EventArtist;
  tasks: EventArtistTask[];
  onUpdate: (patch: Partial<EventArtist>) => void;
  onAddTask: (title: string, dueDate?: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<EventArtistTask>) => void;
  onDeleteTask: (taskId: string) => void;
}

const ROLES: { value: ArtistRole; label: string }[] = [
  { value: 'headliner', label: 'Headliner' },
  { value: 'direct_support', label: 'Direct Support' },
  { value: 'support', label: 'Support' },
  { value: 'local_opener', label: 'Local Opener' },
];

const inputCls = 'w-full bg-[#141918] border border-[#2A3330] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-[#C4FF0D]/50 transition-colors';
const labelCls = 'text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const toggleActiveCls = 'bg-[#C4FF0D]/15 border-[#C4FF0D]/40 text-[#C4FF0D]';
const toggleInactiveCls = 'bg-[#1A1F1E] border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400';

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Music; children: React.ReactNode }) {
  return (
    <div className="border-t border-[#2A3330] pt-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5 text-[#C4FF0D]" />
        <h4 className="text-xs font-bold text-white uppercase tracking-wide">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, active, onToggle, icon: Icon }: { label: string; active: boolean; onToggle: () => void; icon: typeof Plane }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${active ? toggleActiveCls : toggleInactiveCls}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

export function ArtistOfferForm({ artist, tasks, onUpdate, onAddTask, onUpdateTask, onDeleteTask }: ArtistOfferFormProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    onAddTask(newTaskTitle.trim(), newTaskDate || undefined);
    setNewTaskTitle('');
    setNewTaskDate('');
    setAddingTask(false);
  };

  const depositAmount = artist.deposit_type === 'percentage'
    ? (artist.guarantee || 0) * ((artist.deposit_percentage || 0) / 100)
    : (artist.deposit_amount || 0);
  const balanceDue = Math.max((artist.guarantee || 0) - depositAmount, 0);

  return (
    <div className="space-y-4 px-1">
      {/* Basic Info + Contact */}
      <Section title="Basic Info & Contact" icon={Building2}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className={labelCls}>Artist Name</div>
            <input
              className={inputCls}
              value={artist.artist_name}
              onChange={e => onUpdate({ artist_name: e.target.value })}
              placeholder="Artist name"
            />
          </div>
          <div>
            <div className={labelCls}>Role</div>
            <select
              className={inputCls}
              value={artist.role}
              onChange={e => onUpdate({ role: e.target.value as ArtistRole })}
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <div className={labelCls}>Agency / Contact Name</div>
            <input
              className={inputCls}
              value={artist.agency}
              onChange={e => onUpdate({ agency: e.target.value })}
              placeholder="Agency or contact name"
            />
          </div>
          <div>
            <div className={labelCls}>Contact Email</div>
            <input
              className={inputCls}
              type="email"
              value={artist.contact_email}
              onChange={e => onUpdate({ contact_email: e.target.value })}
              placeholder="email@agency.com"
            />
          </div>
          <div>
            <div className={labelCls}>Contact Phone</div>
            <input
              className={inputCls}
              value={artist.contact_phone}
              onChange={e => onUpdate({ contact_phone: e.target.value })}
              placeholder="(555) 000-0000"
            />
          </div>
          <div>
            <div className={labelCls}>Contact Name</div>
            <input
              className={inputCls}
              value={artist.contact_name}
              onChange={e => onUpdate({ contact_name: e.target.value })}
              placeholder="Agent name"
            />
          </div>
        </div>
      </Section>

      {/* Payment */}
      <Section title="Payment" icon={Music}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className={labelCls}>Guarantee</div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input
                className={`${inputCls} pl-7`}
                type="number"
                value={artist.guarantee || ''}
                onChange={e => onUpdate({ guarantee: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <div className={labelCls}>Deposit Type</div>
            <select
              className={inputCls}
              value={artist.deposit_type}
              onChange={e => onUpdate({ deposit_type: e.target.value as 'percentage' | 'fixed' })}
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Flat Amount</option>
            </select>
          </div>
          {artist.deposit_type === 'percentage' ? (
            <div>
              <div className={labelCls}>Deposit %</div>
              <div className="relative">
                <input
                  className={inputCls}
                  type="number"
                  value={artist.deposit_percentage || ''}
                  onChange={e => onUpdate({ deposit_percentage: parseFloat(e.target.value) || 0 })}
                  placeholder="50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
              </div>
            </div>
          ) : (
            <div>
              <div className={labelCls}>Deposit Amount</div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  className={`${inputCls} pl-7`}
                  type="number"
                  value={artist.deposit_amount || ''}
                  onChange={e => onUpdate({ deposit_amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 bg-[#252A29] rounded-lg p-3 grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] text-gray-500 uppercase">Deposit</div>
            <div className="text-sm font-bold text-white">{formatCurrency(depositAmount)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase">Balance Due</div>
            <div className="text-sm font-bold text-white">{formatCurrency(balanceDue)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase">Total</div>
            <div className="text-sm font-bold text-[#C4FF0D]">{formatCurrency(artist.guarantee || 0)}</div>
          </div>
        </div>

        <div className="mt-3">
          <div className={labelCls}>Payment Notes</div>
          <textarea
            className={`${inputCls} min-h-[60px] resize-y`}
            value={artist.payment_notes}
            onChange={e => onUpdate({ payment_notes: e.target.value })}
            placeholder="Payment terms, wire info, etc."
            rows={2}
          />
        </div>
      </Section>

      {/* Travel */}
      <Section title="Travel" icon={Plane}>
        <div className="flex flex-wrap gap-2 mb-3">
          <Toggle label="Flight" active={artist.flight_covered} onToggle={() => onUpdate({ flight_covered: !artist.flight_covered })} icon={Plane} />
          <Toggle label="Hotel" active={artist.hotel_covered} onToggle={() => onUpdate({ hotel_covered: !artist.hotel_covered })} icon={Hotel} />
          <Toggle label="Ground Transport" active={artist.ground_transport_covered} onToggle={() => onUpdate({ ground_transport_covered: !artist.ground_transport_covered })} icon={Car} />
          <Toggle
            label="Airport Pickup"
            active={artist.airport_pickup}
            onToggle={() => onUpdate({ airport_pickup: !artist.airport_pickup })}
            icon={Car}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {artist.flight_covered && (
            <div>
              <div className={labelCls}>Flight Budget</div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  className={`${inputCls} pl-7`}
                  type="number"
                  value={artist.flight_budget || ''}
                  onChange={e => onUpdate({ flight_budget: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}
          {artist.hotel_covered && (
            <>
              <div>
                <div className={labelCls}>Hotel Budget / Night</div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    className={`${inputCls} pl-7`}
                    type="number"
                    value={artist.hotel_budget || ''}
                    onChange={e => onUpdate({ hotel_budget: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <div className={labelCls}>Rooms</div>
                <input
                  className={inputCls}
                  type="number"
                  value={artist.hotel_rooms || ''}
                  onChange={e => onUpdate({ hotel_rooms: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <div className={labelCls}>Nights</div>
                <input
                  className={inputCls}
                  type="number"
                  value={artist.hotel_nights || ''}
                  onChange={e => onUpdate({ hotel_nights: parseInt(e.target.value) || 1 })}
                />
              </div>
            </>
          )}
          {artist.ground_transport_covered && (
            <div>
              <div className={labelCls}>Transport Budget</div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  className={`${inputCls} pl-7`}
                  type="number"
                  value={artist.ground_transport_budget || ''}
                  onChange={e => onUpdate({ ground_transport_budget: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-3">
          <div className={labelCls}>Travel Notes</div>
          <textarea
            className={`${inputCls} min-h-[50px] resize-y`}
            value={artist.travel_notes}
            onChange={e => onUpdate({ travel_notes: e.target.value })}
            placeholder="Flight details, arrival times, etc."
            rows={2}
          />
        </div>
      </Section>

      {/* Hospitality */}
      <Section title="Hospitality" icon={UtensilsCrossed}>
        <div className="flex flex-wrap gap-2 mb-3">
          <Toggle label="Artist Rider" active={artist.rider_included} onToggle={() => onUpdate({ rider_included: !artist.rider_included })} icon={UtensilsCrossed} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className={labelCls}>Hospitality Buyout</div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input
                className={`${inputCls} pl-7`}
                type="number"
                value={artist.hospitality_buyout || ''}
                onChange={e => onUpdate({ hospitality_buyout: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <div className={labelCls}>Dinner Buyout</div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input
                className={`${inputCls} pl-7`}
                type="number"
                value={artist.dinner_buyout || ''}
                onChange={e => onUpdate({ dinner_buyout: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <div className={labelCls}>Drink Tickets</div>
            <input
              className={inputCls}
              type="number"
              value={artist.drink_tickets || ''}
              onChange={e => onUpdate({ drink_tickets: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 mt-3">
          <div>
            <div className={labelCls}>Backstage Needs</div>
            <input
              className={inputCls}
              value={artist.backstage_needs}
              onChange={e => onUpdate({ backstage_needs: e.target.value })}
              placeholder="Green room requirements, etc."
            />
          </div>
          <div>
            <div className={labelCls}>Hospitality Notes</div>
            <textarea
              className={`${inputCls} min-h-[50px] resize-y`}
              value={artist.hospitality_notes}
              onChange={e => onUpdate({ hospitality_notes: e.target.value })}
              placeholder="Dietary restrictions, preferences..."
              rows={2}
            />
          </div>
        </div>
      </Section>

      {/* Performance & Other Terms */}
      <Section title="Performance & Other Terms" icon={Clock}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className={labelCls}>Set Length (min)</div>
            <input
              className={inputCls}
              type="number"
              value={artist.set_length || ''}
              onChange={e => onUpdate({ set_length: parseInt(e.target.value) || 0 })}
              placeholder="60"
            />
          </div>
          <div>
            <div className={labelCls}>Performance Time</div>
            <input
              className={inputCls}
              type="time"
              value={artist.performance_time}
              onChange={e => onUpdate({ performance_time: e.target.value })}
            />
          </div>
          <div>
            <div className={labelCls}>Soundcheck Time</div>
            <input
              className={inputCls}
              type="time"
              value={artist.soundcheck_time}
              onChange={e => onUpdate({ soundcheck_time: e.target.value })}
            />
          </div>
          <div>
            <div className={labelCls}>Guest List Spots</div>
            <input
              className={inputCls}
              type="number"
              value={artist.guest_list_spots || ''}
              onChange={e => onUpdate({ guest_list_spots: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
          <div>
            <div className={labelCls}>Merch Cut %</div>
            <div className="relative">
              <input
                className={inputCls}
                type="number"
                value={artist.merch_cut || ''}
                onChange={e => onUpdate({ merch_cut: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
            </div>
          </div>
          <div className="flex items-end">
            <Toggle
              label="Meet & Greet"
              active={artist.meet_and_greet}
              onToggle={() => onUpdate({ meet_and_greet: !artist.meet_and_greet })}
              icon={Users}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 mt-3">
          <div>
            <div className={labelCls}>Special Terms</div>
            <textarea
              className={`${inputCls} min-h-[50px] resize-y`}
              value={artist.special_terms}
              onChange={e => onUpdate({ special_terms: e.target.value })}
              placeholder="Any special contractual terms..."
              rows={2}
            />
          </div>
          <div>
            <div className={labelCls}>Internal Notes</div>
            <textarea
              className={`${inputCls} min-h-[50px] resize-y`}
              value={artist.internal_notes}
              onChange={e => onUpdate({ internal_notes: e.target.value })}
              placeholder="Internal notes, not shared with artist..."
              rows={2}
            />
          </div>
        </div>
      </Section>

      {/* Tasks */}
      <Section title="Follow-up Tasks" icon={Check}>
        <div className="space-y-1">
          {tasks.map(task => (
            <div key={task.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#252A29]/60 transition-colors group">
              <button
                onClick={() => onUpdateTask(task.id, { completed: !task.completed })}
                className={`w-4 h-4 rounded flex-shrink-0 border transition-all flex items-center justify-center ${
                  task.completed
                    ? 'bg-[#C4FF0D]/20 border-[#C4FF0D] text-[#C4FF0D]'
                    : 'border-gray-600 hover:border-gray-400'
                }`}
              >
                {task.completed && <Check className="w-2.5 h-2.5" />}
              </button>
              <span className={`text-xs flex-1 ${task.completed ? 'text-gray-500 line-through' : 'text-white'}`}>
                {task.title}
              </span>
              {task.due_date && (
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  <Calendar className="w-2.5 h-2.5" />
                  {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
              <button
                onClick={() => onDeleteTask(task.id)}
                className="p-0.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {addingTask ? (
          <div className="mt-2 p-3 bg-[#141918] border border-[#2A3330] rounded-lg space-y-2">
            <input
              className={inputCls}
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              placeholder="Task description..."
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); }}
            />
            <div className="flex items-center gap-2">
              <input
                type="date"
                className={`${inputCls} w-auto`}
                value={newTaskDate}
                onChange={e => setNewTaskDate(e.target.value)}
              />
              <div className="flex-1" />
              <button onClick={() => setAddingTask(false)} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
              <button onClick={handleAddTask} className="px-3 py-1 bg-[#C4FF0D] text-black text-xs font-bold rounded-md hover:bg-[#A3D60A]">Add</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingTask(true)}
            className="mt-2 text-xs text-[#C4FF0D] hover:text-[#A3D60A] flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />Add Task
          </button>
        )}
      </Section>
    </div>
  );
}
