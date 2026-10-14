import { useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

/** The small ? on a screen. Opens the part of Help about that screen. */
export function HelpLink({ section, label = 'How this works' }: { section: string; label?: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/help#${section}`)}
      className="inline-flex items-center gap-1.5 text-[12px] text-white/80 hover:text-white bg-[#14171E]/70 border border-[#2A3040] hover:border-[#8FD3FF]/60 rounded-full pl-2 pr-3 py-1"
      style={{ textTransform: 'none', letterSpacing: 0 }}
      title="Open help for this screen"
    >
      <HelpCircle className="w-3.5 h-3.5 text-[#8FD3FF]" /> {label}
    </button>
  );
}
