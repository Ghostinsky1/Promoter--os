import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { OfferWithShow, CompanySettings } from '../types';
import { formatCurrency, netGrossOf, computeDeal, dealTermsOf, dealTypeOf } from '../lib/calculations';
import { generateSettlementPDF } from '../lib/generateSettlementPDF';
import { parseLocalDate } from '../lib/dateHelpers';
import { useOrganization } from '../hooks/useOrganization';
import {
  ArrowLeft,
  Save,
  FileDown,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Plus,
  Trash2,
  DollarSign,
  Users,
  Ticket,
  Wallet,
  Calendar,
  MapPin,
  Music,
  Receipt,
  Printer,
  Send
} from 'lucide-react';
import {
  RevenueChannel, channelTotals, defaultRevenueChannels, newRevenueChannel,
  readRevenueChannels, reconciliationNote, feesAlsoInExpenses,
} from '../lib/revenueChannels';
import { SettlementImport, type Extracted } from './SettlementImport';
import { canImportDocuments } from '../lib/subscriptionTiers';

interface ActualTicketTier {
  type: string;
  price: number;
  actual_sold: number;
  projected_sold: number;
}

interface Settlement {
  id?: string;
  offer_id: string;
  actual_attendance: ActualTicketTier[];
  actual_expenses: {
    talent: Record<string, number>;
    general: Record<string, number>;
    marketing: Record<string, number>;
    production: Record<string, number>;
  };
  actual_revenue: number;
  actual_revenue_channels?: RevenueChannel[];
  actual_total_expenses: number;
  actual_profit: number;
  variance_revenue: number;
  variance_expenses: number;
  variance_profit: number;
  notes: string;
  settled_at?: string;
}

