import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { OfferWithShow, CompanySettings, EventArtist } from '../types';
import { formatCurrency, calculateCategoryTotal, getExpenseBreakdown } from '../lib/calculations';
import { getProfitIndicator } from '../lib/profitIndicators';
import { calculateArtistsSummary } from '../lib/artistCalculations';
import { CalculationsBreakdown } from './CalculationsBreakdown';
import { PDFPreview } from './PDFPreview';
import { EmailOfferModal } from './EmailOfferModal';
import { EditableNum } from './EditableNum';
import { parseLocalDate } from '../lib/dateHelpers';
import { useEstimateState, buildUpdatePayload } from '../hooks/useEstimateState';
import { useOfferExtras } from '../hooks/useOfferExtras';
import { useEventArtists } from '../hooks/useEventArtists';
import { DepositTracker } from './DepositTracker';
import { EventTasks } from './EventTasks';
import { EventNotesPanel } from './EventNotesPanel';
import { ArtistsDashboard } from './artists/ArtistsDashboard';
import { generateArtistOfferSheet } from '../lib/generateArtistOfferSheet';
import { ArrowLeft, Calendar, MapPin, Users, CreditCard as Edit, FileDown, Eye, Mail, BarChart3, Copy, Film, Trash2, Calculator, Sparkles, Save, Undo2, Loader2, Check } from 'lucide-react';

