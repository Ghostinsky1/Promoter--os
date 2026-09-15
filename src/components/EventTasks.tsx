import { useState, useMemo } from 'react';
import { ListChecks, Plus, Trash2, ChevronDown, ChevronRight, Check, Calendar } from 'lucide-react';
import type { OfferTask } from '../types';

interface EventTasksProps {
  tasks: OfferTask[];
  onAdd: (task: Partial<OfferTask>) => Promise<OfferTask | undefined>;
  onUpdate: (id: string, patch: Partial<OfferTask>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const PRIORITY_CONFIG = {
  high: { color: 'text-red-400', bg: 'bg-red-900/30', label: 'High' },
  med: { color: 'text-yellow-400', bg: 'bg-yellow-900/30', label: 'Med' },
  low: { color: 'text-gray-400', bg: 'bg-gray-800', label: 'Low' },
};

export function EventTasks({ tasks, onAdd, onUpdate, onDelete }: EventTasksProps) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<OfferTask['priority']>('med');
  const [newDueDate, setNewDueDate] = useState('');
  const [filter, setFilter] = useState<'all' | 'incomplete'>('all');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const doneCount = tasks.filter(t => t.completed).length;

  const sortedTasks = useMemo(() => {
    let filtered = filter === 'incomplete' ? tasks.filter(t => !t.completed) : [...tasks];
    const priorityOrder = { high: 0, med: 1, low: 2 };
    filtered.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const pa = priorityOrder[a.priority] ?? 1;
      const pb = priorityOrder[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
    return filtered;
  }, [tasks, filter]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await onAdd({
      title: newTitle.trim(),
      priority: newPriority,
      due_date: newDueDate || undefined,
      completed: false,
    });
    setNewTitle('');
    setNewPriority('med');
    setNewDueDate('');
    setAdding(false);
  };

  const toggleComplete = (task: OfferTask) => {
    onUpdate(task.id, { completed: !task.completed });
  };

  const saveTaskNote = (id: string) => {
    onUpdate(id, { note: noteText });
    setExpandedTask(null);
    setNoteText('');
  };

  return (
    <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-[#8FD3FF]" />
          <h2 className="text-base font-bold text-white">Tasks</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#22262F] text-gray-400 font-medium">
            {doneCount}/{tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#22262F] rounded-lg p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${filter === 'all' ? 'bg-[#14171E] text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >All</button>
            <button
              onClick={() => setFilter('incomplete')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${filter === 'incomplete' ? 'bg-[#14171E] text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >To-Do</button>
          </div>
          <button
            onClick={() => setAdding(!adding)}
            className="text-xs text-[#8FD3FF] hover:text-[#6FB8F2] flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />Add
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {tasks.length > 0 && (
        <div className="mb-3">
          <div className="w-full bg-[#22262F] rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-[#8FD3FF] transition-all duration-300"
              style={{ width: `${tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Add Row */}
      {adding && (
        <div className="mb-3 p-3 bg-[#0B0D12] border border-[#2A3040] rounded-lg space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Task description..."
            className="w-full bg-[#2A3040] border border-[#2A3040] rounded-md px-2.5 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-[#8FD3FF]/50"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
          <div className="flex items-center gap-2">
            <select
              value={newPriority}
              onChange={e => setNewPriority(e.target.value as OfferTask['priority'])}
              className="bg-[#2A3040] border border-[#2A3040] rounded-md px-2 py-1.5 text-xs text-gray-300 outline-none focus:border-[#8FD3FF]/50"
            >
              <option value="high">High</option>
              <option value="med">Medium</option>
              <option value="low">Low</option>
            </select>
            <input
              type="date"
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)}
              className="bg-[#2A3040] border border-[#2A3040] rounded-md px-2 py-1.5 text-xs text-gray-300 outline-none focus:border-[#8FD3FF]/50"
            />
            <div className="flex-1" />
            <button onClick={() => setAdding(false)} className="px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={handleAdd} className="px-3 py-1 bg-[#8FD3FF] text-[#04214D] text-xs font-bold rounded-md hover:bg-[#6FB8F2] transition-colors">Add</button>
          </div>
        </div>
      )}

      {/* Task List */}
      {sortedTasks.length === 0 && !adding ? (
        <div className="text-center text-gray-500 text-xs py-4">
          {filter === 'incomplete' ? 'All tasks complete' : 'No tasks yet'}
        </div>
      ) : (
        <div className="space-y-0.5">
          {sortedTasks.map(task => {
            const cfg = PRIORITY_CONFIG[task.priority];
            return (
              <div key={task.id} className="group">
                <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#22262F]/60 transition-colors">
                  <button
                    onClick={() => toggleComplete(task)}
                    className={`w-4 h-4 rounded flex-shrink-0 border transition-all flex items-center justify-center ${
                      task.completed
                        ? 'bg-[#8FD3FF]/20 border-[#8FD3FF] text-[#8FD3FF]'
                        : 'border-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {task.completed && <Check className="w-2.5 h-2.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs truncate ${task.completed ? 'text-gray-500 line-through' : 'text-white'}`}>{task.title}</span>
                      <span className={`text-[9px] px-1 py-0.5 rounded font-medium flex-shrink-0 ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      {task.note && <span className="text-[10px] text-[#8FD3FF]/50 flex-shrink-0">*</span>}
                    </div>
                    {task.due_date && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Calendar className="w-2.5 h-2.5 text-gray-500" />
                        <span className="text-[10px] text-gray-500">{new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => {
                        if (expandedTask === task.id) { setExpandedTask(null); setNoteText(''); }
                        else { setExpandedTask(task.id); setNoteText(task.note || ''); }
                      }}
                      className={`p-0.5 rounded hover:bg-[#22262F] transition-colors ${task.note ? 'text-[#8FD3FF]' : 'text-gray-500'}`}
                    >
                      {expandedTask === task.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                    <button onClick={() => onDelete(task.id)} className="p-0.5 rounded text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {expandedTask === task.id && (
                  <div className="ml-6 mb-1 flex gap-1">
                    <input
                      type="text"
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add a note..."
                      className="flex-1 bg-[#0B0D12] border border-[#2A3040] rounded-md px-2 py-1 text-[10px] text-gray-300 outline-none focus:border-[#8FD3FF]/50"
                      onKeyDown={e => { if (e.key === 'Enter') saveTaskNote(task.id); }}
                    />
                    <button onClick={() => saveTaskNote(task.id)} className="px-2 py-1 bg-[#8FD3FF]/20 text-[#8FD3FF] text-[10px] rounded-md hover:bg-[#8FD3FF]/30 transition-colors">Save</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
