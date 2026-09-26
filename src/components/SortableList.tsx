import { ReactNode } from 'react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Drag to reorder. Mouse, finger, or keyboard (space, arrows, space).
 * The caller renders each row and spreads `handle` on whatever should grab it.
 */
export function SortableList({
  ids, onMove, renderItem, className,
}: {
  ids: string[];
  onMove: (from: number, to: number) => void;
  renderItem: (id: string, handle: Record<string, any>) => ReactNode;
  className?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    onMove(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {ids.map((id) => <Row key={id} id={id} render={renderItem} />)}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function Row({ id, render }: { id: string; render: (id: string, handle: Record<string, any>) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      {render(id, { ...attributes, ...listeners, ref: setActivatorNodeRef })}
    </div>
  );
}