export function Settlement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const [offer, setOffer] = useState<OfferWithShow | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings | undefined>(undefined);

  useEffect(() => {
    if (id) {
      loadOfferAndSettlement(id);
    }
  }, [id]);

  const loadOfferAndSettlement = async (offerId: string) => {
    try {
      const { data: offerData, error: offerError } = await supabase
        .from('offers')
        .select('*')
        .eq('id', offerId)
        .maybeSingle();

      if (offerError) throw offerError;
      if (!offerData) {
        navigate('/offers');
        return;
      }

      const { data: showData, error: showError } = await supabase
        .from('shows')
        .select('*')
        .eq('id', offerData.show_id)
        .maybeSingle();

      if (showError) throw showError;
      if (!showData) {
        navigate('/offers');
        return;
      }

      const offerWithShow = {
        ...offerData,
        show: showData,
      };

      setOffer(offerWithShow);

      const { data: settings } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (settings) {
        setCompanySettings(settings);
      }

      const { data: settlementData } = await supabase
        .from('settlements')
        .select('*')
        .eq('offer_id', offerId)
        .maybeSingle();

      if (settlementData) {
        // Recalculate with the current offer data to ensure accuracy
        const recalculated = calculateActuals(settlementData, offerWithShow);
        setSettlement(recalculated);
      } else {
        const initialAttendance: ActualTicketTier[] = offerWithShow.ticket_tiers.map((tier: any) => ({
          type: tier.type,
          price: tier.price,
          actual_sold: 0,
          projected_sold: tier.allotment - tier.comps,
        }));

        const initialExpenses: any = {};
        Object.keys(offerWithShow.expenses).forEach((category) => {
          initialExpenses[category] = {};
          Object.keys(offerWithShow.expenses[category]).forEach((expenseKey) => {
            initialExpenses[category][expenseKey] = 0;
          });
        });

        setSettlement({
          offer_id: offerId,
          actual_attendance: initialAttendance,
          actual_expenses: initialExpenses,
          actual_revenue: 0,
          actual_total_expenses: 0,
          actual_profit: 0,
          variance_revenue: 0,
          variance_expenses: 0,
          variance_profit: 0,
          notes: '',
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      navigate('/offers');
    } finally {
      setLoading(false);
    }
  };

  const calculateActuals = (updatedSettlement: Settlement, offerData?: OfferWithShow) => {
    const currentOffer = offerData || offer;

    const actualRevenue = updatedSettlement.actual_attendance.reduce(
      (sum, tier) => sum + tier.actual_sold * tier.price,
      0
    );

    // Calculate base expenses from categories (excluding support_acts if it exists as a category)
    const baseExpenses = Object.entries(updatedSettlement.actual_expenses).reduce(
      (sum, [categoryKey, category]) => {
        // Skip support_acts category since we calculate it separately from offer.support_acts
        if (categoryKey === 'support_acts') return sum;
        return sum + Object.values(category).reduce((catSum, val) => catSum + val, 0);
      },
      0
    );

    // Add support acts costs from the offer.support_acts array
    const supportActsCost = currentOffer?.support_acts?.reduce((sum, act) => sum + act.guarantee, 0) || 0;

    // Calculate accommodation costs
    let accommodationTotal = 0;
    if (currentOffer?.include_hotel && currentOffer?.hotel_budget) {
      accommodationTotal += currentOffer.hotel_budget * (currentOffer.hotel_nights || 1);
    }
    if (currentOffer?.include_transport && currentOffer?.transport_budget) {
      accommodationTotal += currentOffer.transport_budget;
    }
    if (currentOffer?.include_rider && currentOffer?.rider_cap) {
      accommodationTotal += currentOffer.rider_cap;
    }

    // Same money model as the offer. This screen used to count the facility
    // fee as an expense (the offer PDF deducted it from gross, the app ignored
    // it -- three answers), subtract sales tax that is not the promoter's
    // money, and pay the artist the PROJECTED take-home whatever the deal
    // said. On a percentage deal the artist is paid on what actually sold.
    const paidSold = updatedSettlement.actual_attendance
      .filter((tier) => (tier.price || 0) > 0)
      .reduce((sum, tier) => sum + tier.actual_sold, 0);
    const terms = dealTermsOf(currentOffer);
    const g = netGrossOf(actualRevenue, paidSold, currentOffer?.sales_tax_pct || 0, terms.facilityFeePerTicket, terms.facilityFeeMode);
    const netGross = g.netGross;

    const ascap = netGross * (currentOffer?.ascap_rate || 0);
    const bmi = netGross * (currentOffer?.bmi_rate || 0);
    const sesac = netGross * (currentOffer?.sesac_rate || 0);
    const insurance = paidSold * (currentOffer?.insurance_per_attendee || 0);
    const ccFee = netGross * (currentOffer?.cc_fee_rate || 0);
    const variableExpenses = ascap + bmi + sesac + insurance + ccFee;

    // Total all expenses (excluding the artist, as everywhere else)
    const actualTotalExpenses = baseExpenses + supportActsCost + accommodationTotal + variableExpenses;

    // What the artist is actually owed on the night's real numbers.
    const deal = computeDeal(netGross, actualTotalExpenses, {
      dealType: dealTypeOf(currentOffer),
      guarantee: currentOffer?.guarantee || 0,
      taxWithholdingPct: currentOffer?.tax_withholding_pct || 0,
      artistPercentage: terms.artistPercentage,
      artistPctBasis: terms.artistPctBasis,
      doorSplitBasis: terms.doorSplitBasis,
      artistBackendPct: currentOffer?.artist_backend_pct ?? 85,
      promoterBackendPct: currentOffer?.promoter_backend_pct ?? 15,
    });
    const artistPayment = deal.artistCost;
    const actualProfit = netGross - actualTotalExpenses - artistPayment;

    const projectedRevenue = currentOffer?.calculations.grossPotential || 0;
    const projectedExpenses = currentOffer?.calculations.totalExpenses || 0;
    const projectedProfit = currentOffer?.calculations.netProfit || 0;

    return {
      ...updatedSettlement,
      actual_revenue: actualRevenue,
      actual_total_expenses: actualTotalExpenses,
      actual_profit: actualProfit,
      variance_revenue: actualRevenue - projectedRevenue,
      variance_expenses: actualTotalExpenses - projectedExpenses,
      variance_profit: actualProfit - projectedProfit,
    };
  };

  const handleAttendanceChange = (index: number, value: string) => {
    if (!settlement) return;

    const updated = { ...settlement };
    updated.actual_attendance[index].actual_sold = parseInt(value) || 0;
    setSettlement(calculateActuals(updated));
  };

  const handleExpenseChange = (category: keyof Settlement['actual_expenses'], key: string, value: string) => {
    if (!settlement) return;

    const updated = { ...settlement };
    updated.actual_expenses[category][key] = parseFloat(value) || 0;
    setSettlement(calculateActuals(updated));
  };

  const handleNotesChange = (value: string) => {
    if (!settlement) return;
    setSettlement({ ...settlement, notes: value });
  };

  const handleDeleteExpense = (category: keyof Settlement['actual_expenses'], key: string) => {
    if (!settlement) return;
    if (!confirm(`Delete expense "${key}"?`)) return;

    const updated = { ...settlement };
    delete updated.actual_expenses[category][key];
    setSettlement(calculateActuals(updated));
  };

  const handleAddExpense = (category: keyof Settlement['actual_expenses']) => {
    if (!settlement) return;

    const expenseName = prompt('Enter expense name:');
    if (!expenseName || expenseName.trim() === '') return;

    const key = expenseName.trim().toLowerCase().replace(/\s+/g, '_');

    if (settlement.actual_expenses[category][key] !== undefined) {
      alert('An expense with this name already exists in this category');
      return;
    }

    const updated = { ...settlement };
    updated.actual_expenses[category][key] = 0;
    setSettlement(calculateActuals(updated));
  };

  const handleAddCategory = () => {
    if (!settlement) return;

    const categoryName = prompt('Enter new category name:');
    if (!categoryName || categoryName.trim() === '') return;

    const key = categoryName.trim().toLowerCase().replace(/\s+/g, '_') as keyof Settlement['actual_expenses'];

    if (settlement.actual_expenses[key] !== undefined) {
      alert('A category with this name already exists');
      return;
    }

    const updated = { ...settlement };
    updated.actual_expenses[key] = {};
    setSettlement(calculateActuals(updated));
  };

  /**
   * Take what came off the scanned document and put it into the form.
   *
   * This only ever fills the form. The promoter has already approved the
   * numbers on the review screen, and they still have to press Save here --
   * two gates, on purpose, because a settlement is the record of what a night
   * actually cost.
   */
  const applyExtracted = (e: Extracted) => {
    if (!settlement) return;
    const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const updated = { ...settlement };

    // Ticket counts, matched to the tiers already on the settlement by name.
    // An unmatched tier from the document is left for the promoter rather than
    // guessed into a row it might not belong to.
    if (Array.isArray(e.ticket_tiers) && e.ticket_tiers.length > 0) {
      updated.actual_attendance = updated.actual_attendance.map((tier) => {
        const hit = e.ticket_tiers.find(
          (t) => t.type && tier.type && t.type.toLowerCase().trim() === tier.type.toLowerCase().trim(),
        );
        return hit && hit.sold != null ? { ...tier, actual_sold: n(hit.sold) } : tier;
      });
    }

    // Expense lines go in under the category the document put them in.
    if (Array.isArray(e.expenses) && e.expenses.length > 0) {
      const bucket: Record<string, string> = {
        venue: 'general', staffing: 'general', hospitality: 'general', other: 'general',
        production: 'production', marketing: 'marketing', travel: 'talent',
      };
      const next: any = { ...updated.actual_expenses };
      for (const line of e.expenses) {
        if (!line.label) continue;
        const cat = bucket[line.category] ?? 'general';
        const key = line.label.toLowerCase().trim().replace(/\s+/g, '_');
        next[cat] = { ...(next[cat] || {}), [key]: n(line.amount) };
      }
      updated.actual_expenses = next;
    }

    // Where the money came in, when the document broke it out.
    if (Array.isArray(e.revenue_channels) && e.revenue_channels.length > 0) {
      updated.actual_revenue_channels = e.revenue_channels.map((c, i) => ({
        id: `rc_import_${i}`,
        label: c.label || 'Unnamed channel',
        gross: n(c.gross),
        fees: n(c.fees),
      }));
    }

    setSettlement(calculateActuals(updated));
  };

  const handleSave = async () => {
    if (!settlement || !offer) {
      alert('Settlement or offer data is missing');
      return;
    }

    if (!organization) {
      alert('Organization not found. Please refresh the page.');
      return;
    }

    const requiredFields = {
      offer_id: settlement.offer_id,
      organization_id: organization.id,
      artist_name: offer.show.artist_name,
      show_date: offer.show.event_date,
    };

    console.log('Validating required fields:', requiredFields);

    if (!requiredFields.offer_id) {
      alert('Offer ID is missing');
      return;
    }

    if (!requiredFields.organization_id) {
      alert('Organization ID is missing');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const settlementData = {
        ...settlement,
        organization_id: organization.id,
        user_id: user.id,
        settled_at: new Date().toISOString(),
      };

      console.log('Saving settlement:', settlementData);

      if (settlement.id) {
        console.log('Updating existing settlement:', settlement.id);
        const { error } = await supabase
          .from('settlements')
          .update(settlementData)
          .eq('id', settlement.id);

        if (error) {
          console.error('Settlement update failed:', {
            message: error.message,
            details: error.details,
            code: error.code,
            hint: error.hint
          });
          throw error;
        }
      } else {
        console.log('Inserting new settlement');
        const { data, error } = await supabase
          .from('settlements')
          .insert([settlementData])
          .select()
          .single();

        if (error) {
          console.error('Settlement insert failed:', {
            message: error.message,
            details: error.details,
            code: error.code,
            hint: error.hint
          });
          throw error;
        }

        console.log('Settlement created successfully:', data);
        setSettlement({ ...settlement, id: data.id });
      }

      console.log('Updating offer status to settled');
      const { error: offerError } = await supabase
        .from('offers')
        .update({
          is_settled: true,
          actual_profit: settlement.actual_profit,
          status: 'settled'
        })
        .eq('id', offer.id);

      if (offerError) {
        console.error('Offer update failed:', {
          message: offerError.message,
          details: offerError.details,
          code: offerError.code,
          hint: offerError.hint
        });
        throw offerError;
      }

      console.log('Settlement saved successfully!');
      alert('Settlement saved successfully!');
    } catch (error: any) {
      console.error('Settlement save failed:', {
        message: error.message,
        details: error.details,
        code: error.code,
        hint: error.hint,
        fullError: error
      });
      alert('Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = () => {
    if (offer && settlement) {
      generateSettlementPDF(offer, settlement, companySettings);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1140F0] flex items-center justify-center">
        <div className="text-gray-400">Loading settlement data...</div>
      </div>
    );
  }

  if (!offer || !settlement) {
    return null;
  }

  const VarianceIndicator = ({ variance }: { variance: number }) => {
    if (variance === 0) return <span className="text-gray-500">—</span>;
    const isPositive = variance > 0;
    return (
      <div className={`flex items-center gap-1 ${isPositive ? 'text-[#8FD3FF]' : 'text-red-500'}`}>
        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        <span className="font-semibold">{formatCurrency(Math.abs(variance))}</span>
      </div>
    );
  };

  const eventDate = parseLocalDate(offer.show.event_date);
  const formattedDate = eventDate ? eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Invalid date';

  const totalSold = settlement.actual_attendance.reduce((sum, tier) => sum + tier.actual_sold, 0);
  const totalCapacity = settlement.actual_attendance.reduce((sum, tier) => sum + tier.projected_sold, 0);
  const capacityPercentage = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#1140F0]">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <button
          onClick={() => navigate(`/offers/${id}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Offer
        </button>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">
                {offer.show.event_name || offer.show.artist_name}
              </h1>
              <div className={`${
                settlement.settled_at
                  ? 'bg-[#8FD3FF] text-[#04214D]'
                  : 'bg-yellow-500/20 text-yellow-500'
              } border-0 rounded-full px-4 py-1 text-sm font-semibold`}>
                {settlement.settled_at ? 'Settled' : 'Draft'}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-400 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{offer.show.venue_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                <span>{offer.show.artist_name}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:flex items-center gap-3">
            <button
              onClick={handleExportPDF}
              className="bg-[#14171E] border border-gray-700 text-white hover:border-[#8FD3FF] hover:text-[#8FD3FF] px-4 py-2.5 rounded-2xl font-medium transition-all flex items-center justify-center gap-2"
            >
              <FileDown className="h-4 w-4" />
              Export PDF
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#8FD3FF] text-[#04214D] hover:bg-[#6FB8F2] px-4 lg:px-6 py-2.5 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-5 w-5" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-2 border-blue-500/30 rounded-3xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                <Ticket className="h-6 w-6 text-blue-500" />
              </div>
              {settlement.variance_revenue > 0 ? (
                <TrendingUp className="h-5 w-5 text-blue-500" />
              ) : settlement.variance_revenue < 0 ? (
                <TrendingDown className="h-5 w-5 text-red-500" />
              ) : null}
            </div>
            <p className="text-gray-400 text-sm mb-1">Gross Revenue</p>
            <p className="text-3xl font-bold text-white mb-1">
              {formatCurrency(settlement.actual_revenue)}
            </p>
            <p className="text-blue-500 text-xs">
              {totalSold} / {totalCapacity} tickets ({capacityPercentage}% capacity)
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-2 border-orange-500/30 rounded-3xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center">
                <Receipt className="h-6 w-6 text-orange-500" />
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-1">Total Expenses</p>
            <p className="text-3xl font-bold text-white mb-1">
              {formatCurrency(settlement.actual_total_expenses)}
            </p>
            <p className="text-orange-500 text-xs">
              vs {formatCurrency(offer.calculations.totalExpenses)} projected
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-2 border-purple-500/30 rounded-3xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-500" />
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-1">Artist Payment</p>
            <p className="text-3xl font-bold text-white mb-1">
              {formatCurrency(offer.calculations.artistTotalPayout)}
            </p>
            <p className="text-purple-500 text-xs">
              {offer.artist_deposit > 0 ? `${formatCurrency(offer.artist_deposit)} deposit paid` : offer.deal_type.replace(/_/g, ' ')}
            </p>
          </div>

          <div className={`bg-gradient-to-br rounded-3xl p-6 border-2 ${
            settlement.actual_profit >= 0
              ? 'from-[#8FD3FF]/10 to-green-500/10 border-[#8FD3FF]/30'
              : 'from-red-500/10 to-red-600/10 border-red-500/30'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                settlement.actual_profit >= 0 ? 'bg-[#8FD3FF]/20' : 'bg-red-500/20'
              }`}>
                <Wallet className={`h-6 w-6 ${
                  settlement.actual_profit >= 0 ? 'text-[#8FD3FF]' : 'text-red-500'
                }`} />
              </div>
              {settlement.actual_profit >= 0 ? (
                <TrendingUp className="h-5 w-5 text-[#8FD3FF]" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
            </div>
            <p className="text-gray-400 text-sm mb-1">Your Profit</p>
            <p className={`text-3xl font-bold mb-1 ${
              settlement.actual_profit >= 0 ? 'text-[#8FD3FF]' : 'text-red-500'
            }`}>
              {settlement.actual_profit >= 0 ? '+' : ''}{formatCurrency(settlement.actual_profit)}
            </p>
            <p className={`text-xs ${
              settlement.actual_profit >= 0 ? 'text-[#8FD3FF]' : 'text-red-500'
            }`}>
              {settlement.variance_profit !== 0 && `${settlement.variance_profit >= 0 ? '+' : ''}${formatCurrency(Math.abs(settlement.variance_profit))} vs projected`}
              {settlement.variance_profit === 0 && (settlement.actual_profit >= 0 ? 'Profit' : 'Loss')}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Ticket Sales</h2>
                <div className="bg-blue-500/20 text-blue-400 border-0 rounded-full px-3 py-1 text-sm">
                  {capacityPercentage}% Capacity
                </div>
              </div>

              <div className="space-y-3">
                {settlement.actual_attendance.map((tier, index) => (
                  <div key={index} className="p-4 bg-[#0B0D12] rounded-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white font-semibold">{tier.type}</p>
                        <p className="text-gray-500 text-sm">{formatCurrency(tier.price)} per ticket</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold text-lg">
                          {formatCurrency(tier.actual_sold * tier.price)}
                        </p>
                        <p className="text-gray-500 text-sm">
                          Projected: {tier.projected_sold}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <label className="text-sm text-gray-400 flex-shrink-0">Actual Sold:</label>
                      <input
                        type="number"
                        min="0"
                        value={tier.actual_sold}
                        onChange={(e) => handleAttendanceChange(index, e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#1140F0] border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#8FD3FF] focus:border-transparent"
                      />
                    </div>

                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-[#8FD3FF] h-2 rounded-full transition-all"
                        style={{ width: `${tier.projected_sold > 0 ? Math.min((tier.actual_sold / tier.projected_sold) * 100, 100) : 0}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-5 bg-[#8FD3FF]/10 border-2 border-[#8FD3FF]/30 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8FD3FF] font-semibold">Total Gross Revenue</p>
                    <p className="text-gray-400 text-sm">
                      {totalSold} tickets sold
                    </p>
                  </div>
                  <p className="text-[#8FD3FF] font-bold text-2xl">
                    {formatCurrency(settlement.actual_revenue)}
                  </p>
                </div>
              </div>

              <RevenueChannelsPanel
                channels={readRevenueChannels(settlement)}
                recordedGross={settlement.actual_revenue}
                feesInExpenses={feesAlsoInExpenses(settlement)}
                onChange={(channels) =>
                  setSettlement({ ...settlement, actual_revenue_channels: channels })
                }
              />
            </div>

            {organization && canImportDocuments((organization as any).subscription_tier || 'starter') && (
              <SettlementImport
                offer={offer}
                organizationId={organization.id}
                onApply={applyExtracted}
              />
            )}

            <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Expenses</h2>
                <button
                  onClick={handleAddCategory}
                  className="flex items-center gap-1 text-sm text-[#8FD3FF] hover:text-[#6FB8F2] font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Category
                </button>
              </div>

              <div className="space-y-4">
                {offer.support_acts && offer.support_acts.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-gray-400 text-sm font-semibold uppercase">Support Acts</h3>
                    </div>
                    <div className="space-y-2">
                      {offer.support_acts.map((act, index) => (
                        <div key={index} className="flex items-center gap-2 p-3 bg-[#0B0D12] rounded-xl">
                          <span className="text-white flex-1">{act.name}</span>
                          <span className="text-gray-400 text-sm">{formatCurrency(act.guarantee)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(() => {
                  let accommodationTotal = 0;
                  if (offer?.include_hotel && offer?.hotel_budget) {
                    accommodationTotal += offer.hotel_budget * (offer.hotel_nights || 1);
                  }
                  if (offer?.include_transport && offer?.transport_budget) {
                    accommodationTotal += offer.transport_budget;
                  }
                  if (offer?.include_rider && offer?.rider_cap) {
                    accommodationTotal += offer.rider_cap;
                  }

                  if (accommodationTotal > 0) {
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-gray-400 text-sm font-semibold uppercase">Artist Accommodations</h3>
                        </div>
                        <div className="space-y-2">
                          {offer.include_hotel && offer.hotel_budget && offer.hotel_budget > 0 && (
                            <div className="flex items-center gap-2 p-3 bg-[#0B0D12] rounded-xl">
                              <span className="text-white flex-1">Hotel ({offer.hotel_nights || 1} nights)</span>
                              <span className="text-gray-400 text-sm">{formatCurrency(offer.hotel_budget * (offer.hotel_nights || 1))}</span>
                            </div>
                          )}
                          {offer.include_transport && offer.transport_budget && offer.transport_budget > 0 && (
                            <div className="flex items-center gap-2 p-3 bg-[#0B0D12] rounded-xl">
                              <span className="text-white flex-1">Ground Transport</span>
                              <span className="text-gray-400 text-sm">{formatCurrency(offer.transport_budget)}</span>
                            </div>
                          )}
                          {offer.include_rider && offer.rider_cap && offer.rider_cap > 0 && (
                            <div className="flex items-center gap-2 p-3 bg-[#0B0D12] rounded-xl">
                              <span className="text-white flex-1">Rider/Hospitality</span>
                              <span className="text-gray-400 text-sm">{formatCurrency(offer.rider_cap)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {(() => {
                  const totalSellable = settlement.actual_attendance.reduce((sum, tier) => sum + tier.actual_sold, 0);
                  const actualRevenue = settlement.actual_revenue;
                  const salesTax = actualRevenue * (offer.sales_tax_pct / 100);
                  const netGross = actualRevenue - salesTax;

                  const facilityFees = totalSellable * (offer.facility_fee_per_ticket || 0);
                  const ascap = netGross * (offer.ascap_rate || 0);
                  const bmi = netGross * (offer.bmi_rate || 0);
                  const sesac = netGross * (offer.sesac_rate || 0);
                  const insurance = totalSellable * (offer.insurance_per_attendee || 0);
                  const ccFee = netGross * (offer.cc_fee_rate || 0);
                  const variableTotal = facilityFees + ascap + bmi + sesac + insurance + ccFee;

                  if (variableTotal > 0) {
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-gray-400 text-sm font-semibold uppercase">Variable Expenses</h3>
                        </div>
                        <div className="space-y-2">
                          {facilityFees > 0 && (
                            <div className="flex items-center gap-2 p-3 bg-[#0B0D12] rounded-xl">
                              <span className="text-white flex-1">Facility Fees ({formatCurrency(offer.facility_fee_per_ticket || 0)}/ticket)</span>
                              <span className="text-gray-400 text-sm">{formatCurrency(facilityFees)}</span>
                            </div>
                          )}
                          {ascap > 0 && (
                            <div className="flex items-center gap-2 p-3 bg-[#0B0D12] rounded-xl">
                              <span className="text-white flex-1">ASCAP ({((offer.ascap_rate || 0) * 100).toFixed(2)}%)</span>
                              <span className="text-gray-400 text-sm">{formatCurrency(ascap)}</span>
                            </div>
                          )}
                          {bmi > 0 && (
                            <div className="flex items-center gap-2 p-3 bg-[#0B0D12] rounded-xl">
                              <span className="text-white flex-1">BMI ({((offer.bmi_rate || 0) * 100).toFixed(2)}%)</span>
                              <span className="text-gray-400 text-sm">{formatCurrency(bmi)}</span>
                            </div>
                          )}
                          {sesac > 0 && (
                            <div className="flex items-center gap-2 p-3 bg-[#0B0D12] rounded-xl">
                              <span className="text-white flex-1">SESAC ({((offer.sesac_rate || 0) * 100).toFixed(4)}%)</span>
                              <span className="text-gray-400 text-sm">{formatCurrency(sesac)}</span>
                            </div>
                          )}
                          {insurance > 0 && (
                            <div className="flex items-center gap-2 p-3 bg-[#0B0D12] rounded-xl">
                              <span className="text-white flex-1">Insurance ({formatCurrency(offer.insurance_per_attendee || 0)}/attendee)</span>
                              <span className="text-gray-400 text-sm">{formatCurrency(insurance)}</span>
                            </div>
                          )}
                          {ccFee > 0 && (
                            <div className="flex items-center gap-2 p-3 bg-[#0B0D12] rounded-xl">
                              <span className="text-white flex-1">CC Processing ({((offer.cc_fee_rate || 0) * 100).toFixed(1)}%)</span>
                              <span className="text-gray-400 text-sm">{formatCurrency(ccFee)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {Object.keys(settlement.actual_expenses).map((category) => {
                  const categoryKey = category as keyof Settlement['actual_expenses'];
                  const categoryExpenses = settlement.actual_expenses[categoryKey];
                  const estimatedExpenses = offer.expenses[categoryKey] || {};

                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-gray-400 text-sm font-semibold uppercase">{category.replace(/_/g, ' ')}</h3>
                        <button
                          onClick={() => handleAddExpense(categoryKey)}
                          className="flex items-center gap-1 text-xs text-[#8FD3FF] hover:text-[#6FB8F2] font-medium"
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {Object.keys(categoryExpenses).length === 0 ? (
                          <div className="text-sm text-gray-500 italic py-2 px-3 bg-[#0B0D12] rounded-xl">No expenses in this category</div>
                        ) : (
                          Object.keys(categoryExpenses).map((expenseKey) => (
                            <div key={expenseKey} className="flex items-center gap-2 p-3 bg-[#0B0D12] rounded-xl">
                              <span className="text-white flex-1">{expenseKey.replace(/_/g, ' ')}</span>
                              <div className="flex items-center gap-2">
                                {estimatedExpenses[expenseKey] !== undefined && (
                                  <span className="text-xs text-gray-500">
                                    Est: {formatCurrency(estimatedExpenses[expenseKey])}
                                  </span>
                                )}
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={categoryExpenses[expenseKey] || 0}
                                  onChange={(e) => handleExpenseChange(categoryKey, expenseKey, e.target.value)}
                                  className="w-32 px-2 py-1.5 bg-[#1140F0] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8FD3FF] focus:border-transparent"
                                />
                                <button
                                  onClick={() => handleDeleteExpense(categoryKey, expenseKey)}
                                  className="text-red-500 hover:text-red-400 p-1"
                                  title="Delete expense"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="h-px bg-gray-700 my-4"></div>

                <div className="flex items-center justify-between p-4 bg-red-500/10 border-2 border-red-500/30 rounded-2xl">
                  <span className="text-red-400 font-bold">Total Expenses</span>
                  <span className="text-red-400 font-bold text-xl">
                    {formatCurrency(settlement.actual_total_expenses)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#8FD3FF]/10 to-green-500/10 border-2 border-[#8FD3FF] rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-[#8FD3FF]/20 rounded-2xl flex items-center justify-center">
                  <Users className="h-6 w-6 text-[#8FD3FF]" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Artist Payment</h2>
                  <p className="text-gray-400 text-sm">{offer.show.artist_name}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Deal Structure</p>
                  <p className="text-white font-semibold capitalize">{offer.deal_type.replace(/_/g, ' ')}</p>
                </div>

                {offer.deal_type === 'guarantee' && offer.guarantee_amount > 0 && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-yellow-400 text-sm">Guarantee</span>
                      <span className="text-yellow-400 font-bold">
                        {formatCurrency(offer.guarantee_amount)}
                      </span>
                    </div>
                  </div>
                )}

                {offer.artist_deposit > 0 && (
                  <>
                    <div className="h-px bg-[#8FD3FF]/30"></div>
                    <div>
                      <p className="text-gray-400 text-sm mb-2">Payment Schedule</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 bg-[#0B0D12] rounded-xl">
                          <div>
                            <span className="text-white text-sm block">Deposit Paid</span>
                            <span className="text-gray-500 text-xs">Already paid upfront</span>
                          </div>
                          <span className="text-green-500 font-semibold">
                            {formatCurrency(offer.artist_deposit)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-[#8FD3FF]/10 rounded-xl">
                          <div>
                            <span className="text-white text-sm block">Balance Due</span>
                            <span className="text-gray-400 text-xs">Due at settlement</span>
                          </div>
                          <span className="text-[#8FD3FF] font-semibold">
                            {formatCurrency(offer.calculations.artistTotalPayout - offer.artist_deposit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="h-px bg-[#8FD3FF]"></div>

                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">Total Artist Payment</span>
                  <span className="text-[#8FD3FF] font-bold text-2xl">
                    {formatCurrency(offer.calculations.artistTotalPayout)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-6">
              <h2 className="text-white font-bold mb-4">Settlement Summary</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Gross Revenue</span>
                  <span className="text-white font-semibold">
                    {formatCurrency(settlement.actual_revenue)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Total Expenses</span>
                  <span className="text-orange-500 font-semibold">
                    -{formatCurrency(settlement.actual_total_expenses)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Artist Payment</span>
                  <span className="text-orange-500 font-semibold">
                    -{formatCurrency(offer.calculations.artistTotalPayout)}
                  </span>
                </div>

                <div className="h-px bg-gray-700"></div>

                <div className={`flex items-center justify-between p-4 rounded-2xl border-2 ${
                  settlement.actual_profit >= 0
                    ? 'bg-[#8FD3FF]/10 border-[#8FD3FF]/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <span className={`font-bold ${
                    settlement.actual_profit >= 0 ? 'text-[#8FD3FF]' : 'text-red-500'
                  }`}>
                    Your {settlement.actual_profit >= 0 ? 'Profit' : 'Loss'}
                  </span>
                  <span className={`font-bold text-2xl ${
                    settlement.actual_profit >= 0 ? 'text-[#8FD3FF]' : 'text-red-500'
                  }`}>
                    {settlement.actual_profit >= 0 ? '+' : ''}{formatCurrency(settlement.actual_profit)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-6">
              <h2 className="text-white font-bold mb-3">Variance Analysis</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#0B0D12] rounded-xl">
                  <span className="text-gray-400 text-sm">Revenue vs Projected</span>
                  <VarianceIndicator variance={settlement.variance_revenue} />
                </div>

                <div className="flex items-center justify-between p-3 bg-[#0B0D12] rounded-xl">
                  <span className="text-gray-400 text-sm">Expenses vs Projected</span>
                  <VarianceIndicator variance={-settlement.variance_expenses} />
                </div>

                <div className="flex items-center justify-between p-3 bg-[#0B0D12] rounded-xl">
                  <span className="text-gray-400 text-sm">Profit vs Projected</span>
                  <VarianceIndicator variance={settlement.variance_profit} />
                </div>
              </div>
            </div>

            <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-6">
              <h2 className="text-white font-bold mb-3">Settlement Notes</h2>
              <textarea
                value={settlement.notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Add any notes about the settlement, issues encountered, or other relevant information..."
                rows={6}
                className="w-full px-3 py-2 bg-[#0B0D12] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#8FD3FF] focus:border-transparent text-sm"
              />
            </div>

            {settlement.variance_profit !== 0 && (
              <div className={`rounded-2xl p-4 flex items-start gap-3 ${
                settlement.variance_profit > 0 ? 'bg-[#8FD3FF]/10 border-2 border-[#8FD3FF]/30' : 'bg-yellow-500/10 border-2 border-yellow-500/30'
              }`}>
                <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  settlement.variance_profit > 0 ? 'text-[#8FD3FF]' : 'text-yellow-500'
                }`} />
                <div>
                  <div className={`font-semibold ${
                    settlement.variance_profit > 0 ? 'text-white' : 'text-white'
                  }`}>
                    {settlement.variance_profit > 0 ? 'Performance Above Projection' : 'Performance Below Projection'}
                  </div>
                  <div className={`text-sm mt-1 ${
                    settlement.variance_profit > 0 ? 'text-gray-300' : 'text-gray-300'
                  }`}>
                    The actual profit is {formatCurrency(Math.abs(settlement.variance_profit))} {settlement.variance_profit > 0 ? 'higher' : 'lower'} than projected.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


/**
 * Where the money came in.
 *
 * One gross figure cannot be checked. Split by channel it can: the rows have to
 * add up to the gross, and when they do not the panel says which way it is out
 * and what that usually means. On After Hours Vol 1 the ~$360 of door card taps
 * may have run through the same online link as the app sales, which would have
 * meant the night lost $360 more than the settlement said -- and nothing in the
 * document could have told you.
 */
function RevenueChannelsPanel({
  channels,
  recordedGross,
  feesInExpenses,
  onChange,
}: {
  channels: RevenueChannel[];
  recordedGross: number;
  feesInExpenses: number;
  onChange: (c: RevenueChannel[]) => void;
}) {
  const rows = channels.length > 0 ? channels : [];
  const t = channelTotals(rows, recordedGross);
  const note = reconciliationNote(t);
  const doubleCountedFees = feesInExpenses > 0 && t.fees > 0;

  const patch = (id: string, p: Partial<RevenueChannel>) =>
    onChange(rows.map((c) => (c.id === id ? { ...c, ...p } : c)));

  const numCls =
    'w-28 bg-[#14171E] border border-gray-700 text-white text-sm rounded-lg px-2 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-[#8FD3FF]';

  return (
    <div className="mt-4 bg-[#0B0D12] border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-white">Where the money came in</h3>
        {rows.length === 0 && (
          <button
            type="button"
            onClick={() => onChange(defaultRevenueChannels())}
            className="text-[11px] text-[#8FD3FF] hover:underline"
          >
            Set it up
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mb-4">
        Split the gross by how it was taken. If the rows do not add up to the gross, something is
        missing or counted twice — and you will be told which.
      </p>

      {rows.length === 0 ? (
        <p className="text-xs text-gray-600">
          Not broken out. The report will show one gross figure with nothing behind it.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-1 px-1">
            <span className="flex-1">Channel</span>
            <span className="w-28 text-right">Gross</span>
            <span className="w-28 text-right">Fees kept</span>
            <span className="w-24 text-right">Net</span>
            <span className="w-6" />
          </div>

          <div className="space-y-2">
            {rows.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <input
                  value={c.label}
                  placeholder="Channel name"
                  onChange={(e) => patch(c.id, { label: e.target.value })}
                  className="flex-1 min-w-0 bg-[#14171E] border border-gray-700 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#8FD3FF]"
                />
                <input
                  type="number" step="0.01" value={c.gross || ''} placeholder="0"
                  onChange={(e) => patch(c.id, { gross: parseFloat(e.target.value) || 0 })}
                  className={numCls}
                />
                <input
                  type="number" step="0.01" value={c.fees || ''} placeholder="0"
                  onChange={(e) => patch(c.id, { fees: parseFloat(e.target.value) || 0 })}
                  className={numCls}
                />
                <span className="w-24 text-right text-sm text-gray-300">
                  {formatCurrency((c.gross || 0) - (c.fees || 0))}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((r) => r.id !== c.id))}
                  title="Remove this channel"
                  className="w-6 text-gray-600 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onChange([...rows, newRevenueChannel()])}
            className="w-full mt-3 py-2 border border-dashed border-gray-700 rounded-lg text-[11px] text-gray-500 hover:border-[#8FD3FF] hover:text-[#8FD3FF] transition-colors"
          >
            + Add a channel
          </button>

          <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between text-sm">
            <span className="text-gray-400">Channels add up to</span>
            <span className={`font-bold ${t.reconciles ? 'text-white' : 'text-orange-400'}`}>
              {formatCurrency(t.gross)}
              <span className="text-gray-500 font-normal"> of {formatCurrency(t.recordedGross)}</span>
            </span>
          </div>

          {note && (
            <p className="mt-2 text-[11px] text-orange-400 leading-relaxed">{note}</p>
          )}
          {t.used && t.reconciles && (
            <p className="mt-2 text-[11px] text-green-400">
              Reconciles. Net after fees: {formatCurrency(t.net)}.
            </p>
          )}
          {doubleCountedFees && (
            <p className="mt-2 text-[11px] text-orange-400 leading-relaxed">
              You have {formatCurrency(feesInExpenses)} of fees in the expense list AND
              {' '}{formatCurrency(t.fees)} entered here. Counted on both sides, the night looks
              worse than it was — keep them in one place.
            </p>
          )}
        </>
      )}
    </div>
  );
}