export function OfferDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const [offer, setOffer] = useState<OfferWithShow | null>(null);
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [costsOnly, setCostsOnly] = useState(false);
  const [dealScore, setDealScore] = useState<number | null>(null);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    state,
    isDirty,
    liveCalc,
    liveExpenses,
    liveTiers,
    markClean,
    resetToOriginal,
    updateTier,
    updateFixedExpense,
    addFixedExpense,
    renameFixedExpense,
    removeFixedExpense,
    updateSupportAct,
    updateVariableRate,
    setArtistGuarantee,
    setSalesTaxPct,
    setTaxWithholdingPct,
    setDepositPct,
  } = useEstimateState(offer);

  const {
    deposits, tasks, notes,
    depositsPaidTotal, depositsDueTotal,
    addDeposit, updateDeposit, deleteDeposit,
    addTask, updateTask, deleteTask,
    updateEventNotes, addPinnedNote, removePinnedNote,
  } = useOfferExtras(id);

  const {
    artists: eventArtists,
    artistTasks,
    loading: artistsLoading,
    importFromOffer,
    addArtist,
    updateArtist,
    deleteArtist,
    duplicateArtist,
    addTask: addArtistTask,
    updateTask: updateArtistTask,
    deleteTask: deleteArtistTask,
  } = useEventArtists(id || null);

  const artistsSummary = useMemo(() => calculateArtistsSummary(eventArtists), [eventArtists]);

  const handleGenerateArtistSheet = (artist: EventArtist) => {
    if (!offer) return;
    const doc = generateArtistOfferSheet(artist, offer, companySettings || undefined);
    const filename = `${(artist.artist_name || 'artist').replace(/\s+/g, '_')}_offer.pdf`;
    doc.save(filename);
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (id) loadOffer(id);
    loadCompanySettings();
    return () => { isMountedRef.current = false; };
  }, [id]);

  useEffect(() => {
    if (offer && offer.show.capacity > 0) analyzeDeal();
  }, [offer]);

  useEffect(() => {
    if (offer && !artistsLoading) {
      importFromOffer(offer);
    }
  }, [offer, artistsLoading, importFromOffer]);

  const loadCompanySettings = async () => {
    try {
      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (!isMountedRef.current) return;
      if (data) setCompanySettings(data);
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const handleSaveChanges = async () => {
    if (!offer || !state || !liveCalc) return;
    setSaving(true);
    try {
      const payload = buildUpdatePayload(state, liveCalc);
      const { error } = await supabase
        .from('offers')
        .update(payload)
        .eq('id', offer.id);
      if (error) throw error;
      markClean();
      setOffer(prev => prev ? { ...prev, ...payload } as OfferWithShow : prev);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = () => setShowPDFPreview(true);
  const handlePreviewPDF = () => setShowPDFPreview(true);

  const handleSaveAsTemplate = async () => {
    if (!offer) return;
    const templateName = prompt('Enter a name for this template:', `${offer.show.artist_name} Template`);
    if (!templateName) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!memberData?.organization_id) throw new Error('No organization found.');
      const expenseCategories = Object.keys(offer.expenses).map(category => ({
        title: category.charAt(0).toUpperCase() + category.slice(1),
        items: Object.entries(offer.expenses[category as keyof typeof offer.expenses]).map(([name, amount]) => ({
          name, default_amount: amount
        }))
      }));
      const { error } = await supabase.from('templates').insert([{
        user_id: user.id,
        organization_id: memberData.organization_id,
        name: templateName,
        description: `Template based on ${offer.show.artist_name} at ${offer.show.venue_name}`,
        type: 'event',
        deal_type: offer.deal_type,
        deposit_pct: offer.deposit_pct,
        deposit_due_timing: offer.deposit_due_timing || '30_days_before',
        tax_withholding_pct: offer.tax_withholding_pct,
        sales_tax_pct: offer.sales_tax_pct,
        ticket_tier_templates: offer.ticket_tiers.map(tier => ({
          type: tier.type, price: tier.price,
          default_allotment: tier.allotment, default_comps: tier.comps
        })),
        expense_categories: expenseCategories,
        legal_terms: companySettings?.legal_terms || ''
      }]);
      if (error) throw error;
      alert('Template saved successfully!');
      navigate('/templates');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
  };

  const handleDeleteOffer = async () => {
    if (!offer) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete the offer for "${offer.show.artist_name}" at "${offer.show.venue_name}"?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;
    try {
      const { error: offerError } = await supabase.from('offers').delete().eq('id', offer.id);
      if (offerError) throw offerError;
      const { error: showError } = await supabase.from('shows').delete().eq('id', offer.show_id);
      if (showError) throw showError;
      alert('Offer deleted successfully');
      navigate('/offers');
    } catch (error) {
      console.error('Error deleting offer:', error);
      alert('Failed to delete offer. Please try again.');
    }
  };

  const loadOffer = async (offerId: string) => {
    try {
      const { data: offerData, error: offerError } = await supabase
        .from('offers').select('*').eq('id', offerId).maybeSingle();
      if (!isMountedRef.current) return;
      if (offerError) throw offerError;
      if (!offerData) { navigate('/offers'); return; }
      const { data: showData, error: showError } = await supabase
        .from('shows').select('*').eq('id', offerData.show_id).maybeSingle();
      if (!isMountedRef.current) return;
      if (showError) throw showError;
      if (!showData) { navigate('/offers'); return; }
      if (!isMountedRef.current) return;
      setOffer({ ...offerData, show: showData });
    } catch (error) {
      console.error('Error loading offer:', error);
      if (isMountedRef.current) navigate('/offers');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const analyzeDeal = async () => {
    if (!offer) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !isMountedRef.current) return;
      const apiUrl = `${SUPABASE_URL}/functions/v1/analyze-deal`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_name: offer.show.artist_name, venue_name: offer.show.venue_name,
          capacity: offer.show.capacity, guarantee: offer.guarantee,
          gross_potential: offer.calculations.grossPotential, net_profit: offer.calculations.netProfit,
          total_costs: offer.calculations.totalShowCost ?? (offer.calculations.totalExpenses + offer.guarantee), ticket_tiers: offer.ticket_tiers,
        })
      });
      if (!res.ok || !isMountedRef.current) return;
      const data = await res.json();
      if (isMountedRef.current) setDealScore(data.overall_score);
    } catch (error) {
      console.error('Error analyzing deal:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1140F0] flex items-center justify-center">
        <div className="text-gray-400">Loading offer details...</div>
      </div>
    );
  }

  if (!offer) return null;

  const calc = liveCalc ?? offer.calculations;
  const guarantee = state?.artistGuarantee ?? offer.guarantee;
  const salesTaxPct = state?.salesTaxPct ?? offer.sales_tax_pct;
  const taxWithholdingPct = state?.taxWithholdingPct ?? offer.tax_withholding_pct;
  const depositPct = state?.depositPct ?? offer.deposit_pct;
  const expenses = liveExpenses ?? offer.expenses;
  const tiers = liveTiers ?? offer.ticket_tiers;
  const tierStates = state?.ticketTiers ?? offer.ticket_tiers.map((t, i) => ({
    id: `tier-${i}`, type: t.type, allotment: t.allotment, comps: t.comps, price: t.price,
  }));
  const supportActStates = state?.supportActs ?? (offer.support_acts || []).map((a, i) => ({
    id: `sa-${i}`, name: a.name, type: a.type, guarantee: a.guarantee,
  }));

  const taxWithholding = guarantee * (taxWithholdingPct / 100);
  const depositAmount = guarantee * (depositPct / 100);
  const indicator = getProfitIndicator(calc.netProfit, calc.netGross);

  return (
    <div className="min-h-screen bg-[#1140F0]">
      <div className={`max-w-7xl mx-auto px-3 py-4 ${isDirty ? 'pb-24' : ''}`}>
        <div className="mb-4">
          <button
            onClick={() => navigate('/offers')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-3 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Offers
          </button>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <button onClick={() => navigate(`/offers/${id}/analytics`)} className="bg-[#14171E] border border-gray-800 text-white py-6 rounded-2xl font-semibold hover:bg-[#22262F] transform hover:scale-105 transition-all flex flex-col sm:flex-row items-center justify-center gap-2">
              <BarChart3 className="h-5 w-5" /><span className="text-xs sm:text-base">Analytics</span>
            </button>
            <button onClick={() => navigate(`/offers/${id}/run-of-show`)} className="bg-[#14171E] border border-gray-800 text-white py-6 rounded-2xl font-semibold hover:bg-[#22262F] transform hover:scale-105 transition-all flex flex-col sm:flex-row items-center justify-center gap-2">
              <Film className="h-5 w-5" /><span className="text-xs sm:text-base">Run of Show</span>
            </button>
            {(() => {
              const eventDate = parseLocalDate(offer.show.event_date);
              const today = new Date(); today.setHours(0, 0, 0, 0);
              return eventDate && eventDate < today;
            })() && (
              <button onClick={() => navigate(`/offers/${id}/settlement`)} className="bg-[#14171E] border border-gray-800 text-white py-6 rounded-2xl font-semibold hover:bg-[#22262F] transform hover:scale-105 transition-all flex flex-col sm:flex-row items-center justify-center gap-2 relative">
                <Calculator className="h-5 w-5" />
                <span className="text-xs sm:text-base">{offer.is_settled ? 'View Settlement' : 'Settle Event'}</span>
                {offer.is_settled && <span className="absolute -top-1 -right-1 bg-[#8FD3FF] text-[#04214D] text-xs px-2 py-0.5 rounded-full font-bold">✓</span>}
              </button>
            )}
            <button onClick={handlePreviewPDF} className="bg-[#14171E] border border-gray-800 text-white py-6 rounded-2xl font-semibold hover:bg-[#22262F] transform hover:scale-105 transition-all flex flex-col sm:flex-row items-center justify-center gap-2">
              <Eye className="h-5 w-5" /><span className="text-xs sm:text-base">Preview</span>
            </button>
            <button onClick={() => navigate(`/offers/${id}/edit`)} className="bg-[#14171E] border border-gray-800 text-white py-6 rounded-2xl font-semibold hover:bg-[#22262F] transform hover:scale-105 transition-all flex flex-col sm:flex-row items-center justify-center gap-2">
              <Edit className="h-5 w-5" /><span className="text-xs sm:text-base">Edit</span>
            </button>
            <button onClick={handleSaveAsTemplate} className="bg-[#14171E] border border-gray-800 text-white py-6 rounded-2xl font-semibold hover:bg-[#22262F] transform hover:scale-105 transition-all flex flex-col sm:flex-row items-center justify-center gap-2">
              <Copy className="h-5 w-5" /><span className="text-xs sm:text-base">Template</span>
            </button>
          </div>
        </div>

        {/* Header Card */}
        <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-4 mb-4">
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-white break-words">{offer.show.event_name || offer.show.artist_name}</h1>
                {offer.show.event_name && <p className="text-sm text-gray-400 mt-0.5">{offer.show.artist_name}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:flex-shrink-0">
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={costsOnly} onChange={(e) => setCostsOnly(e.target.checked)} className="w-4 h-4 text-[#8FD3FF] bg-[#22262F] border-gray-700 rounded focus:ring-2 focus:ring-[#8FD3FF]" />
                  <span className="font-medium">Costs Only</span>
                </label>
                <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
                  <button onClick={() => setShowEmail(true)} className="bg-[#22262F] hover:bg-[#2A3040] border border-[#2A3040] text-white px-4 py-2 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-[#8FD3FF]" />Email
                  </button>
                  <button onClick={handleDownloadPDF} className="bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] px-4 py-2 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm">
                    <FileDown className="h-4 w-4" />Download
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-400 text-xs">
              <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 flex-shrink-0" /><span className="break-words">{offer.show.venue_name}</span></div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{(() => { const d = parseLocalDate(offer.show.event_date); return d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Invalid date'; })()}</span>
              </div>
              <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 flex-shrink-0" /><span>Capacity: {offer.show.capacity}</span></div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap ${offer.mode === 'estimate' ? 'bg-[#8FD3FF]/20 text-[#8FD3FF]' : 'bg-green-900/30 text-green-400'}`}>
                {offer.mode === 'estimate' ? 'Estimate' : 'Settlement'}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-[#22262F] text-gray-300 whitespace-nowrap">
                {offer.deal_type === 'flat_guarantee' ? 'Flat Guarantee' : 'Promoter Profit Deal'}
              </span>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#22262F] rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1">Net Gross Potential</div>
              <div className="text-lg font-bold text-white">{formatCurrency(calc.netGross)}</div>
            </div>
            <div className="bg-[#22262F] rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1">Artist Total Payout</div>
              <div className="text-lg font-bold text-white">{formatCurrency(calc.artistTotalPayout)}</div>
            </div>
            <div className={`rounded-xl p-3 ${calc.netProfit >= 0 ? 'bg-green-900/20 border border-green-800/30' : 'bg-red-900/20 border border-red-800/30'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{indicator.emoji}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${indicator.badge.bgColor} ${indicator.badge.textColor}`}>{indicator.badge.text}</span>
              </div>
              <div className="text-xs text-gray-400 mb-1">Net Profit</div>
              <div className={`text-lg font-bold ${calc.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(calc.netProfit)}</div>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 bg-[#22262F] rounded-full h-2 overflow-hidden">
                  <div className={`h-full ${indicator.meterColor} transition-all`} style={{ width: `${indicator.meterPercentage}%` }} />
                </div>
                <span className={`text-xs font-bold ${calc.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {calc.netGross > 0 ? `${((calc.netProfit / calc.netGross) * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
            </div>
            <DealScoreCard dealScore={dealScore} />
          </div>
        </div>

        {/* Multi-Artist CRM Section */}
        <div className="mb-4">
          <ArtistsDashboard
            artists={eventArtists}
            artistTasks={artistTasks}
            onAddArtist={addArtist}
            onUpdateArtist={updateArtist}
            onDeleteArtist={deleteArtist}
            onDuplicateArtist={duplicateArtist}
            onGenerateSheet={handleGenerateArtistSheet}
            onAddTask={addArtistTask}
            onUpdateTask={updateArtistTask}
            onDeleteTask={deleteArtistTask}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Artist Deal */}
          <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-4">
            <h2 className="text-base font-bold text-white mb-3">Artist Deal</h2>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Guarantee</span>
                <EditableNum value={guarantee} onChange={setArtistGuarantee} prefix="$" width="w-24" size="sm" color="text-white" />
              </div>
              {offer.deal_type === 'promoter_profit' && calc.artistBackend && calc.artistBackend > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Backend ({state?.artistBackendPct ?? 85}%)</span>
                  <span className="font-medium text-green-400">+{formatCurrency(calc.artistBackend)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 inline-flex items-center gap-1">
                  Tax Withholding <EditableNum value={taxWithholdingPct} onChange={setTaxWithholdingPct} suffix="%" width="w-14" size="xs" color="text-gray-400" />
                </span>
                <span className="font-medium text-red-400">-{formatCurrency(taxWithholding)}</span>
              </div>
              <div className="border-t border-gray-800 pt-2 flex justify-between">
                <span className="font-semibold text-white text-sm">Total Payout</span>
                <span className="font-bold text-white">{formatCurrency(calc.artistTotalPayout)}</span>
              </div>
              <div className="border-t border-gray-800 pt-2">
                <div className="text-xs text-gray-400 mb-1 inline-flex items-center gap-1">
                  Deposit <EditableNum value={depositPct} onChange={setDepositPct} suffix="%" width="w-14" size="xs" color="text-gray-400" /> of guarantee
                </div>
                <div className="font-semibold text-white text-sm">{formatCurrency(depositAmount)}</div>
              </div>
            </div>
          </div>

          {/* Ticket Scaling */}
          <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-4">
            <h2 className="text-base font-bold text-white mb-3">Ticket Scaling</h2>
            <div className="space-y-2">
              {tierStates.map((ts) => {
                const sellable = ts.allotment - ts.comps;
                return (
                  <div key={ts.id} className="flex justify-between items-center pb-2 border-b border-gray-800">
                    <div>
                      <div className="font-medium text-white text-sm">{ts.type}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <EditableNum value={ts.allotment} onChange={(v) => updateTier(ts.id, { allotment: v })} width="w-14" />
                        <span className="text-gray-500">-</span>
                        <span>{ts.comps}</span>
                        <span className="text-gray-500">=</span>
                        <span className="text-gray-300">{sellable} sell</span>
                        <span className="text-gray-600 mx-0.5">x</span>
                        <EditableNum value={ts.price} onChange={(v) => updateTier(ts.id, { price: v })} prefix="$" width="w-16" />
                      </div>
                    </div>
                    <div className="font-semibold text-white text-sm">{formatCurrency(sellable * ts.price)}</div>
                  </div>
                );
              })}
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs text-gray-400 inline-flex items-center gap-1">
                  Sales Tax <EditableNum value={salesTaxPct} onChange={setSalesTaxPct} suffix="%" width="w-14" />
                </span>
                <span className="font-medium text-red-400 text-sm">-{formatCurrency(calc.salesTax)}</span>
              </div>
              <div className="border-t border-gray-800 pt-2 flex justify-between">
                <span className="font-semibold text-white text-sm">Net Gross</span>
                <span className="font-bold text-white">{formatCurrency(calc.netGross)}</span>
              </div>
            </div>
          </div>

          {/* Fixed Expenses */}
          <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-4">
            <h2 className="text-base font-bold text-white mb-3">Fixed Expenses Breakdown</h2>
            <div className="space-y-3">
              {[
                { label: 'Talent', category: 'talent', color: 'text-purple-400' },
                { label: 'General', category: 'general', color: 'text-blue-400' },
                { label: 'Marketing', category: 'marketing', color: 'text-green-400' },
                { label: 'Production', category: 'production', color: 'text-orange-400' },
              ].map(({ label, category, color }) => {
                const categoryExpenses = expenses[category as keyof typeof expenses];
                const total = calculateCategoryTotal(categoryExpenses);
                // Drive the rows off the live state so lines can be added,
                // renamed and removed right here instead of only in the wizard.
                const rows = state
                  ? state.fixedExpenses.filter(e => e.category === category)
                  : Object.entries(categoryExpenses).map(([name, amount]) => ({ id: `${category}__${name}`, category, name, amount }));
                return (
                  <div key={category}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`font-semibold text-sm ${color}`}>{label}</span>
                      <span className="font-bold text-white text-sm">{formatCurrency(total)}</span>
                    </div>
                    <div className="pl-3 space-y-1.5 border-l-2 border-gray-800 ml-2">
                      {rows.map((row) => (
                        <div key={row.id} className="flex justify-between items-center text-xs gap-2">
                          <input
                            defaultValue={row.name.replace(/_/g, ' ')}
                            onBlur={(e) => renameFixedExpense(row.id, e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            title="Click to rename"
                            className="flex-1 min-w-0 bg-transparent text-gray-400 rounded px-1 py-0.5 -ml-1 hover:bg-[#22262F] focus:bg-[#22262F] focus:text-white focus:outline-none focus:ring-1 focus:ring-[#8FD3FF]"
                          />
                          <EditableNum value={row.amount} onChange={(v) => updateFixedExpense(row.id, v)} prefix="$" width="w-20" color="text-gray-300" />
                          <button
                            type="button"
                            onClick={() => removeFixedExpense(row.id)}
                            title="Remove this line"
                            className="text-gray-600 hover:text-red-400 shrink-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addFixedExpense(category)}
                        className="w-full mt-1 py-1 border border-dashed border-gray-700 rounded-lg text-[11px] text-gray-500 hover:border-[#8FD3FF] hover:text-[#8FD3FF] transition-colors"
                      >
                        + Add {label.toLowerCase()} line
                      </button>
                    </div>
                  </div>
                );
              })}

              {supportActStates.length > 0 && (
                <div className="border-t border-gray-800 pt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm text-cyan-400">Support Acts</span>
                    <span className="font-bold text-white text-sm">{formatCurrency(supportActStates.reduce((sum, act) => sum + (act.guarantee || 0), 0))}</span>
                  </div>
                  <div className="pl-3 space-y-1.5 border-l-2 border-gray-800 ml-2">
                    {supportActStates.map((act) => (
                      <div key={act.id} className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">{act.name} ({act.type})</span>
                        <EditableNum value={act.guarantee} onChange={(v) => updateSupportAct(act.id, v)} prefix="$" width="w-20" color="text-gray-300" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {eventArtists.length > 0 && (
                <div className="border-t border-gray-800 pt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm text-teal-400">Event Artists</span>
                    <span className="font-bold text-white text-sm">{formatCurrency(artistsSummary.totalArtistCosts)}</span>
                  </div>
                  <div className="pl-3 space-y-1 border-l-2 border-gray-800 ml-2">
                    {artistsSummary.totalGuarantees > 0 && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Guarantees ({eventArtists.length} artists)</span>
                        <span className="text-gray-300">{formatCurrency(artistsSummary.totalGuarantees)}</span>
                      </div>
                    )}
                    {artistsSummary.totalTravelCosts > 0 && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Travel</span>
                        <span className="text-gray-300">{formatCurrency(artistsSummary.totalTravelCosts)}</span>
                      </div>
                    )}
                    {artistsSummary.totalHospitalityCosts > 0 && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Hospitality</span>
                        <span className="text-gray-300">{formatCurrency(artistsSummary.totalHospitalityCosts)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(() => {
                let accommodationTotal = 0;
                const accommodationItems: { label: string; amount: number }[] = [];
                if (offer.include_hotel && offer.hotel_budget && offer.hotel_budget > 0) {
                  const hotelCost = offer.hotel_budget * (offer.hotel_nights || 1);
                  accommodationTotal += hotelCost;
                  accommodationItems.push({ label: `Hotel (${offer.hotel_nights || 1} nights)`, amount: hotelCost });
                }
                if (offer.include_transport && offer.transport_budget && offer.transport_budget > 0) {
                  accommodationTotal += offer.transport_budget;
                  accommodationItems.push({ label: 'Ground Transport', amount: offer.transport_budget });
                }
                if (offer.include_flights && offer.flight_budget && offer.flight_budget > 0) {
                  accommodationTotal += offer.flight_budget;
                  accommodationItems.push({ label: 'Flights', amount: offer.flight_budget });
                }
                if (offer.include_rider && offer.rider_cap && offer.rider_cap > 0) {
                  accommodationTotal += offer.rider_cap;
                  accommodationItems.push({ label: 'Rider/Hospitality', amount: offer.rider_cap });
                }
                if (accommodationTotal > 0) {
                  return (
                    <div className="border-t border-gray-800 pt-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-sm text-pink-400">Artist Accommodations</span>
                        <span className="font-bold text-white text-sm">{formatCurrency(accommodationTotal)}</span>
                      </div>
                      <div className="pl-3 space-y-1 border-l-2 border-gray-800 ml-2">
                        {accommodationItems.map((item, index) => (
                          <div key={index} className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">{item.label}</span>
                            <span className="text-gray-300">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          {/* Variable Expenses */}
          <div className="bg-[#14171E] border border-gray-800 rounded-2xl px-4 pt-4 pb-2">
            <h2 className="text-base font-bold text-white mb-3">Variable Expenses</h2>
            <div className="space-y-1.5">
              {(() => {
                const totalSellable = tierStates.reduce((sum, t) => sum + (t.allotment - t.comps), 0);
                const netGross = calc.netGross;
                const vr = state?.variableRates ?? {
                  ascapRate: offer.ascap_rate ?? 0, bmiRate: offer.bmi_rate ?? 0,
                  sesacRate: offer.sesac_rate ?? 0, insurancePerAttendee: offer.insurance_per_attendee ?? 0,
                  ccFeeRate: offer.cc_fee_rate ?? 0,
                };
                const ascap = netGross * vr.ascapRate;
                const bmi = netGross * vr.bmiRate;
                const sesac = netGross * vr.sesacRate;
                const insurance = totalSellable * vr.insurancePerAttendee;
                const ccFee = netGross * vr.ccFeeRate;
                const variableTotal = ascap + bmi + sesac + insurance + ccFee;

                const variableItems: { label: string; amount: number; rateKey: keyof typeof vr; displayRate: number; isPerAttendee?: boolean }[] = [
                  { label: 'ASCAP', amount: ascap, rateKey: 'ascapRate', displayRate: vr.ascapRate * 100 },
                  { label: 'BMI', amount: bmi, rateKey: 'bmiRate', displayRate: vr.bmiRate * 100 },
                  { label: 'SESAC', amount: sesac, rateKey: 'sesacRate', displayRate: vr.sesacRate * 100 },
                  { label: 'Insurance', amount: insurance, rateKey: 'insurancePerAttendee', displayRate: vr.insurancePerAttendee, isPerAttendee: true },
                  { label: 'CC Processing', amount: ccFee, rateKey: 'ccFeeRate', displayRate: vr.ccFeeRate * 100 },
                ];
                const activeItems = variableItems.filter(item => item.amount > 0 || state !== null);

                return (
                  <>
                    {activeItems.length === 0 ? (
                      <div className="text-center text-gray-500 text-sm py-2">No variable expenses configured</div>
                    ) : (
                      <>
                        {activeItems.map((item) => (
                          <div key={item.rateKey} className="flex justify-between items-center text-xs">
                            <span className="text-gray-400 inline-flex items-center gap-1">
                              {item.label}{' '}
                              {item.isPerAttendee ? (
                                <EditableNum
                                  value={parseFloat(item.displayRate.toFixed(2))}
                                  onChange={(v) => updateVariableRate(item.rateKey, v)}
                                  prefix="$" suffix="/att" width="w-14" step="0.01"
                                />
                              ) : (
                                <EditableNum
                                  value={parseFloat(item.displayRate.toFixed(4))}
                                  onChange={(v) => updateVariableRate(item.rateKey, v / 100)}
                                  suffix="%" width="w-16" step="0.01"
                                />
                              )}
                            </span>
                            <span className="text-gray-300">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                        <div className="border-t border-gray-800 pt-2 flex justify-between">
                          <span className="font-semibold text-white text-sm">Total Variable</span>
                          <span className="font-bold text-white">{formatCurrency(variableTotal)}</span>
                        </div>
                      </>
                    )}
                    {(() => {
                      const eb = getExpenseBreakdown(calc, guarantee);
                      return (
                        <>
                          <div className="border-t border-gray-800 pt-2 flex justify-between">
                            <span className="font-bold text-white text-sm">Total Expenses (Incl. Artist Guarantee)</span>
                            <span className="font-bold text-white">{formatCurrency(eb.totalExpenses)}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1 mb-0">
                            Fixed: {formatCurrency(eb.fixedExpensesTotal)} + Variable: {formatCurrency(eb.variableExpensesTotal)} + Artist: {formatCurrency(eb.artistPayout)} = Total: {formatCurrency(eb.totalExpenses)}
                          </div>
                        </>
                      );
                    })()}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Deposits + Tasks + Notes */}
          <DepositTracker
            deposits={deposits}
            depositsPaidTotal={depositsPaidTotal}
            depositsDueTotal={depositsDueTotal}
            artistDepositAmount={depositAmount > 0 ? depositAmount : undefined}
            artistDepositDueDate={offer.deposit_due_date}
            onAdd={addDeposit}
            onUpdate={updateDeposit}
            onDelete={deleteDeposit}
          />
          <EventTasks
            tasks={tasks}
            onAdd={addTask}
            onUpdate={updateTask}
            onDelete={deleteTask}
          />
          <EventNotesPanel
            notes={notes}
            onUpdateNotes={updateEventNotes}
            onAddPin={addPinnedNote}
            onRemovePin={removePinnedNote}
          />

          <CalculationsBreakdown
            ticketTiers={tiers}
            salesTaxPct={salesTaxPct}
            calculations={calc}
            guarantee={guarantee}
            mode={offer.mode}
            depositsPaidTotal={depositsPaidTotal}
            depositsDueTotal={depositsDueTotal}
          />

          {offer.mode === 'estimate' && offer.calculations.projections && (
            <div className="md:col-span-2 bg-[#14171E] border border-gray-800 rounded-2xl p-4">
              <h2 className="text-base font-bold text-white mb-3">Capacity Projections</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: '70% Capacity', data: offer.calculations.projections.capacity70, color: 'yellow' },
                  { label: '85% Capacity', data: offer.calculations.projections.capacity85, color: 'orange' },
                  { label: '100% Sellout', data: offer.calculations.projections.capacity100, color: 'green' },
                ].map(({ label, data, color }) => (
                  <div key={label} className={`border rounded-xl p-3 ${color === 'green' ? 'bg-green-900/10 border-green-800/30' : color === 'orange' ? 'bg-orange-900/10 border-orange-800/30' : 'bg-yellow-900/10 border-yellow-800/30'}`}>
                    <div className="font-bold text-white mb-3 text-sm text-center">{label}</div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs"><span className="text-gray-400">Tickets</span><span className="font-semibold text-white">{data.tickets}</span></div>
                      <div className="flex justify-between items-center text-xs"><span className="text-gray-400">Artist</span><span className="font-semibold text-white">{formatCurrency(data.artistPayout)}</span></div>
                      {offer.deal_type === 'promoter_profit' && (
                        <div className="flex justify-between items-center text-xs"><span className="text-gray-400">Promoter</span><span className="font-semibold text-white">{formatCurrency(data.promoterProfit)}</span></div>
                      )}
                      <div className="border-t border-gray-800 pt-2 flex justify-between items-center">
                        <span className="text-xs font-bold text-white">Net Profit</span>
                        <span className={`font-bold text-sm ${data.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(data.netProfit)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Profit %</span>
                        <span className={`font-bold ${data.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {data.netGross > 0 ? `${((data.netProfit / data.netGross) * 100).toFixed(1)}%` : '0%'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="md:col-span-2 bg-gradient-to-br from-[#8FD3FF]/10 to-green-500/10 border-2 border-[#8FD3FF]/30 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-[#8FD3FF] rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#04214D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">Next Steps</h3>
                <p className="text-gray-400 text-sm">Here's what you can do with this offer:</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { num: 1, title: 'Generate PDF', desc: 'Export a professional PDF to send to the artist or their management team.' },
                { num: 2, title: 'Create Run of Show', desc: 'Plan the event timeline with load-in, sound check, and performance times.' },
                { num: 3, title: 'Track Ticket Sales', desc: 'Monitor progress against your projections and adjust marketing if needed.' },
                { num: 4, title: 'Post-Show Settlement', desc: 'After the event, create a settlement to reconcile actual vs projected numbers.' },
              ].map(({ num, title, desc }) => (
                <div key={num} className="bg-[#14171E] border border-gray-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-[#8FD3FF] rounded-lg flex items-center justify-center text-[#04214D] font-bold text-xs">{num}</div>
                    <h4 className="font-semibold text-white text-sm">{title}</h4>
                  </div>
                  <p className="text-gray-400 text-xs">{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-[#14171E] border border-gray-700 rounded-xl">
              <p className="text-gray-400 text-xs">
                <span className="font-semibold text-[#8FD3FF]">Pro Tip:</span> Save this offer before making any changes. You can always edit it later if deal terms change.
              </p>
            </div>
          </div>

          {/* Debug Panel */}
          <div className="md:col-span-2">
            <button onClick={() => setShowDebug(prev => !prev)} className="text-xs text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1">
              <span className="font-mono">{showDebug ? '\u25BC' : '\u25B6'}</span>Live State Debug
            </button>
            {showDebug && state && (
              <div className="mt-2 bg-[#1140F0] border border-gray-800 rounded-xl p-3 overflow-auto max-h-80">
                <div className="font-mono text-[10px] text-gray-500 whitespace-pre">
                  {JSON.stringify({
                    grossRevenue: calc.grossPotential, netGross: calc.netGross,
                    showExpensesExclArtist: calc.totalExpenses, artistGuarantee: guarantee,
                    totalExpenses: calc.totalExpenses + guarantee, netProfit: calc.netProfit,
                    isDirty, estimateState: state,
                  }, null, 2)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button onClick={handleDeleteOffer} className="bg-red-900/20 border border-red-800/50 hover:bg-red-900/30 text-red-400 px-6 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 text-sm">
            <Trash2 className="h-4 w-4" />Delete Offer
          </button>
        </div>
      </div>

      {/* Floating Save Bar */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-out ${isDirty ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
        <div className="bg-[#14171E]/95 backdrop-blur-lg border-t border-[#8FD3FF]/20 shadow-[0_-4px_30px_rgba(0,0,0,0.5)]">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-2 h-2 rounded-full bg-[#8FD3FF] animate-pulse flex-shrink-0" />
              <span className="text-sm text-gray-300 truncate">Unsaved changes</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={resetToOriginal}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-[#22262F] border border-gray-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Discard
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={saving}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  saveSuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D]'
                } disabled:opacity-70`}
              >
                {saving ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving...</>
                ) : saveSuccess ? (
                  <><Check className="w-3.5 h-3.5" />Saved</>
                ) : (
                  <><Save className="w-3.5 h-3.5" />Save Changes</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPDFPreview && offer && (
        <PDFPreview offer={offer} companySettings={companySettings} costsOnly={costsOnly} onClose={() => setShowPDFPreview(false)} />
      )}
      {showEmail && offer && (
        <EmailOfferModal offer={offer} companySettings={companySettings} artists={eventArtists} costsOnly={costsOnly} onClose={() => setShowEmail(false)} />
      )}
    </div>
  );
}

function DealScoreCard({ dealScore }: { dealScore: number | null }) {
  const bg = dealScore === null ? 'bg-[#22262F]' :
    dealScore >= 80 ? 'bg-green-900/20 border border-green-800/30' :
    dealScore >= 60 ? 'bg-[#8FD3FF]/10 border border-[#8FD3FF]/30' :
    dealScore >= 40 ? 'bg-yellow-900/20 border border-yellow-800/30' : 'bg-red-900/20 border border-red-800/30';
  const iconColor = dealScore === null ? 'text-gray-400' :
    dealScore >= 80 ? 'text-green-400' : dealScore >= 60 ? 'text-[#8FD3FF]' :
    dealScore >= 40 ? 'text-yellow-400' : 'text-red-400';
  const badgeBg = dealScore === null ? 'bg-[#22262F] text-gray-400' :
    dealScore >= 80 ? 'bg-green-900/50 text-green-300' : dealScore >= 60 ? 'bg-[#8FD3FF]/20 text-[#8FD3FF]' :
    dealScore >= 40 ? 'bg-yellow-900/50 text-yellow-300' : 'bg-red-900/50 text-red-300';
  const badgeText = dealScore === null ? 'Calculating...' : dealScore >= 80 ? 'STRONG BUY' :
    dealScore >= 60 ? 'PROCEED' : dealScore >= 40 ? 'CAUTION' : 'PASS';
  const barColor = dealScore === null ? 'bg-gray-600' : dealScore >= 80 ? 'bg-green-500' :
    dealScore >= 60 ? 'bg-[#8FD3FF]' : dealScore >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`rounded-xl p-3 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className={`h-4 w-4 ${iconColor}`} />
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeBg}`}>{badgeText}</span>
      </div>
      <div className="text-xs text-gray-400 mb-1">AI Deal Score</div>
      <div className={`text-lg font-bold ${iconColor}`}>{dealScore === null ? '\u2014' : `${dealScore}/100`}</div>
      <div className="mt-2">
        <div className="w-full bg-[#22262F] rounded-full h-2 overflow-hidden">
          <div className={`h-full transition-all ${barColor}`} style={{ width: dealScore === null ? '0%' : `${dealScore}%` }} />
        </div>
      </div>
    </div>
  );
}
