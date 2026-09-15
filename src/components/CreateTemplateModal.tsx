import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Template, TicketTierTemplate, ExpenseCategoryTemplate } from '../types';
import { X, Plus, Trash2, FileText, DollarSign, FileCheck } from 'lucide-react';

interface CreateTemplateModalProps {
  existingTemplate?: Template | null;
  onClose: () => void;
  onSave: (template: Template) => void;
}

export function CreateTemplateModal({ existingTemplate, onClose, onSave }: CreateTemplateModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [templateData, setTemplateData] = useState({
    name: existingTemplate?.name || '',
    description: existingTemplate?.description || '',
    type: existingTemplate?.type || 'venue' as 'venue' | 'artist' | 'event',
    deal_type: existingTemplate?.deal_type || 'flat_guarantee' as 'flat_guarantee' | 'promoter_profit',
    deposit_pct: existingTemplate?.deposit_pct || 20,
    deposit_due_timing: existingTemplate?.deposit_due_timing || '30_days_before',
    tax_withholding_pct: existingTemplate?.tax_withholding_pct || 2,
    sales_tax_pct: existingTemplate?.sales_tax_pct || 10,
    ticket_tier_templates: existingTemplate?.ticket_tier_templates || [] as TicketTierTemplate[],
    expense_categories: existingTemplate?.expense_categories || [] as ExpenseCategoryTemplate[],
    legal_terms: existingTemplate?.legal_terms || ''
  });

  const handleSave = async () => {
    if (!templateData.name) {
      alert('Please enter a template name');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      console.log('Organization lookup:', { memberData, memberError, userId: user.id });

      if (!memberData?.organization_id) {
        throw new Error('No organization found. Please contact support.');
      }

      const payload = {
        ...templateData,
        user_id: user.id,
        organization_id: memberData.organization_id,
        updated_at: new Date().toISOString()
      };

      console.log('Saving template with payload:', payload);

      if (existingTemplate) {
        const { data, error } = await supabase
          .from('templates')
          .update(payload)
          .eq('id', existingTemplate.id)
          .select()
          .single();

        if (error) throw error;
        onSave(data);
      } else {
        const { data, error } = await supabase
          .from('templates')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        onSave(data);
      }
    } catch (error: any) {
      console.error('Error saving template:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      const errorMsg = error.message || error.details || 'Failed to save template. Please try again.';
      alert(`Failed to save template: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const addTicketTier = () => {
    setTemplateData({
      ...templateData,
      ticket_tier_templates: [
        ...templateData.ticket_tier_templates,
        { type: 'GA', price: 25, default_allotment: 2000, default_comps: 100 }
      ]
    });
  };

  const updateTicketTier = (index: number, field: keyof TicketTierTemplate, value: string | number) => {
    const newTiers = [...templateData.ticket_tier_templates];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTemplateData({ ...templateData, ticket_tier_templates: newTiers });
  };

  const removeTicketTier = (index: number) => {
    setTemplateData({
      ...templateData,
      ticket_tier_templates: templateData.ticket_tier_templates.filter((_, i) => i !== index)
    });
  };

  const addExpenseCategory = () => {
    setTemplateData({
      ...templateData,
      expense_categories: [
        ...templateData.expense_categories,
        { title: 'New Category', items: [] }
      ]
    });
  };

  const updateCategoryTitle = (index: number, title: string) => {
    const newCategories = [...templateData.expense_categories];
    newCategories[index].title = title;
    setTemplateData({ ...templateData, expense_categories: newCategories });
  };

  const addExpenseItem = (categoryIndex: number) => {
    const newCategories = [...templateData.expense_categories];
    newCategories[categoryIndex].items.push({ name: '', default_amount: 0 });
    setTemplateData({ ...templateData, expense_categories: newCategories });
  };

  const updateExpenseItem = (categoryIndex: number, itemIndex: number, field: 'name' | 'default_amount', value: string | number) => {
    const newCategories = [...templateData.expense_categories];
    newCategories[categoryIndex].items[itemIndex] = {
      ...newCategories[categoryIndex].items[itemIndex],
      [field]: value
    };
    setTemplateData({ ...templateData, expense_categories: newCategories });
  };

  const removeExpenseItem = (categoryIndex: number, itemIndex: number) => {
    const newCategories = [...templateData.expense_categories];
    newCategories[categoryIndex].items = newCategories[categoryIndex].items.filter((_, i) => i !== itemIndex);
    setTemplateData({ ...templateData, expense_categories: newCategories });
  };

  const removeExpenseCategory = (index: number) => {
    setTemplateData({
      ...templateData,
      expense_categories: templateData.expense_categories.filter((_, i) => i !== index)
    });
  };

  const loadDefaultTerms = () => {
    const defaultTerms = `Offer expires 15 days from submission date.

Age Restriction: 21+

Artist responsible for airfare/travel/hotel/backline.

Artist to perform minimum 75 minutes.

Offer contingent upon being the only area play within 100 miles from now until 30 days after the show date.

EVENT IS RAIN OR SHINE

Meet and Greet for radio winners requested for maximum of 30 people pending no Covid-19 restrictions.

Artist to provide marketing support through social media and allowing promoter advertising access to artist social channels.`;
    setTemplateData({ ...templateData, legal_terms: defaultTerms });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {existingTemplate ? 'Edit Template' : 'Create Template'}
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="mb-6">
            <div className="flex justify-between mb-2">
              {['Basic Info', 'Deal Terms', 'Tickets', 'Expenses', 'Legal'].map((label, i) => (
                <div key={i} className="flex-1 text-center">
                  <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center text-sm font-bold ${
                    i + 1 < step ? 'bg-green-500 text-white' :
                    i + 1 === step ? 'bg-indigo-600 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {i + 1 < step ? '✓' : i + 1}
                  </div>
                  <div className="text-xs mt-1 text-gray-600">{label}</div>
                </div>
              ))}
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>

          <div className="mb-6">
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-base font-semibold mb-2 text-slate-900">Template Name *</label>
                  <input
                    type="text"
                    value={templateData.name}
                    onChange={(e) => setTemplateData({ ...templateData, name: e.target.value })}
                    placeholder="e.g., Standard Venue Deal, Small Artist Package"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-base font-semibold mb-2 text-slate-900">Description</label>
                  <textarea
                    value={templateData.description}
                    onChange={(e) => setTemplateData({ ...templateData, description: e.target.value })}
                    placeholder="Describe when to use this template..."
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-base font-semibold mb-2 text-slate-900">Template Type *</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'venue', label: 'Venue-Specific', icon: FileText, desc: 'For specific venue deals' },
                      { value: 'artist', label: 'Artist-Level', icon: DollarSign, desc: 'For artist categories' },
                      { value: 'event', label: 'Event-Type', icon: FileCheck, desc: 'For event types' }
                    ].map((type) => (
                      <div
                        key={type.value}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          templateData.type === type.value
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-slate-200 hover:border-indigo-300'
                        }`}
                        onClick={() => setTemplateData({ ...templateData, type: type.value as 'venue' | 'artist' | 'event' })}
                      >
                        <type.icon className={`h-6 w-6 mb-2 ${
                          templateData.type === type.value ? 'text-indigo-600' : 'text-gray-400'
                        }`} />
                        <div className="font-semibold text-sm mb-1">{type.label}</div>
                        <div className="text-xs text-gray-500">{type.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-base font-semibold mb-2 text-slate-900">Deal Type</label>
                  <select
                    value={templateData.deal_type}
                    onChange={(e) => setTemplateData({ ...templateData, deal_type: e.target.value as 'flat_guarantee' | 'promoter_profit' })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="flat_guarantee">Flat Guarantee</option>
                    <option value="promoter_profit">Promoter Profit Deal (85/15)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-semibold mb-2 text-slate-900">Deposit %</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={templateData.deposit_pct}
                        onChange={(e) => setTemplateData({ ...templateData, deposit_pct: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-gray-500">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-base font-semibold mb-2 text-slate-900">Due Timing</label>
                    <select
                      value={templateData.deposit_due_timing}
                      onChange={(e) => setTemplateData({ ...templateData, deposit_due_timing: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="30_days_before">30 days before</option>
                      <option value="60_days_before">60 days before</option>
                      <option value="upon_signing">Upon signing</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-semibold mb-2 text-slate-900">Tax Withholding %</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={templateData.tax_withholding_pct}
                        onChange={(e) => setTemplateData({ ...templateData, tax_withholding_pct: parseFloat(e.target.value) })}
                        step="0.1"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-gray-500">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-base font-semibold mb-2 text-slate-900">Sales Tax %</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={templateData.sales_tax_pct}
                        onChange={(e) => setTemplateData({ ...templateData, sales_tax_pct: parseFloat(e.target.value) })}
                        step="0.1"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-gray-500">%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-base font-semibold text-slate-900">Ticket Tier Templates</label>
                  <button
                    onClick={addTicketTier}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Tier
                  </button>
                </div>

                <div className="space-y-4">
                  {templateData.ticket_tier_templates.map((tier, index) => (
                    <div key={index} className="bg-slate-50 rounded-lg p-4">
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs mb-1 text-slate-600">Tier Type</label>
                          <input
                            type="text"
                            value={tier.type}
                            onChange={(e) => updateTicketTier(index, 'type', e.target.value)}
                            placeholder="GA, VIP..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1 text-slate-600">Price ($)</label>
                          <input
                            type="number"
                            value={tier.price}
                            onChange={(e) => updateTicketTier(index, 'price', parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1 text-slate-600">Default Allotment</label>
                          <input
                            type="number"
                            value={tier.default_allotment}
                            onChange={(e) => updateTicketTier(index, 'default_allotment', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => removeTicketTier(index)}
                            className="w-full px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4 mx-auto" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {templateData.ticket_tier_templates.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No ticket tiers added yet. Click "Add Tier" to start.
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-base font-semibold text-slate-900">Expense Categories</label>
                  <button
                    onClick={addExpenseCategory}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Category
                  </button>
                </div>

                <div className="space-y-4">
                  {templateData.expense_categories.map((category, catIndex) => (
                    <div key={catIndex} className="bg-slate-50 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <input
                          type="text"
                          value={category.title}
                          onChange={(e) => updateCategoryTitle(catIndex, e.target.value)}
                          className="text-lg font-bold bg-transparent border-none p-0 focus:outline-none"
                          placeholder="Category name..."
                        />
                        <button
                          onClick={() => removeExpenseCategory(catIndex)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        {category.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="flex gap-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateExpenseItem(catIndex, itemIndex, 'name', e.target.value)}
                              placeholder="Expense name"
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <div className="flex items-center gap-2 w-32">
                              <span className="text-gray-500">$</span>
                              <input
                                type="number"
                                value={item.default_amount}
                                onChange={(e) => updateExpenseItem(catIndex, itemIndex, 'default_amount', parseFloat(e.target.value))}
                                placeholder="0"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <button
                              onClick={() => removeExpenseItem(catIndex, itemIndex)}
                              className="px-3 py-2 text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}

                        <button
                          onClick={() => addExpenseItem(catIndex)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Plus className="h-4 w-4" />
                          Add Expense
                        </button>
                      </div>
                    </div>
                  ))}

                  {templateData.expense_categories.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No expense categories added yet. Click "Add Category" to start.
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-base font-semibold mb-2 text-slate-900">Legal Terms & Conditions</label>
                  <textarea
                    value={templateData.legal_terms}
                    onChange={(e) => setTemplateData({ ...templateData, legal_terms: e.target.value })}
                    rows={12}
                    placeholder="Enter standard terms and conditions..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  onClick={loadDefaultTerms}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                >
                  Load Default Terms
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-8">
            <button
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Back
            </button>

            {step < 5 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
