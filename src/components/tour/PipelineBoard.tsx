import { useState } from 'react';
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, DragOverlay, type DragEndEvent } from '@dnd-kit/core';
import { CalendarDays, FileText, Plus } from 'lucide-react';
import { parseLocalDate } from '../../lib/dateHelpers';
import { STAGES, STAGE, short$, type Card, type Stage } from '../../lib/tourPipeline';

/**
 * The pipeline as columns. Drag a card to move it; the page decides what a move means
 * (a lead just changes stage; a card with an offer changes the offer's status).
 */
export function PipelineBoard({ cards, selectedKey, onOpen, onMove, onAdd }: {
  cards: Card[]; selectedKey: string | null;
  onOpen: (c: Card) => void; onMove: (c: Card, to: Stage) => void; onAdd: (stage: Stage) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );
  const [dragging, setDragging] = useState<Card | null>(null);
  const [showDead, setShowDead] = useState(false);
  const live = STAGES.filter((s) => s.key !== 'dead');
  const dead = cards.filter((c) => c.stage === 'dead');

  const end = (e: DragEndEvent) => {
    setDragging(null);
    const c = cards.find((x) => x.key === e.active.id);
    const to = e.over?.id as Stage | undefined;
    if (c && to && to !== c.stage) onMove(c, to);
  };

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragging(cards.find((c) => c.key === e.active.id) ?? null)} onDragEnd={end} onDragCancel={() => setDragging(null)}>
      <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 snap-x" style={{ scrollbarWidth: 'thin' }}>
        {live.map((s) => {
          const list = cards.filter((c) => c.stage === s.key).sort(byDate);
          const sum = list.reduce((t, c) => t + (c.money ?? 0), 0);
          return (
            <Column key={s.key} stage={s.key}>
              <div className="flex items-center justify-between gap-2 px-1 pb-2">
                <div className="min-w-0">
                  <div className="font-label text-[10px] tracking-[0.16em] uppercase flex items-center gap-1.5" style={{ color: s.color }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />{s.label}
                    <span className="text-gray-500">{list.length}</span>
                  </div>
                  <div className="text-[11px] text-gray-400">{list.length ? short$(sum) : s.hint}</div>
                </div>
                {(s.key === 'lead' || s.key === 'contacted' || s.key === 'talking' || s.key === 'hold') && (
                  <button onClick={() => onAdd(s.key)} className="text-gray-500 hover:text-[#8FD3FF] p-1" title={`Add a venue to ${s.label}`}><Plus className="w-4 h-4" /></button>
                )}
              </div>
              <div className="space-y-2 min-h-[60px]">
                {list.map((c) => <CardView key={c.key} c={c} on={c.key === selectedKey} onOpen={onOpen} />)}
              </div>
            </Column>
          );
        })}
      </div>

      <DeadZone count={dead.length} open={showDead} onToggle={() => setShowDead((v) => !v)}>
        {showDead && <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-2">{dead.sort(byDate).map((c) => <CardView key={c.key} c={c} on={c.key === selectedKey} onOpen={onOpen} />)}</div>}
      </DeadZone>

      <DragOverlay>{dragging ? <div className="rotate-2 opacity-90" style={{ textTransform: 'none', letterSpacing: 0 }}><CardBody c={dragging} on /></div> : null}</DragOverlay>
    </DndContext>
  );
}

const byDate = (a: Card, b: Card) => (a.date ?? '9999') < (b.date ?? '9999') ? -1 : (a.date ?? '9999') > (b.date ?? '9999') ? 1 : a.city.localeCompare(b.city);

function Column({ stage, children }: { stage: Stage; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={`snap-start shrink-0 w-[232px] rounded-2xl p-2 border transition-colors ${isOver ? 'bg-[#8FD3FF]/10 border-[#8FD3FF]/60' : 'bg-[#14171E] border-[#2A3040]'}`}
    >
      {children}
    </div>
  );
}

function DeadZone({ count, open, onToggle, children }: { count: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'dead' });
  return (
    <div ref={setNodeRef} className={`mt-2 rounded-2xl border border-dashed px-3 py-2 transition-colors ${isOver ? 'border-red-400 bg-red-900/20' : 'border-[#2A3040] bg-[#14171E]/60'}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between text-left" style={{ textTransform: 'none', letterSpacing: 0 }}>
        <span className="font-label text-[10px] tracking-[0.16em] uppercase text-gray-400">Dead · said no, released, cancelled <span className="text-gray-600">{count}</span></span>
        <span className="text-[11px] text-gray-500">{isOver ? 'Drop to mark dead' : open ? 'Hide' : 'Show'}</span>
      </button>
      {children}
    </div>
  );
}

function CardView({ c, on, onOpen }: { c: Card; on: boolean; onOpen: (c: Card) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.key });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={() => onOpen(c)} className={`touch-manipulation ${isDragging ? 'opacity-30' : ''}`} style={{ textTransform: 'none', letterSpacing: 0 }}>
      <CardBody c={c} on={on} />
    </div>
  );
}

function CardBody({ c, on }: { c: Card; on?: boolean }) {
  const d = c.date ? parseLocalDate(c.date) : null;
  return (
    <div
      className={`rounded-xl px-2.5 py-2 cursor-grab active:cursor-grabbing border transition-colors ${on ? 'border-[#8FD3FF] bg-[#0B2FB8]/40' : 'border-[#2A3040] bg-[#0B0D12] hover:border-[#8FD3FF]/50'} ${c.stage === 'dead' ? 'opacity-60' : ''}`}
      style={{ boxShadow: on ? '0 0 18px rgba(143,211,255,0.35)' : undefined }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[14px] text-white font-semibold leading-tight truncate">{c.city || '—'}</div>
          <div className="text-[12px] text-gray-400 truncate">{c.venue}</div>
        </div>
        {c.offer && <FileText className="w-3.5 h-3.5 text-[#8FD3FF] shrink-0 mt-0.5" aria-label="Has an offer" />}
      </div>
      <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px]">
        <span className="text-gray-400 inline-flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />{d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
        </span>
        {c.money != null && (
          <span className={`font-semibold ${c.money < 0 ? 'text-red-400' : c.moneyKind === 'actual' ? 'text-green-400' : 'text-white'}`} title={c.moneyKind === 'estimate' ? 'Your guess' : c.moneyKind === 'actual' ? 'Actual profit' : 'Projected profit'}>
            {c.moneyKind === 'estimate' ? '~' : ''}{short$(c.money)}
          </span>
        )}
      </div>
      {c.next && <div className="text-[11px] text-gray-300 mt-1 line-clamp-2"><span className="text-gray-500">Next:</span> {c.next}</div>}
    </div>
  );
}


