import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Template } from '../types';
import { Plus, Copy, Edit, Trash2, FileText } from 'lucide-react';
import { CreateTemplateModal } from './CreateTemplateModal';

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

  const getDealTypeLabel = (dealType: string) => {
    switch (dealType) {
      case 'flat_fee': return 'Flat Fee';
      case 'guarantee_vs_percentage': return 'Guarantee vs %';
      case 'percentage_only': return '% Only';
      case 'door_deal': return 'Door Deal';
      default: return dealType;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1113] flex items-center justify-center">
        <div className="text-gray-400">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1113]">
      <div className="bg-[#1A1D1F] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Offer Templates</h1>
              <p className="text-gray-400 mt-1">Save and reuse offer configurations</p>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#C4FF0D] text-black rounded-lg font-semibold hover:bg-[#A3D60A] transition-all transform hover:scale-105"
            >
              <Plus className="h-5 w-5" />
              Create Template
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {templates.length === 0 ? (
          <div className="bg-[#1A1D1F] rounded-xl border border-gray-800 p-16 text-center">
            <div className="w-24 h-24 bg-[#252A2E] rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="h-12 w-12 text-gray-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">No Templates Yet</h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Create your first template to quickly set up future offers
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#C4FF0D] text-black rounded-lg font-semibold hover:bg-[#A3D60A] transition-all transform hover:scale-105"
            >
              <Plus className="h-5 w-5" />
              Create Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-[#1A1D1F] rounded-xl border border-gray-800 p-6 hover:border-[#C4FF0D]/50 transition-all group"
              >
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-14 h-14 bg-[#252A2E] rounded-xl flex items-center justify-center group-hover:bg-[#C4FF0D]/10 transition-colors">
                    <FileText className="h-7 w-7 text-[#C4FF0D]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white mb-1 truncate">{template.name}</h3>
                    <p className="text-sm text-gray-400 line-clamp-2">
                      {template.description || 'No description'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-[#252A2E] rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Deal Type</div>
                    <div className="font-semibold text-sm text-white">
                      {getDealTypeLabel(template.deal_type)}
                    </div>
                  </div>
                  <div className="bg-[#252A2E] rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Expenses</div>
                    <div className="font-semibold text-sm text-white">
                      {template.expense_categories?.length || 0} categories
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-sm mb-5 pb-5 border-b border-gray-800">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Deposit:</span>
                    <span className="font-semibold text-white">{template.deposit_pct}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Tax Withholding:</span>
                    <span className="font-semibold text-white">{template.tax_withholding_pct}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Ticket Tiers:</span>
                    <span className="font-semibold text-white">{template.ticket_tier_templates?.length || 0}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate('/offers/create', { state: { template } })}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-[#C4FF0D] text-black rounded-lg text-sm font-semibold hover:bg-[#A3D60A] transition-all transform hover:scale-105"
                  >
                    <Copy className="h-4 w-4" />
                    Use Template
                  </button>
                  <button
                    onClick={() => setEditingTemplate(template)}
                    className="flex items-center justify-center px-3 py-2.5 bg-[#252A2E] text-gray-300 rounded-lg hover:bg-[#1A1D1F] transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="flex items-center justify-center px-3 py-2.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
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
