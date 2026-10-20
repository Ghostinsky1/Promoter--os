import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Template } from '../types';
import { Plus, Copy, Edit, Trash2, FileText } from 'lucide-react';
import { CreateTemplateModal } from './CreateTemplateModal';
import { offerFieldsFromTemplate, expenseTotal, dealLine } from '../lib/dealTemplate';
import { short$ } from '../lib/tourPipeline';

export function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      console.log('🔍 Loading templates...');

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        console.error('❌ Auth error:', authError);
        throw authError;
      }

      if (!user) {
        console.log('⚠️ No user logged in');
        setTemplates([]);
        setLoading(false);
        return;
      }

      console.log('✅ User authenticated:', user.id);

      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!memberData?.organization_id) {
        console.log('⚠️ No organization found for user');
        setTemplates([]);
        setLoading(false);
        return;
      }

      console.log('🏢 Organization ID:', memberData.organization_id);

      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('organization_id', memberData.organization_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Templates error:', error);
        throw error;
      }

      console.log('📊 Templates loaded:', data?.length || 0);
      setTemplates(data || []);
    } catch (error) {
      console.error('❌ Error loading templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTemplates(templates.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  const lab = 'font-label text-[10px] tracking-[0.16em] uppercase';
  const cols = 'md:grid-cols-[minmax(0,1fr)_170px_90px_90px_80px_150px]';

  if (loading) {
    return <div className="min-h-screen bg-[#1140F0] flex items-center justify-center text-white text-sm">Loading templates…</div>;
  }

  return (
    <div className="min-h-screen bg-[#1140F0]">
      <div className="bg-[#14171E] border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-none">Deal templates</h1>
            <p className="text-gray-400 text-sm mt-1">Your usual deals, saved. Pick one on a new offer and the whole setup fills in.</p>
          </div>
          <button onClick={() => setIsCreating(true)} className="flex items-center gap-1.5 px-3 py-2 bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-xl text-sm font-bold">
            <Plus className="h-4 w-4" /> New template
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4">
        <p className="text-[12px] text-white/80 mb-2">Fastest way to make one: open an offer you liked and press <b className="text-white">Save as template</b> — it keeps the deal, tiers, costs and fees.</p>
        {templates.length === 0 ? (
          <div className="bg-[#14171E] border border-[#2A3040] rounded-xl p-8 text-center">
            <FileText className="h-8 w-8 text-gray-500 mx-auto mb-2" />
            <p className="text-white font-semibold">No templates yet.</p>
            <p className="text-gray-400 text-sm mt-1">Save one from an offer, or build one here.</p>
          </div>
        ) : (
          <div className="bg-[#14171E] border border-[#2A3040] rounded-xl">
            <div className={`hidden md:grid ${cols} gap-3 px-4 py-2 border-b border-[#2A3040] ${lab} text-gray-500`}>
              <span>Template</span><span>Deal</span><span className="text-right">Deposit</span><span className="text-right">Tiers</span><span className="text-right">Costs</span><span />
            </div>
            {templates.map((template) => {
              const f = offerFieldsFromTemplate(template);
              const costs = expenseTotal(f.expenses);
              const tiers = template.ticket_tier_templates || [];
              return (
                <div key={template.id} className={`px-4 py-2.5 border-b border-[#2A3040] last:border-b-0 md:grid ${cols} md:gap-3 md:items-center`}>
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm truncate">{template.name}</div>
                    <div className="text-[11px] text-gray-400 truncate">{template.description || '—'}</div>
                  </div>
                  <div className="text-sm text-[#8FD3FF] mt-1 md:mt-0">{dealLine(template)}</div>
                  <div className="text-sm text-gray-300 md:text-right">{template.deposit_pct ?? 0}% <span className="md:hidden text-gray-500">deposit</span></div>
                  <div className="text-sm text-gray-300 md:text-right" title={tiers.map((t) => `${t.type} $${t.price}`).join(' · ')}>{tiers.length ? tiers.map((t) => `$${t.price}`).slice(0, 3).join('/') : '—'}</div>
                  <div className="text-sm text-gray-300 md:text-right">{costs ? short$(costs) : '—'}</div>
                  <div className="flex gap-1.5 mt-2 md:mt-0 md:justify-end">
                    <button onClick={() => navigate('/offers/create', { state: { template } })} className="flex items-center gap-1 px-2.5 py-1.5 bg-[#8FD3FF] text-[#04214D] rounded-lg text-xs font-bold" title="Start a full offer from this deal">
                      <Copy className="h-3.5 w-3.5" /> Use
                    </button>
                    <button onClick={() => setEditingTemplate(template)} className="px-2 py-1.5 bg-[#22262F] text-gray-300 rounded-lg hover:text-white" title="Edit"><Edit className="h-3.5 w-3.5" /></button>
                    <button onClick={() => deleteTemplate(template.id)} className="px-2 py-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(isCreating || editingTemplate) && (
        <CreateTemplateModal
          existingTemplate={editingTemplate}
          onClose={() => {
            setIsCreating(false);
            setEditingTemplate(null);
          }}
          onSave={(template) => {
            if (editingTemplate) {
              setTemplates(templates.map(t => t.id === template.id ? template : t));
            } else {
              setTemplates([template, ...templates]);
            }
            setIsCreating(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
}
