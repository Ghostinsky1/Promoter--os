import { ReactNode, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';

/**
 * The strip at the top of the create / edit wizard.
 *
 * It used to be six 56px circles with numbers in them, a label under each, a
 * progress bar, and a template banner -- 260px of a phone screen before the
 * form started. Now it is two short rows: what step you're on and the way out,
 * then the six steps as a row of pills where only the one you're on is lit.
 */
export interface WizardStep {
  number: number;
  label: string;
}

export function WizardHeader({
  title,
  steps,
  current,
  onStep,
  onClose,
  actions,
  note,
}: {
  /** "Edit Offer", or nothing on create. */
  title?: string;
  steps: WizardStep[];
  current: number;
  onStep: (n: number) => void;
  onClose: () => void;
  /** Buttons that sit beside the close: the template picker, say. */
  actions?: ReactNode;
  /** One thin line under the steps: "Started from X template". */
  note?: ReactNode;
}) {
  const stepLabel = steps[current - 1]?.label ?? '';
  const rowRef = useRef<HTMLDivElement>(null);

  // On a phone the row scrolls; keep the lit step in view.
  useEffect(() => {
    const el = rowRef.current?.querySelector<HTMLElement>(`[data-step="${current}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [current]);

  return (
    <div className="sticky top-16 z-40 bg-[#0B0D12]/95 backdrop-blur-lg border-b border-gray-800">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Row 1: where you are, and the way out */}
        <div className="flex items-center justify-between gap-3 h-12">
          <div className="min-w-0 flex items-baseline gap-2">
            {title && <span className="text-sm font-bold text-white truncate">{title}</span>}
            <span className="text-[11px] text-gray-500 whitespace-nowrap">
              Step {current} of {steps.length}
            </span>
            <span className="text-sm font-semibold text-[#8FD3FF] truncate">{stepLabel}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {actions}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#22262F] transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Row 2: the steps. Only the current one is lit. */}
        <div
          ref={rowRef}
          className="flex gap-1 pb-2 -mx-1 px-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {steps.map((s) => {
            const done = s.number < current;
            const active = s.number === current;
            return (
              <button
                key={s.number}
                data-step={s.number}
                onClick={() => onStep(s.number)}
                // The app's global button style uppercases and letter-spaces
                // everything; six of those in one row overlap on a phone.
                style={{ textTransform: 'none', letterSpacing: 0 }}
                className={`shrink-0 sm:flex-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center justify-center gap-1 ${
                  active
                    ? 'bg-[#8FD3FF] text-[#04214D] font-bold'
                    : done
                    ? 'text-[#8FD3FF]/70 hover:bg-[#8FD3FF]/10'
                    : 'text-gray-600 hover:text-gray-400 hover:bg-[#22262F]'
                }`}
              >
                {done && <Check className="h-3 w-3" />}
                {s.label}
              </button>
            );
          })}
        </div>

        {note && <div className="pb-2">{note}</div>}
      </div>

      {/* A hairline of progress, not a bar. */}
      <div className="h-0.5 bg-[#22262F]">
        <div
          className="h-full bg-[#8FD3FF] transition-all duration-300"
          style={{ width: `${(current / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
