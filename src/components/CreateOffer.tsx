import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { TicketTier, Expenses, OfferStatus, SupportAct, Template } from '../types';
import { ExtraRevenuePanel } from './ExtraRevenuePanel';
import type { ExtraRevenueLine } from '../types';
import { calculateOffer } from '../lib/calculations';
import { EventDetailsTab } from './tabs/EventDetailsTab';
import { ArtistDealTab } from './tabs/ArtistDealTab';
import { DepositsTab } from './tabs/DepositsTab';
import { TicketScalingTab } from './tabs/TicketScalingTab';
import { ExpensesTab } from './tabs/ExpensesTab';
import { SummaryTab } from './tabs/SummaryTab';
import { WizardHeader } from './WizardHeader';
import { ArrowLeft, ArrowRight, Check, FileText, X, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { findExistingShow, isDuplicateShowError } from '../lib/duplicateShow';

// A rate box the user cleared yields NaN; NaN serializes to null and silently
// wipes the column. Never let that reach the database.
const safeNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

interface ArtistDeduction {
  name: string;
  amount: number;
}


export function CreateOffer() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showInitialModal, setShowInitialModal] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  const [eventName, setEventName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [capacity, setCapacity] = useState<number>(0);
  const [mode] = useState<'estimate' | 'settlement'>('estimate');
  const [status] = useState<OfferStatus>('planning');
  const [venueStreet, setVenueStreet] = useState('');
  const [venueCity, setVenueCity] = useState('');
  const [venueState, setVenueState] = useState('');
  const [venueZip, setVenueZip] = useState('');

  const [facilityFeePerTicket, setFacilityFeePerTicket] = useState<number>(2.00);
  const [ageLimit, setAgeLimit] = useState<string>('All Ages');
  const [doorsTime, setDoorsTime] = useState<string>('20:00');
  const [doorsDuration, setDoorsDuration] = useState<number>(60);
  const [showTime, setShowTime] = useState<string>('21:00');
  const [showDuration, setShowDuration] = useState<number>(240);
  const [curfewTime, setCurfewTime] = useState<string>('01:00');

  const [dealType, setDealType] = useState<string>('flat_fee');
  const [guarantee, setGuarantee] = useState<number>(0);
  const [artistPercentage, setArtistPercentage] = useState<number>(100);
  const [taxWithholdingPct, setTaxWithholdingPct] = useState<number>(2);
  const [depositPct, setDepositPct] = useState<number>(20);
  const [artistBackendPct, setArtistBackendPct] = useState<number>(85);
  const [promoterBackendPct, setPromoterBackendPct] = useState<number>(15);
  const [depositDueTiming, setDepositDueTiming] = useState<string>('30_days_before');
  const [customDepositDate, setCustomDepositDate] = useState<string>('');
  const [artistDepositStatus, setArtistDepositStatus] = useState<string>('pending');
  const [balanceDueTiming, setBalanceDueTiming] = useState<string>('at_settlement');
  const [customBalanceDueDate, setCustomBalanceDueDate] = useState<string>('');
  const [venueDeposit, setVenueDeposit] = useState<number>(0);
  const [venueDepositDueDate, setVenueDepositDueDate] = useState<string>('');
  const [venueDepositStatus, setVenueDepositStatus] = useState<string>('pending');

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<string>('deposit_balance');
  const [settlementDays, setSettlementDays] = useState<number>(7);
  const [fullPaymentDueDate, setFullPaymentDueDate] = useState<string>('');

  const [merchRateSoft, setMerchRateSoft] = useState<number>(100);
  const [merchRateHard, setMerchRateHard] = useState<number>(100);
  const [artistDeductions, setArtistDeductions] = useState<ArtistDeduction[]>([]);

  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([
    { type: 'GA', allotment: 0, comps: 0, price: 0 }
  ]);
  const [salesTaxPct, setSalesTaxPct] = useState<number>(13.18);
  const [includeExtraRevenue, setIncludeExtraRevenue] = useState(false);
  const [extraRevenue, setExtraRevenue] = useState<ExtraRevenueLine[]>([]);
  const [compsArtist, setCompsArtist] = useState<number>(0);
  const [compsVenue, setCompsVenue] = useState<number>(0);
  const [compsPromoter, setCompsPromoter] = useState<number>(0);

  const [expenses, setExpenses] = useState<Expenses>({
    talent: { rider_hospitality: 0 },
    general: { security: 0, emt: 0, gate_staff: 0 },
    marketing: { radio: 0, marketing: 0, paid_social: 0 },
    production: { production: 0, crew_stagehands: 0, camera_operator: 0, technical_director: 0 }
  });

  const [ascapRate, setAscapRate] = useState<number>(0.0023);
  const [bmiRate, setBmiRate] = useState<number>(0.003);
  const [sesacRate, setSesacRate] = useState<number>(0.000214);
  const [insurancePerAttendee, setInsurancePerAttendee] = useState<number>(0.62);
  const [ccFeeRate, setCcFeeRate] = useState<number>(0.012);

  const [supportActs, setSupportActs] = useState<SupportAct[]>([]);

  // Accommodation state
  const [includeHotel, setIncludeHotel] = useState<boolean>(false);
  const [hotelBudget, setHotelBudget] = useState<number>(0);
  const [hotelNights, setHotelNights] = useState<number>(1);
  const [hotelNotes, setHotelNotes] = useState<string>('');
  const [includeTransport, setIncludeTransport] = useState<boolean>(false);
  const [transportBudget, setTransportBudget] = useState<number>(0);
  const [transportNotes, setTransportNotes] = useState<string>('');
  const [includeFlights, setIncludeFlights] = useState<boolean>(false);
  const [flightBudget, setFlightBudget] = useState<number>(0);
  const [flightNotes, setFlightNotes] = useState<string>('');
  const [includeRider, setIncludeRider] = useState<boolean>(false);
  const [riderCap, setRiderCap] = useState<number>(100);
  const [riderNotes, setRiderNotes] = useState<string>('');

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.template-selector-container')) {
        setShowTemplateSelector(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTemplateSelector(false);
      }
    };

    if (showTemplateSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showTemplateSelector]);

  const loadTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!memberData?.organization_id) return;

      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('organization_id', memberData.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  /**
   * The Templates page hands a template over in router state when the promoter
   * presses Use. Nothing here ever read it, so that button navigated to a blank
   * create form and the template was silently dropped -- the feature looked
   * broken from the only place it is advertised.
   */
  const handedOverRef = useRef(false);
  useEffect(() => {
    if (handedOverRef.current) return;
    const handed = (location.state as any)?.template;
    if (!handed) return;
    handedOverRef.current = true;
    loadTemplate(handed as Template);
    // Clear it so a refresh does not re-apply over work already done.
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state]);

  const loadTemplate = (template: Template) => {
    setDealType(template.deal_type || 'flat_fee');
    setTaxWithholdingPct(template.tax_withholding_pct ?? 2);
    setDepositPct(template.deposit_pct ?? 20);
    setDepositDueTiming(template.deposit_due_timing || '30_days_before');
    setSalesTaxPct(template.sales_tax_pct ?? 13.18);

    // A template exists so the next show at this venue starts from the last
    // one. The rights, insurance and card-fee rates are part of that deal, and
    // they used to be dropped -- the template reproduced the tickets and the
    // expenses, then quietly reset the fees to the blank form's defaults.
    const t = template as any;
    if (t.facility_fee_per_ticket != null) setFacilityFeePerTicket(Number(t.facility_fee_per_ticket));
    if (t.ascap_rate != null) setAscapRate(Number(t.ascap_rate));
    if (t.bmi_rate != null) setBmiRate(Number(t.bmi_rate));
    if (t.sesac_rate != null) setSesacRate(Number(t.sesac_rate));
    if (t.insurance_per_attendee != null) setInsurancePerAttendee(Number(t.insurance_per_attendee));
    if (t.cc_fee_rate != null) setCcFeeRate(Number(t.cc_fee_rate));
    if (t.include_extra_revenue != null) setIncludeExtraRevenue(!!t.include_extra_revenue);
    if (Array.isArray(t.extra_revenue) && t.extra_revenue.length > 0) setExtraRevenue(t.extra_revenue);

    if (template.ticket_tier_templates && template.ticket_tier_templates.length > 0) {
      const tiers: TicketTier[] = template.ticket_tier_templates.map((tt) => ({
        type: tt.type || 'GA',
        allotment: tt.default_allotment || 0,
        comps: tt.default_comps || 0,
        price: tt.price || 0
      }));
      setTicketTiers(tiers);
    }

    if (template.expense_categories && template.expense_categories.length > 0) {
      const newExpenses: Expenses = {
        talent: {},
        general: {},
        marketing: {},
        production: {}
      };

      template.expense_categories.forEach((category) => {
        const key = category.title.toLowerCase();
        let targetCategory: 'talent' | 'general' | 'marketing' | 'production' = 'general';

        if (key === 'talent') targetCategory = 'talent';
        else if (key === 'marketing') targetCategory = 'marketing';
        else if (key === 'production') targetCategory = 'production';

        category.items?.forEach((item) => {
          newExpenses[targetCategory][item.name] = item.default_amount || 0;
        });
      });

      setExpenses(newExpenses);
    }

    setShowTemplateSelector(false);
    setShowInitialModal(false);
    setPreviewTemplate(null);
    setAppliedTemplate(template.name);
  };

  const startFromScratch = () => {
    setShowInitialModal(false);
  };

  const calculations = calculateOffer(
    ticketTiers,
    salesTaxPct,
    expenses,
    guarantee,
    taxWithholdingPct,
    dealType,
    mode,
    artistBackendPct,
    promoterBackendPct,
    supportActs,
    {
      includeHotel,
      hotelBudget,
      hotelNights,
      includeTransport,
      transportBudget,
      includeFlights,
      flightBudget,
      includeRider,
      riderCap
    },
    {
      ascapRate,
      bmiRate,
      sesacRate,
      insurancePerAttendee,
      ccFeeRate
    },
    { include: includeExtraRevenue, lines: extraRevenue }
  );

  const steps = [
    { number: 1, label: 'Event Info', title: 'Event Details' },
    { number: 2, label: 'Artist Deal', title: 'Artist Deal Structure' },
    { number: 3, label: 'Deposits', title: 'Deposit Information' },
    { number: 4, label: 'Tickets', title: 'Ticket Configuration' },
    { number: 5, label: 'Expenses', title: 'Event Expenses' },
    { number: 6, label: 'Review', title: 'Review & Submit' },
  ];

  const handleNext = () => {
    if (currentStep === 1) {
      if (!artistName || !venueName || !eventDate || capacity === 0) {
        alert('Please fill in all event details');
        return;
      }
    }
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
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

      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (memberError) throw memberError;

      if (!memberData?.organization_id) {
        alert('You must belong to an organization to create offers');
        navigate('/');
        return;
      }

      // Is this night already in here? Ask before writing anything, and say
      // exactly what was found, with the link, instead of making a second one.
      const existing = await findExistingShow(memberData.organization_id, artistName, venueName, eventDate);
      if (existing) {
        const open = confirm(
          `You already have ${existing.artistName} at ${existing.venueName} on ${existing.eventDate}` +
          ` (status: ${existing.status}).\n\nOpen that one instead? Cancel to stay here and change the date, artist or venue.`,
        );
        if (open && existing.offerId) navigate(`/offers/${existing.offerId}`);
        return;
      }

      const showId = `show_${Date.now()}`;
      const offerId = `offer_${Date.now()}`;

      const venueFullAddress = [
        venueStreet,
        `${venueCity}${venueState ? ', ' + venueState : ''}${venueZip ? ' ' + venueZip : ''}`
      ].filter(Boolean).join('\n');

      const { error: showError } = await supabase.from('shows').insert({
        id: showId,
        event_name: eventName || null,
        artist_name: artistName,
        venue_name: venueName,
        event_date: eventDate,
        capacity: capacity,
        user_id: user.id,
        organization_id: memberData.organization_id,
      });

      if (showError) throw showError;

      const { error: offerError } = await supabase.from('offers').insert({
        id: offerId,
        show_id: showId,
        mode: mode,
        status: status,
        deal_type: dealType,
        guarantee: guarantee,
        artist_percentage: artistPercentage,
        tax_withholding_pct: taxWithholdingPct,
        deposit_pct: depositPct,
        artist_backend_pct: artistBackendPct,
        promoter_backend_pct: promoterBackendPct,
        deposit_due_timing: depositDueTiming,
        deposit_due_date: customDepositDate,
        venue_street: venueStreet,
        venue_city: venueCity,
        venue_state: venueState,
        venue_zip: venueZip,
        venue_full_address: venueFullAddress,
        artist_deposit_status: artistDepositStatus,
        balance_due_timing: balanceDueTiming,
        custom_balance_due_date: customBalanceDueDate || null,
        venue_deposit: venueDeposit,
        venue_deposit_due_date: venueDepositDueDate,
        venue_deposit_status: venueDepositStatus,
        ticket_tiers: ticketTiers,
        sales_tax_pct: salesTaxPct,
        include_extra_revenue: includeExtraRevenue,
        extra_revenue: extraRevenue,
        expenses: expenses,
        calculations: calculations,
        support_acts: supportActs,
        user_id: user.id,
        organization_id: memberData.organization_id,
        facility_fee_per_ticket: facilityFeePerTicket,
        comps_artist: compsArtist,
        comps_venue: compsVenue,
        comps_promoter: compsPromoter,
        doors_time: doorsTime,
        doors_duration: doorsDuration,
        show_time: showTime,
        show_duration: showDuration,
        curfew_time: curfewTime,
        age_limit: ageLimit,
        merch_rate_soft: merchRateSoft,
        merch_rate_hard: merchRateHard,
        artist_deductions: artistDeductions,
        ascap_rate: safeNum(ascapRate),
        bmi_rate: safeNum(bmiRate),
        sesac_rate: safeNum(sesacRate),
        insurance_per_attendee: safeNum(insurancePerAttendee),
        cc_fee_rate: safeNum(ccFeeRate),
        include_hotel: includeHotel,
        hotel_budget: hotelBudget,
        hotel_nights: hotelNights,
        hotel_notes: hotelNotes,
        include_transport: includeTransport,
        transport_budget: transportBudget,
        transport_notes: transportNotes,
        include_flights: includeFlights,
        flight_budget: flightBudget,
        flight_notes: flightNotes,
        include_rider: includeRider,
        rider_cap: riderCap,
        rider_notes: riderNotes,
        payment_method: paymentMethod,
        settlement_days: settlementDays,
        full_payment_due_date: fullPaymentDueDate || null,
        offer_sent_date: new Date().toISOString().split('T')[0],
      });

      if (offerError) {
        // The show row went in and the offer did not. Left alone, that is an
        // orphan show that collides with the next attempt -- six of them piled
        // up for one night that way. Take it back out before reporting.
        await supabase.from('shows').delete().eq('id', showId);
        throw offerError;
      }

      navigate('/offers');
    } catch (error: any) {
      console.error('Error saving offer:', error);
      if (isDuplicateShowError(error)) {
        alert('That show is already in here: same artist, same venue, same night. Open it from your offers list instead of making another.');
      } else {
        alert('Failed to save offer. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1140F0]">
      {/* Initial Template Selection Modal */}
      {showInitialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#14171E] border border-gray-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 sm:p-8 border-b border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Create New Offer</h2>
                <button
                  onClick={() => navigate('/offers')}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <p className="text-gray-400">Start from scratch or use a template to speed up your workflow</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 sm:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <button
                  onClick={startFromScratch}
                  className="group relative bg-gradient-to-br from-[#22262F] to-[#14171E] hover:from-[#2A3040] hover:to-[#2A3040] border-2 border-gray-800 hover:border-[#8FD3FF]/50 rounded-2xl p-6 sm:p-8 text-left transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#8FD3FF]/10 rounded-xl flex items-center justify-center">
                      <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-[#8FD3FF]" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-600 group-hover:text-[#8FD3FF] transition-colors" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Start from Scratch</h3>
                  <p className="text-sm text-gray-400">Create a completely new offer with custom settings</p>
                </button>

                {templates.length > 0 ? (
                  <button
                    onClick={() => setShowTemplateSelector(true)}
                    className="group relative bg-gradient-to-br from-[#8FD3FF]/10 to-[#14171E] hover:from-[#8FD3FF]/20 hover:to-[#2A3040] border-2 border-[#8FD3FF]/30 hover:border-[#8FD3FF]/60 rounded-2xl p-6 sm:p-8 text-left transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#8FD3FF]/20 rounded-xl flex items-center justify-center">
                        <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-[#8FD3FF]" />
                      </div>
                      <ArrowRight className="h-5 w-5 text-[#8FD3FF]/60 group-hover:text-[#8FD3FF] transition-colors" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Use a Template</h3>
                    <p className="text-sm text-gray-400">{templates.length} template{templates.length !== 1 ? 's' : ''} available</p>
                  </button>
                ) : (
                  <div className="relative bg-[#22262F] border-2 border-dashed border-gray-700 rounded-2xl p-6 sm:p-8 text-center opacity-60">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-800/50 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-500 mb-2">No Templates Yet</h3>
                    <p className="text-sm text-gray-600">Create offers to save as templates</p>
                  </div>
                )}
              </div>

              {/* Template List */}
              {showTemplateSelector && templates.length > 0 && (
                <div className="space-y-3 template-selector-container">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Select a Template</h3>
                    <button
                      onClick={() => setShowTemplateSelector(false)}
                      className="text-gray-400 hover:text-white text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="bg-[#0B0D12] border border-gray-800 hover:border-[#8FD3FF]/50 rounded-xl p-4 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-white mb-1 truncate">{template.name}</h4>
                          {template.description && (
                            <p className="text-sm text-gray-400 line-clamp-2">{template.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setPreviewTemplate(template)}
                            className="px-3 py-1.5 bg-[#22262F] hover:bg-[#2A3040] text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => loadTemplate(template)}
                            className="px-3 py-1.5 bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-lg text-sm font-bold transition-colors"
                          >
                            Use
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Template Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#14171E] border border-gray-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white">{previewTemplate.name}</h2>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              {previewTemplate.description && (
                <p className="text-gray-400">{previewTemplate.description}</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div className="bg-[#0B0D12] rounded-xl p-4 border border-gray-800">
                  <h3 className="text-sm font-bold text-[#8FD3FF] mb-2">DEAL STRUCTURE</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-400">Deal Type</p>
                      <p className="text-white font-medium capitalize">{previewTemplate.deal_type.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Deposit %</p>
                      <p className="text-white font-medium">{previewTemplate.deposit_pct}%</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Tax Withholding</p>
                      <p className="text-white font-medium">{previewTemplate.tax_withholding_pct}%</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Sales Tax</p>
                      <p className="text-white font-medium">{previewTemplate.sales_tax_pct}%</p>
                    </div>
                  </div>
                </div>

                {previewTemplate.ticket_tier_templates && previewTemplate.ticket_tier_templates.length > 0 && (
                  <div className="bg-[#0B0D12] rounded-xl p-4 border border-gray-800">
                    <h3 className="text-sm font-bold text-[#8FD3FF] mb-2">TICKET TIERS</h3>
                    <div className="space-y-2">
                      {previewTemplate.ticket_tier_templates.map((tier, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">{tier.type}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-white font-medium">{tier.default_allotment || 0} tickets</span>
                            <span className="text-[#8FD3FF] font-bold">${tier.price || 0}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {previewTemplate.expense_categories && previewTemplate.expense_categories.length > 0 && (
                  <div className="bg-[#0B0D12] rounded-xl p-4 border border-gray-800">
                    <h3 className="text-sm font-bold text-[#8FD3FF] mb-2">EXPENSES</h3>
                    <div className="space-y-2 text-sm">
                      {previewTemplate.expense_categories.map((category: any, idx: number) => (
                        <div key={idx}>
                          <p className="text-gray-400 font-medium mb-1">{category.title}</p>
                          {category.items?.map((item: any, itemIdx: number) => (
                            <div key={itemIdx} className="flex items-center justify-between pl-3">
                              <span className="text-gray-500 text-xs">{item.name}</span>
                              <span className="text-white font-medium">${item.default_amount?.toLocaleString() || 0}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="flex-1 px-4 py-3 bg-[#22262F] hover:bg-[#2A3040] text-white rounded-xl font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => loadTemplate(previewTemplate)}
                className="flex-1 px-4 py-3 bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-xl font-bold transition-colors"
              >
                Use This Template
              </button>
            </div>
          </div>
        </div>
      )}

      <WizardHeader
        steps={steps}
        current={currentStep}
        onStep={setCurrentStep}
        onClose={() => navigate('/')}
        actions={templates.length > 0 ? (
          <div className="relative template-selector-container">
            <button
              onClick={() => setShowTemplateSelector(!showTemplateSelector)}
              title="Load a template"
              className="w-9 h-9 sm:w-auto sm:px-3 flex items-center justify-center gap-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#22262F] transition-colors text-xs font-medium"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Template</span>
            </button>
            {showTemplateSelector && (
              <div className="absolute right-0 mt-2 w-72 bg-[#14171E] rounded-xl shadow-lg border border-gray-700 z-20">
                <div className="p-2 max-h-96 overflow-y-auto">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => loadTemplate(template)}
                      className="w-full text-left p-3 hover:bg-[#22262F] rounded-lg transition-colors"
                    >
                      <div className="font-medium text-white">{template.name}</div>
                      {template.description && (
                        <div className="text-sm text-gray-400 mt-1">{template.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : undefined}
        note={appliedTemplate ? (
          <div className="flex items-center justify-between gap-3 text-[11px] text-[#8FD3FF]/80">
            <span className="truncate">Started from <b>{appliedTemplate}</b> — tickets, expenses and fees filled in.</span>
            <button onClick={() => setAppliedTemplate(null)} className="text-[#8FD3FF]/50 hover:text-[#8FD3FF] shrink-0">Dismiss</button>
          </div>
        ) : undefined}
      />

      {/* Main Form Content */}
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="bg-[#14171E] border border-gray-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8">
          {currentStep === 1 && (
            <EventDetailsTab
              eventName={eventName}
              setEventName={setEventName}
              artistName={artistName}
              setArtistName={setArtistName}
              venueName={venueName}
              setVenueName={setVenueName}
              eventDate={eventDate}
              setEventDate={setEventDate}
              capacity={capacity}
              setCapacity={setCapacity}
              mode={mode}
              venueStreet={venueStreet}
              setVenueStreet={setVenueStreet}
              venueCity={venueCity}
              setVenueCity={setVenueCity}
              venueState={venueState}
              setVenueState={setVenueState}
              venueZip={venueZip}
              setVenueZip={setVenueZip}
              facilityFeePerTicket={facilityFeePerTicket}
              setFacilityFeePerTicket={setFacilityFeePerTicket}
              ageLimit={ageLimit}
              setAgeLimit={setAgeLimit}
              doorsTime={doorsTime}
              setDoorsTime={setDoorsTime}
              doorsDuration={doorsDuration}
              setDoorsDuration={setDoorsDuration}
              showTime={showTime}
              setShowTime={setShowTime}
              showDuration={showDuration}
              setShowDuration={setShowDuration}
              curfewTime={curfewTime}
              setCurfewTime={setCurfewTime}
            />
          )}

          {currentStep === 2 && (
            <ArtistDealTab
              dealType={dealType}
              setDealType={setDealType}
              guarantee={guarantee}
              setGuarantee={setGuarantee}
              artistPercentage={artistPercentage}
              setArtistPercentage={setArtistPercentage}
              taxWithholdingPct={taxWithholdingPct}
              setTaxWithholdingPct={setTaxWithholdingPct}
              depositPct={depositPct}
              setDepositPct={setDepositPct}
              artistBackendPct={artistBackendPct}
              setArtistBackendPct={setArtistBackendPct}
              promoterBackendPct={promoterBackendPct}
              setPromoterBackendPct={setPromoterBackendPct}
              supportActs={supportActs}
              setSupportActs={setSupportActs}
              merchRateSoft={merchRateSoft}
              setMerchRateSoft={setMerchRateSoft}
              merchRateHard={merchRateHard}
              setMerchRateHard={setMerchRateHard}
              artistDeductions={artistDeductions}
              setArtistDeductions={setArtistDeductions}
              ticketTiers={ticketTiers}
              salesTaxPct={salesTaxPct}
              expenses={expenses}
              facilityFeePerTicket={facilityFeePerTicket}
              ascapRate={ascapRate}
              bmiRate={bmiRate}
              sesacRate={sesacRate}
              insurancePerAttendee={insurancePerAttendee}
              ccFeeRate={ccFeeRate}
              includeHotel={includeHotel}
              setIncludeHotel={setIncludeHotel}
              hotelBudget={hotelBudget}
              setHotelBudget={setHotelBudget}
              hotelNights={hotelNights}
              setHotelNights={setHotelNights}
              hotelNotes={hotelNotes}
              setHotelNotes={setHotelNotes}
              includeTransport={includeTransport}
              setIncludeTransport={setIncludeTransport}
              transportBudget={transportBudget}
              setTransportBudget={setTransportBudget}
              transportNotes={transportNotes}
              setTransportNotes={setTransportNotes}
              includeFlights={includeFlights}
              setIncludeFlights={setIncludeFlights}
              flightBudget={flightBudget}
              setFlightBudget={setFlightBudget}
              flightNotes={flightNotes}
              setFlightNotes={setFlightNotes}
              includeRider={includeRider}
              setIncludeRider={setIncludeRider}
              riderCap={riderCap}
              setRiderCap={setRiderCap}
              riderNotes={riderNotes}
              setRiderNotes={setRiderNotes}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              settlementDays={settlementDays}
              setSettlementDays={setSettlementDays}
              fullPaymentDueDate={fullPaymentDueDate}
              setFullPaymentDueDate={setFullPaymentDueDate}
              eventDate={eventDate}
            />
          )}

          {currentStep === 3 && (
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
              balanceDueTiming={balanceDueTiming}
              setBalanceDueTiming={setBalanceDueTiming}
              customBalanceDueDate={customBalanceDueDate}
              setCustomBalanceDueDate={setCustomBalanceDueDate}
              venueDeposit={venueDeposit}
              setVenueDeposit={setVenueDeposit}
              venueDepositDueDate={venueDepositDueDate}
              setVenueDepositDueDate={setVenueDepositDueDate}
              venueDepositStatus={venueDepositStatus}
              setVenueDepositStatus={setVenueDepositStatus}
              eventDate={eventDate}
            />
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <TicketScalingTab
              ticketTiers={ticketTiers}
              setTicketTiers={setTicketTiers}
              salesTaxPct={salesTaxPct}
              setSalesTaxPct={setSalesTaxPct}
              mode={mode}
              compsArtist={compsArtist}
              setCompsArtist={setCompsArtist}
              compsVenue={compsVenue}
              setCompsVenue={setCompsVenue}
              compsPromoter={compsPromoter}
              setCompsPromoter={setCompsPromoter}
            />

              <ExtraRevenuePanel
                enabled={includeExtraRevenue}
                onToggle={setIncludeExtraRevenue}
                lines={extraRevenue}
                onChange={setExtraRevenue}
                expectedAttendance={ticketTiers.reduce((sum, t) => sum + Math.max(0, (t.allotment || 0) - (t.comps || 0)), 0)}
              />
            </div>
          )}

          {currentStep === 5 && (() => {
            const supportActsCost = supportActs.reduce((sum, act) => sum + act.guarantee, 0);

            let accommodationTotal = 0;
            if (includeHotel && hotelBudget) {
              accommodationTotal += hotelBudget * (hotelNights || 1);
            }
            if (includeTransport && transportBudget) {
              accommodationTotal += transportBudget;
            }
            if (includeFlights && flightBudget) {
              accommodationTotal += flightBudget;
            }
            if (includeRider && riderCap) {
              accommodationTotal += riderCap;
            }

            return (
              <ExpensesTab
                expenses={expenses}
                setExpenses={setExpenses}
                ascapRate={ascapRate}
                setAscapRate={setAscapRate}
                bmiRate={bmiRate}
                setBmiRate={setBmiRate}
                sesacRate={sesacRate}
                setSesacRate={setSesacRate}
                insurancePerAttendee={insurancePerAttendee}
                setInsurancePerAttendee={setInsurancePerAttendee}
                ccFeeRate={ccFeeRate}
                setCcFeeRate={setCcFeeRate}
                supportActsCost={supportActsCost}
                accommodationCosts={accommodationTotal}
                estimatedVariableExpenses={calculations.totalExpenses - (supportActsCost + accommodationTotal + Object.values(expenses).reduce((sum, cat) => sum + Object.values(cat).reduce((s, v) => s + v, 0), 0))}
                artistGuarantee={guarantee}
              />
            );
          })()}

          {currentStep === 6 && (
            <SummaryTab
              scoreInput={{
                guarantee,
                ticket_tiers: ticketTiers,
                sales_tax_pct: salesTaxPct,
                facility_fee_per_ticket: facilityFeePerTicket,
                expenses,
                support_acts: supportActs,
                ascap_rate: ascapRate,
                bmi_rate: bmiRate,
                sesac_rate: sesacRate,
                insurance_per_attendee: insurancePerAttendee,
                cc_fee_rate: ccFeeRate,
                include_hotel: includeHotel, hotel_budget: hotelBudget, hotel_nights: hotelNights,
                include_transport: includeTransport, transport_budget: transportBudget,
                include_flights: includeFlights, flight_budget: flightBudget,
                include_rider: includeRider, rider_cap: riderCap,
                include_extra_revenue: includeExtraRevenue,
                extra_revenue: extraRevenue,
              }}
              calculations={calculations}
              dealType={dealType}
              guarantee={guarantee}
              taxWithholdingPct={taxWithholdingPct}
              depositPct={depositPct}
              mode={mode}
              ticketTiers={ticketTiers}
              salesTaxPct={salesTaxPct}
              artistName={artistName}
              venueName={venueName}
              capacity={capacity}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="bg-[#22262F] text-gray-400 hover:text-white hover:bg-[#2A3040] rounded-2xl px-8 py-6 text-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
            Previous
          </button>

          {currentStep < 6 ? (
            <button
              onClick={handleNext}
              className="bg-[#8FD3FF] text-[#04214D] hover:bg-[#6FB8F2] rounded-2xl px-8 py-6 text-lg font-bold transition-colors flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#8FD3FF] text-[#04214D] hover:bg-[#6FB8F2] rounded-2xl px-8 py-6 text-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Create Offer'}
              <Check className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Save Draft Button */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 mx-auto"
          >
            <Save className="h-4 w-4" />
            Save as Draft
          </button>
        </div>
      </div>
    </div>
  );
}
