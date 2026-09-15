import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { TicketTier, Expenses } from '../types';
import { calculateOffer, formatCurrency } from '../lib/calculations';
import { calculateDepositDueDate, getDaysUntil, formatDate } from '../lib/dateHelpers';
import { DepositsTab } from './tabs/DepositsTab';
import { ArrowLeft, Plus, Trash2, X, Check, ChevronDown, Calendar, MapPin, TrendingUp, AlertCircle } from 'lucide-react';

interface ExpenseItem {
  name: string;
  amount: string;
}

interface ExpenseCategory {
  title: string;
  items: ExpenseItem[];
}

export function CreateOfferDistrict() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [eventName, setEventName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [capacity, setCapacity] = useState<number>(0);
  const [mode] = useState<'estimate' | 'settlement'>('estimate');

  const [dealType, setDealType] = useState<'flat_guarantee' | 'promoter_profit'>('flat_guarantee');
  const [guarantee, setGuarantee] = useState<number>(0);
  const [taxWithholdingPct, setTaxWithholdingPct] = useState<number>(2);
  const [depositPct, setDepositPct] = useState<number>(20);
  const [depositDueTiming, setDepositDueTiming] = useState<string>('30_days_before');
  const [customDepositDate, setCustomDepositDate] = useState<string>('');
  const [artistDepositStatus, setArtistDepositStatus] = useState<string>('pending');
  const [venueDeposit, setVenueDeposit] = useState<number>(0);
  const [venueDepositDueDate, setVenueDepositDueDate] = useState<string>('');
  const [venueDepositStatus, setVenueDepositStatus] = useState<string>('pending');

  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([
    { type: 'General Admission', allotment: 0, comps: 0, price: 0 }
  ]);
  const [salesTaxPct, setSalesTaxPct] = useState<number>(13.18);

  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([
    { title: 'Talent', items: [{ name: 'Rider/Hospitality', amount: '' }] },
    { title: 'Production', items: [{ name: 'Sound & Lights', amount: '' }, { name: 'Stage & Crew', amount: '' }] },
    { title: 'Marketing', items: [{ name: 'Advertising', amount: '' }, { name: 'Social Media', amount: '' }] },
    { title: 'Venue & Staff', items: [{ name: 'Venue Cost', amount: '' }, { name: 'Security', amount: '' }, { name: 'Staff', amount: '' }] }
  ]);

  const [showDetails, setShowDetails] = useState(false);

  const convertExpensesToOldFormat = (): Expenses => {
    const expenses: Expenses = { talent: {}, general: {}, marketing: {}, production: {} };

    expenseCategories.forEach(category => {
      const categoryKey = category.title.toLowerCase().replace(/\s+/g, '_');
      const targetCategory = categoryKey.includes('talent') ? 'talent' :
                            categoryKey.includes('market') ? 'marketing' :
                            categoryKey.includes('production') || categoryKey.includes('sound') || categoryKey.includes('stage') ? 'production' :
                            'general';

      category.items.forEach(item => {
        const itemKey = item.name.toLowerCase().replace(/\s+/g, '_');
        expenses[targetCategory][itemKey] = parseFloat(item.amount) || 0;
      });
    });

    return expenses;
  };

  const calculations = calculateOffer(
    ticketTiers,
    salesTaxPct,
    convertExpensesToOldFormat(),
    guarantee,
    taxWithholdingPct,
    dealType,
    mode,
    85,
    15,
    [],
    undefined,
    undefined
  );

  const stepTitles = ['Event Details', 'Artist Deal', 'Ticket Scaling', 'Expenses', 'Summary'];

  const addTier = () => {
    setTicketTiers([...ticketTiers, { type: '', allotment: 0, comps: 0, price: 0 }]);
  };

  const removeTier = (index: number) => {
    if (ticketTiers.length > 1) {
      setTicketTiers(ticketTiers.filter((_, i) => i !== index));
    }
  };

  const updateTier = (index: number, field: keyof TicketTier, value: string | number) => {
    const updated = [...ticketTiers];
    updated[index] = { ...updated[index], [field]: value };
    setTicketTiers(updated);
  };

  const addCategory = () => {
    setExpenseCategories([...expenseCategories, { title: 'New Category', items: [{ name: 'Item', amount: '' }] }]);
  };

  const removeCategory = (index: number) => {
    setExpenseCategories(expenseCategories.filter((_, i) => i !== index));
  };

  const updateCategoryTitle = (index: number, title: string) => {
    const updated = [...expenseCategories];
    updated[index].title = title;
    setExpenseCategories(updated);
  };

  const addItem = (categoryIndex: number) => {
    const updated = [...expenseCategories];
    updated[categoryIndex].items.push({ name: 'New Expense', amount: '' });
    setExpenseCategories(updated);
  };

  const removeItem = (categoryIndex: number, itemIndex: number) => {
    const updated = [...expenseCategories];
    updated[categoryIndex].items = updated[categoryIndex].items.filter((_, i) => i !== itemIndex);
    setExpenseCategories(updated);
  };

  const updateItemName = (categoryIndex: number, itemIndex: number, name: string) => {
    const updated = [...expenseCategories];
    updated[categoryIndex].items[itemIndex].name = name;
    setExpenseCategories(updated);
  };

  const updateItemAmount = (categoryIndex: number, itemIndex: number, amount: string) => {
    const updated = [...expenseCategories];
    updated[categoryIndex].items[itemIndex].amount = amount;
    setExpenseCategories(updated);
  };

  const getCategoryTotal = (category: ExpenseCategory) => {
    return category.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  const calculateCapitalRequired = () => {
    const artistDeposit = (guarantee * depositPct) / 100;
    const marketingCategory = expenseCategories.find(cat =>
      cat.title.toLowerCase().includes('marketing')
    );
    const marketingBudget = marketingCategory ? getCategoryTotal(marketingCategory) : 0;

    return {
      artistDeposit,
      venueDeposit,
      marketingBudget,
      totalCapital: artistDeposit + venueDeposit + marketingBudget
    };
  };

  const handleSave = async () => {
    if (!artistName || !venueName || !eventDate || capacity === 0) {
      alert('Please fill in all event details');
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('You must be logged in to create an offer');
        navigate('/');
        return;
      }

      const showId = `show_${Date.now()}`;
      const offerId = `offer_${Date.now()}`;

      const { error: showError } = await supabase.from('shows').insert({
        id: showId,
        event_name: eventName || null,
        artist_name: artistName,
        venue_name: venueName,
        event_date: eventDate,
        capacity: capacity,
        user_id: user.id,
      });

      if (showError) throw showError;

      const { error: offerError } = await supabase.from('offers').insert({
        id: offerId,
        show_id: showId,
        mode: mode,
        deal_type: dealType,
        guarantee: guarantee,
        tax_withholding_pct: taxWithholdingPct,
        deposit_pct: depositPct,
        deposit_due_timing: depositDueTiming,
        deposit_due_date: customDepositDate || null,
        artist_deposit_status: artistDepositStatus,
        venue_deposit: venueDeposit,
        venue_deposit_due_date: venueDepositDueDate || null,
        venue_deposit_status: venueDepositStatus,
        ticket_tiers: ticketTiers,
        sales_tax_pct: salesTaxPct,
        expenses: convertExpensesToOldFormat(),
        calculations: calculations,
        user_id: user.id,
      });

      if (offerError) throw offerError;

      navigate('/offers');
    } catch (error) {
      console.error('Error saving offer:', error);
      alert('Failed to save offer. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 1: return artistName && venueName && eventDate && capacity > 0;
      case 2: return guarantee > 0;
      case 3: return ticketTiers.some(t => t.allotment > 0 && t.price > 0);
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const totalTickets = ticketTiers.reduce((sum, tier) => sum + (tier.allotment - tier.comps), 0);
  const avgTicketPrice = totalTickets > 0 ? calculations.grossPotential / totalTickets : 0;

  return (
    <div className="min-h-screen bg-white pb-32">
      <div className="sticky top-16 bg-white border-b border-gray-200 px-4 py-4 z-40">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Create Offer</h1>
            <p className="text-sm text-gray-500">Step {currentStep} of 5: {stepTitles[currentStep - 1]}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-500">Step {currentStep} of 5</div>
            <div className="text-sm font-semibold">{stepTitles[currentStep - 1]}</div>
          </div>

          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${(currentStep / 5) * 100}%` }}
            />
          </div>

          <div className="flex justify-between">
            {[1, 2, 3, 4, 5].map(step => (
              <div key={step} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    step < currentStep ? 'bg-green-500 text-white' :
                    step === currentStep ? 'bg-indigo-600 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step < currentStep ? <Check className="w-4 h-4" /> : step}
                </div>
                <div className="text-xs mt-1 text-gray-500 hidden sm:block">{stepTitles[step - 1].split(' ')[0]}</div>
              </div>
            ))}
          </div>
        </div>

        {currentStep === 1 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-6">Event Details</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-base font-semibold mb-2">Event Name</label>
                <input
                  type="text"
                  className="w-full text-lg py-4 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="e.g., Summer Festival 2024 (optional)"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                />
                <p className="text-sm text-gray-500 mt-1">Optional - Give this event a custom name for easy identification</p>
              </div>

              <div>
                <label className="block text-base font-semibold mb-2">Artist Name</label>
                <input
                  type="text"
                  className="w-full text-lg py-4 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="e.g., Drake, The Weeknd"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-base font-semibold mb-2">Venue Name</label>
                <input
                  type="text"
                  className="w-full text-lg py-4 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="e.g., Madison Square Garden"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-semibold mb-2">Event Date</label>
                  <input
                    type="date"
                    className="w-full py-4 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold mb-2">Capacity</label>
                  <input
                    type="number"
                    className="w-full py-4 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="2000"
                    value={capacity || ''}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-6">Artist Deal</h2>
            <p className="text-gray-600 mb-6">Configure the artist's payment terms and deposits</p>

            <div className="space-y-6">
              <div>
                <label className="block text-base font-semibold mb-3">Deal Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDealType('flat_guarantee')}
                    className={`px-4 py-4 rounded-xl border-2 font-semibold transition-all ${
                      dealType === 'flat_guarantee'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-[#04214D] border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Flat Guarantee
                  </button>
                  <button
                    onClick={() => setDealType('promoter_profit')}
                    className={`px-4 py-4 rounded-xl border-2 font-semibold transition-all ${
                      dealType === 'promoter_profit'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-[#04214D] border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Profit Deal (85/15)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-base font-semibold mb-3">Guarantee Amount</label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-2xl">$</span>
                  <input
                    type="number"
                    className="w-full py-6 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 text-3xl font-bold"
                    placeholder="20000"
                    value={guarantee || ''}
                    onChange={(e) => setGuarantee(Number(e.target.value))}
                  />
                </div>
              </div>

              <DepositsTab
                guarantee={guarantee}
                taxWithholdingPct={taxWithholdingPct}
                setTaxWithholdingPct={setTaxWithholdingPct}
                depositPct={depositPct}
                setDepositPct={setDepositPct}
                depositDueTiming={depositDueTiming}
                setDepositDueTiming={setDepositDueTiming}
                customDepositDate={customDepositDate}
                setCustomDepositDate={setCustomDepositDate}
                artistDepositStatus={artistDepositStatus}
                setArtistDepositStatus={setArtistDepositStatus}
                venueDeposit={venueDeposit}
                setVenueDeposit={setVenueDeposit}
                venueDepositDueDate={venueDepositDueDate}
                setVenueDepositDueDate={setVenueDepositDueDate}
                venueDepositStatus={venueDepositStatus}
                setVenueDepositStatus={setVenueDepositStatus}
                eventDate={eventDate}
              />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <div className="bg-white border border-gray-200 rounded-xl p-8 mb-4">
              <h2 className="text-2xl font-bold mb-6">Ticket Scaling</h2>
              <p className="text-gray-600 mb-6">Set up your ticket tiers and pricing</p>

              {ticketTiers.map((tier, index) => {
                const sellable = tier.allotment - tier.comps;
                const grossPotential = sellable * tier.price;

                return (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-4">
                    <div className="flex justify-between items-start mb-4">
                      <input
                        type="text"
                        value={tier.type}
                        onChange={(e) => updateTier(index, 'type', e.target.value)}
                        placeholder="Phase 1 - General Admission"
                        className="flex-1 text-xl font-bold bg-transparent outline-none"
                      />
                      {ticketTiers.length > 1 && (
                        <button
                          onClick={() => removeTier(index)}
                          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          <Trash2 className="h-5 w-5 text-gray-400" />
                        </button>
                      )}
                    </div>

                    <div className="text-3xl font-bold mb-6">${tier.price.toFixed(2)}</div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Allotment</label>
                        <input
                          type="number"
                          value={tier.allotment || ''}
                          onChange={(e) => updateTier(index, 'allotment', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Comps</label>
                        <input
                          type="number"
                          value={tier.comps || ''}
                          onChange={(e) => updateTier(index, 'comps', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Price</label>
                        <input
                          type="number"
                          value={tier.price || ''}
                          onChange={(e) => updateTier(index, 'price', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex gap-2">
                        <span>•</span>
                        <span>Sellable: <strong>{sellable} tickets</strong></span>
                      </div>
                      <div className="flex gap-2">
                        <span>•</span>
                        <span>Gross potential: <strong>{formatCurrency(grossPotential)}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={addTier}
                className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-indigo-600 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 font-semibold"
              >
                <Plus className="h-5 w-5" />
                Add Ticket Tier
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-8">
              <h3 className="text-lg font-bold mb-4">Sales Tax</h3>
              <input
                type="number"
                value={salesTaxPct}
                onChange={(e) => setSalesTaxPct(Number(e.target.value))}
                placeholder="Sales Tax %"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-6">Show Expenses</h2>
            <p className="text-gray-600 mb-6">Add all costs for producing this show</p>

            <div className="space-y-6">
              {expenseCategories.map((category, categoryIndex) => (
                <div key={categoryIndex} className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      value={category.title}
                      onChange={(e) => updateCategoryTitle(categoryIndex, e.target.value)}
                      className="text-lg font-bold bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-indigo-600 px-2 py-1 outline-none flex-1"
                      placeholder="Category name..."
                    />
                    {expenseCategories.length > 1 && (
                      <button
                        onClick={() => removeCategory(categoryIndex)}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                      >
                        <Trash2 className="h-4 w-4 text-gray-400" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {category.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex gap-3">
                        <input
                          value={item.name}
                          onChange={(e) => updateItemName(categoryIndex, itemIndex, e.target.value)}
                          placeholder="Expense name"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                        <div className="flex items-center gap-2 w-40">
                          <span className="text-gray-500">$</span>
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) => updateItemAmount(categoryIndex, itemIndex, e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                          />
                        </div>
                        <button
                          onClick={() => removeItem(categoryIndex, itemIndex)}
                          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          <X className="h-4 w-4 text-gray-400" />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={() => addItem(categoryIndex)}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Add expense
                    </button>
                  </div>

                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-300">
                    <span className="font-semibold">{category.title} Total:</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(getCategoryTotal(category))}
                    </span>
                  </div>
                </div>
              ))}

              <button
                onClick={addCategory}
                className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-indigo-600 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 font-semibold"
              >
                <Plus className="h-5 w-5" />
                Add Expense Category
              </button>

              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-6">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold">Total Show Expenses:</span>
                  <span className="text-3xl font-bold text-indigo-600">
                    {formatCurrency(calculations.totalExpenses)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-2">Offer Summary</h2>
            <p className="text-gray-600 mb-8">Review your offer before saving</p>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold">{artistName}</h3>
                  <p className="text-lg text-gray-600">{venueName}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(eventDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
                  {dealType === 'flat_guarantee' ? 'FLAT GUARANTEE' : 'PROFIT DEAL'}
                </span>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-lg">Expected Ticket Revenue</span>
                <span className="text-xl font-bold">{formatCurrency(calculations.grossPotential)}</span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-200 text-gray-600">
                <span className="text-lg">Less: Taxes & Fees</span>
                <span className="text-xl">-{formatCurrency(calculations.salesTax)}</span>
              </div>

              <div className="flex justify-between items-center py-3 border-b-2 border-gray-300">
                <span className="text-lg font-semibold">Net Revenue</span>
                <span className="text-xl font-bold text-blue-600">{formatCurrency(calculations.netGross)}</span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-gray-200 text-gray-600">
                <span className="text-lg">Less: Artist Payment</span>
                <span className="text-xl">-{formatCurrency(guarantee)}</span>
              </div>

              <div className="flex justify-between items-center py-3 border-b-2 border-gray-300 text-gray-600">
                <span className="text-lg">Less: Show Expenses</span>
                <span className="text-xl">-{formatCurrency(calculations.totalExpenses)}</span>
              </div>

              <div className={`rounded-xl p-6 ${
                calculations.netProfit >= 0 ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'
              }`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Projected Net Profit</div>
                    <div className={`text-4xl font-bold ${
                      calculations.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {calculations.netProfit >= 0 ? '+' : ''}{formatCurrency(calculations.netProfit)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {((calculations.netProfit / calculations.netGross) * 100).toFixed(1)}% profit margin
                    </div>
                  </div>
                  <div className="text-6xl">
                    {calculations.netProfit >= 0 ? '📈' : '📉'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-sm text-gray-500 mb-1">Total Tickets</div>
                <div className="text-2xl font-bold">{totalTickets}</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-sm text-gray-500 mb-1">Avg. Ticket Price</div>
                <div className="text-2xl font-bold">{formatCurrency(avgTicketPrice)}</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-sm text-gray-500 mb-1">Capacity</div>
                <div className="text-2xl font-bold">{capacity}</div>
              </div>
            </div>

            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-semibold"
              >
                <span>View detailed breakdown</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
              </button>
              {showDetails && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>Ticket tiers: {ticketTiers.length}</span>
                    <span>{formatCurrency(calculations.grossPotential)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sales tax ({salesTaxPct}%)</span>
                    <span>{formatCurrency(calculations.salesTax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expense categories: {expenseCategories.length}</span>
                    <span>{formatCurrency(calculations.totalExpenses)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-4 py-4 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">Step {currentStep} of 5</div>
            <div className="font-semibold">{stepTitles[currentStep - 1]}</div>
          </div>

          <div className="flex gap-3">
            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold hover:border-gray-400 transition-colors"
              >
                ← Back
              </button>
            )}

            {currentStep < 5 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!isStepValid(currentStep)}
                className="px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving ? 'Saving...' : (
                  <>
                    <Check className="w-5 h-5" />
                    Save Offer
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
