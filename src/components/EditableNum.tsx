import { Pencil } from 'lucide-react';
import { toNumber } from '../hooks/useEstimateState';

interface EditableNumProps {
  value: number;
  onChange: (v: number) => void;
  width?: string;
  prefix?: string;
  suffix?: string;
  step?: string;
  size?: 'xs' | 'sm' | 'base';
  align?: 'left' | 'right';
  color?: string;
}

const SIZE_MAP = {
  xs: 'text-xs py-0.5 px-1.5',
  sm: 'text-sm py-0.5 px-2',
  base: 'text-sm py-1 px-2.5',
};

export function EditableNum({
  value,
  onChange,
  width = 'w-20',
  prefix,
  suffix,
  step,
  size = 'xs',
  align = 'right',
  color = 'text-gray-200',
}: EditableNumProps) {
  return (
    <span className="group/edit relative inline-flex items-center gap-0.5">
      {prefix && (
        <span className="text-gray-500 text-[11px] font-medium select-none">{prefix}</span>
      )}
      <span className="relative inline-flex items-center">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(toNumber(e.target.value))}
          step={step}
          className={[
            width,
            SIZE_MAP[size],
            align === 'right' ? 'text-right' : 'text-left',
            color,
            'font-medium',
            'bg-[#0B0D12] border border-[#2A3040] rounded-md',
            'outline-none',
            'hover:bg-[#2A3040] hover:border-[#3A4150]',
            'focus:bg-[#161D1B] focus:border-[#8FD3FF]/50 focus:shadow-[0_0_0_1px_rgba(196,255,13,0.15)]',
            'transition-all duration-150',
            '[appearance:textfield]',
            '[&::-webkit-outer-spin-button]:appearance-none',
            '[&::-webkit-inner-spin-button]:appearance-none',
          ].join(' ')}
        />
        <Pencil className="w-2.5 h-2.5 text-[#8FD3FF]/40 absolute -right-3.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/edit:opacity-100 transition-opacity duration-200 pointer-events-none" />
      </span>
      {suffix && (
        <span className="text-gray-500 text-[11px] font-medium select-none">{suffix}</span>
      )}
    </span>
  );
}
