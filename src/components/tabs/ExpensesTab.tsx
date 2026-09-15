import { Expenses } from '../../types';
import { calculateCategoryTotal, formatCurrency } from '../../lib/calculations';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface ExpensesTabProps {
  expenses: Expenses;
  setExpenses: (expenses: Expenses) => void;
  ascapRate?: number;
  setAscapRate?: (value: number) => void;
  bmiRate?: number;
  setBmiRate?: (value: number) => void;
  sesacRate?: number;
  setSesacRate?: (value: number) => void;
  insurancePerAttendee?: number;
  setInsurancePerAttendee?: (value: number) => void;
  ccFeeRate?: number;
  setCcFeeRate?: (value: number) => void;
  supportActsCost?: number;
  accommodationCosts?: number;
  estimatedVariableExpenses?: number;
  artistGuarantee?: number;
}

export function ExpensesTab({
  expenses,
  setExpenses,
  ascapRate = 0.0023,
  setAscapRate = () => {},
  bmiRate = 0.003,
  setBmiRate = () => {},
  sesacRate = 0.000214,
  setSesacRate = () => {},
  insurancePerAttendee = 0.62,
  setInsurancePerAttendee = () => {},
  ccFeeRate = 0.012,
  setCcFeeRate = () => {},
  supportActsCost = 0,
  accommodationCosts = 0,
  estimatedVariableExpenses = 0,
  artistGuarantee = 0,
}: ExpensesTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<keyof Expenses | null>(null);

  const updateExpense = (category: keyof Expenses, field: string, value: number) => {
    setExpenses((prevExpenses) => ({
      ...prevExpenses,
      [category]: {
        ...prevExpenses[category],
        [field]: value,
      },
    }));
  };

  const openAddItemModal = (category: keyof Expenses) => {
    setSelectedCategory(category);
    setNewItemName('');
    setShowModal(true);
  };

  const addExpenseItem = () => {
    if (!selectedCategory || !newItemName.trim()) return;

    const normalizedName = newItemName.toLowerCase().trim().replace(/\s+/g, '_');
    setExpenses((prevExpenses) => ({
      ...prevExpenses,
      [selectedCategory]: {
        ...prevExpenses[selectedCategory],
        [normalizedName]: 0,
      },
    }));

    setShowModal(false);
    setNewItemName('');
    setSelectedCategory(null);
  };

  const removeExpenseItem = (category: keyof Expenses, field: string) => {
    setExpenses((prevExpenses) => {
      const updated = { ...prevExpenses[category] };
      delete updated[field];
      return {
        ...prevExpenses,
        [category]: updated,
      };
    });
  };

  const baseExpenses = Object.values(expenses).reduce(
    (sum, category) => sum + calculateCategoryTotal(category),
    0
  );

  const totalExpenses = baseExpenses + supportActsCost + accommodationCosts + estimatedVariableExpenses + artistGuarantee;

  const renderCategory = (
    title: string,
    category: keyof Expenses,
    color: string,
    bgColor: string
  ) => {
    const categoryTotal = calculateCategoryTotal(expenses[category]);

    return (
      <div className={`border ${color} ${bgColor} rounded-2xl p-6`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <span className="text-xl font-bold text-white">{formatCurrency(categoryTotal)}</span>
        </div>

        <div className="space-y-4">
          {Object.entries(expenses[category]).map(([field, value]) => (
            <div key={field} className="flex items-start gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-400 mb-2 capitalize">
                  {field.replace(/_/g, ' ')}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={value || ''}
                    onChange={(e) => updateExpense(category, field, Number(e.target.value))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full pl-9 pr-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeExpenseItem(category, field);
                }}
                className="mt-8 p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Remove item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openAddItemModal(category);
          }}
          className="mt-5 w-full py-3 border border-dashed border-gray-600 rounded-xl text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] hover:bg-[#8FD3FF]/5 transition-colors text-sm font-medium flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-3xl font-bold text-white mb-3">Expense Breakdown</h3>
        <p className="text-gray-400 mb-8">Manage all show expenses by category</p>
      </div>

      <div className="bg-[#0B0D12] border border-gray-700 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">Variable Expenses</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">ASCAP (%)</label>
            <input
              type="number"
              step="0.01"
              value={(ascapRate * 100).toFixed(3)}
              onChange={(e) => setAscapRate(parseFloat(e.target.value) / 100)}
              className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
            />
            <p className="text-xs text-gray-500 mt-2">Standard: 0.23%</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">BMI (%)</label>
            <input
              type="number"
              step="0.01"
              value={(bmiRate * 100).toFixed(3)}
              onChange={(e) => setBmiRate(parseFloat(e.target.value) / 100)}
              className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
            />
            <p className="text-xs text-gray-500 mt-2">Standard: 0.30%</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">SESAC (%)</label>
            <input
              type="number"
              step="0.001"
              value={(sesacRate * 100).toFixed(4)}
              onChange={(e) => setSesacRate(parseFloat(e.target.value) / 100)}
              className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
            />
            <p className="text-xs text-gray-500 mt-2">Standard: 0.0214%</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">CC Fee (%)</label>
            <input
              type="number"
              step="0.1"
              value={(ccFeeRate * 100).toFixed(2)}
              onChange={(e) => setCcFeeRate(parseFloat(e.target.value) / 100)}
              className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
            />
            <p className="text-xs text-gray-500 mt-2">Standard: 1.2%</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-2">Insurance Per Attendee ($)</label>
            <input
              type="number"
              step="0.01"
              value={insurancePerAttendee}
              onChange={(e) => setInsurancePerAttendee(parseFloat(e.target.value))}
              className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
            />
            <p className="text-xs text-gray-500 mt-2">Standard: $0.50-$0.75</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderCategory('Talent Expenses', 'talent', 'border-purple-500/30', 'bg-purple-500/10')}
        {renderCategory('General Expenses', 'general', 'border-blue-500/30', 'bg-blue-500/10')}
        {renderCategory('Marketing Expenses', 'marketing', 'border-green-500/30', 'bg-green-500/10')}
        {renderCategory('Production Expenses', 'production', 'border-orange-500/30', 'bg-orange-500/10')}
      </div>

      <div className="bg-gradient-to-r from-[#8FD3FF]/10 to-[#8FD3FF]/5 border-2 border-[#8FD3FF]/30 rounded-2xl p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-4 border-b border-gray-700">
            <span className="text-lg font-semibold text-white">Fixed Expenses</span>
            <span className="text-xl font-bold text-white">{formatCurrency(baseExpenses)}</span>
          </div>

          {supportActsCost > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-300">Support Acts</span>
              <span className="font-semibold text-white">{formatCurrency(supportActsCost)}</span>
            </div>
          )}

          {accommodationCosts > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-300">Accommodations (Hotel, Transport, Rider)</span>
              <span className="font-semibold text-white">{formatCurrency(accommodationCosts)}</span>
            </div>
          )}

          {estimatedVariableExpenses > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-300">Variable Expenses (Est.)</span>
              <span className="font-semibold text-white">{formatCurrency(estimatedVariableExpenses)}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t-2 border-[#8FD3FF]/50">
            <span className="text-xl font-bold text-white">Total All Expenses</span>
            <span className="text-3xl font-bold text-[#8FD3FF]">{formatCurrency(totalExpenses)}</span>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0B0D12] border border-gray-700 rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">
              Add Expense Item to {selectedCategory}
            </h3>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addExpenseItem();
                } else if (e.key === 'Escape') {
                  setShowModal(false);
                }
              }}
              placeholder="Enter expense item name"
              autoFocus
              className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF] mb-4"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addExpenseItem}
                disabled={!newItemName.trim()}
                className="flex-1 px-4 py-3 bg-[#8FD3FF] hover:bg-[#8FD3FF]/90 text-[#04214D] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
