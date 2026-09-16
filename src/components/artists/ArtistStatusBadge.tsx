import { FileText, Send, MessageSquare, CheckCircle, CheckCircle2, XCircle, FileCheck, DollarSign, CreditCard, HelpCircle } from 'lucide-react';
import type { ArtistOfferStatus } from '../../types';

type StatusConfig = {
  label: string;
  icon: typeof FileText;
  color: string;
  bg: string;
  border: string;
  step: number;
};

const STATUS_CONFIG: Record<ArtistOfferStatus, StatusConfig> = {
  draft: { label: 'Draft', icon: FileText, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30', step: 0 },
  sent: { label: 'Sent', icon: Send, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', step: 1 },
  negotiating: { label: 'Negotiating', icon: MessageSquare, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', step: 2 },
  accepted: { label: 'Accepted', icon: CheckCircle, color: 'text-[#8FD3FF]', bg: 'bg-[#8FD3FF]/10', border: 'border-[#8FD3FF]/30', step: 3 },
  confirmed: { label: 'Confirmed', icon: CheckCircle2, color: 'text-[#8FD3FF]', bg: 'bg-[#8FD3FF]/10', border: 'border-[#8FD3FF]/30', step: 3 },
  declined: { label: 'Declined', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', step: -1 },
  contracted: { label: 'Contracted', icon: FileCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', step: 4 },
  deposit_paid: { label: 'Deposit Paid', icon: DollarSign, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30', step: 5 },
  fully_paid: { label: 'Fully Paid', icon: CreditCard, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', step: 6 },
};

const STATUSES: ArtistOfferStatus[] = ['draft', 'sent', 'negotiating', 'accepted', 'confirmed', 'declined', 'contracted', 'deposit_paid', 'fully_paid'];

/** Never let an unrecognised status crash the page. An artist saved by an older
 *  version, an import, or the AI connector can carry a status this build has
 *  never heard of — show it as-is rather than taking the whole screen down. */
function configFor(status: string): StatusConfig {
  const known = STATUS_CONFIG[status as ArtistOfferStatus];
  if (known) return known;
  const label = String(status || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  return { label, icon: HelpCircle, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30', step: 0 };
}

interface ArtistStatusBadgeProps {
  status: ArtistOfferStatus;
  onChange?: (status: ArtistOfferStatus) => void;
  size?: 'sm' | 'md';
}

export function ArtistStatusBadge({ status, onChange, size = 'sm' }: ArtistStatusBadgeProps) {
  const config = configFor(status);
  const Icon = config.icon;

  if (onChange) {
    return (
      <select
        value={status}
        onChange={e => onChange(e.target.value as ArtistOfferStatus)}
        className={`${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'} rounded-lg font-semibold border ${config.border} ${config.bg} ${config.color} outline-none cursor-pointer`}
      >
        {(STATUSES.includes(status) ? STATUSES : [status, ...STATUSES]).map(s => (
          <option key={s} value={s}>{configFor(s).label}</option>
        ))}
      </select>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'} rounded-lg font-semibold border ${config.border} ${config.bg} ${config.color}`}>
      <Icon className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {config.label}
    </span>
  );
}

interface ArtistProgressBarProps {
  status: ArtistOfferStatus;
}

export function ArtistProgressBar({ status }: ArtistProgressBarProps) {
  const step = configFor(status).step;
  const maxSteps = 6;
  const progress = step < 0 ? 0 : (step / maxSteps) * 100;

  return (
    <div className="w-full">
      <div className="w-full bg-[#22262F] rounded-full h-1 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            step < 0 ? 'bg-red-500' : 'bg-[#8FD3FF]'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function getRoleBadge(role: string) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    headliner: { label: 'Headliner', color: 'text-[#8FD3FF]', bg: 'bg-[#8FD3FF]/10' },
    direct_support: { label: 'Direct Support', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    support: { label: 'Support', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    local_opener: { label: 'Local Opener', color: 'text-gray-400', bg: 'bg-gray-500/10' },
    // the AI connector and older imports use these spellings
    opener: { label: 'Opener', color: 'text-gray-400', bg: 'bg-gray-500/10' },
    special_guest: { label: 'Special Guest', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  };
  const c = config[role] || config.support;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${c.color} ${c.bg}`}>
      {c.label}
    </span>
  );
}
