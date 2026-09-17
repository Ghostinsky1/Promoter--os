import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { TicketTier, Expenses, OfferStatus, SupportAct } from '../types';
import { ExtraRevenuePanel } from './ExtraRevenuePanel';
import type { ExtraRevenueLine } from '../types';
import { calculateOffer } from '../lib/calculations';
import { toLocalDateString } from '../lib/dateHelpers';
import { EventDetailsTab } from './tabs/EventDetailsTab';
import { ArtistDealTab } from './tabs/ArtistDealTab';
import { DepositsTab } from './tabs/DepositsTab';
import { TicketScalingTab } from './tabs/TicketScalingTab';
import { ExpensesTab } from './tabs/ExpensesTab';
import { SummaryTab } from './tabs/SummaryTab';
import { Check, X, ChevronLeft, ChevronRight, Save } from 'lucide-react';

// A rate box the user cleared yields NaN; NaN serializes to null and silently
// wipes the column. Never let that reach the database.
const safeNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

interface ArtistDeduction {
  name: string;
  amount: number;
}

export function EditOffer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [showId, setShowId] = useState('');
  const [eventName, setEventName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [capacity, setCapacity] = useState<number>(0);
  const [mode, setMode] = useState<'estimate' | 'settlement'>('estimate');
  const [status, setStatus] = useState<OfferStatus>('planning');
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
  const [supportActs, setSupportActs] = useState<SupportAct[]>([]);

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

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<string>('deposit_balance');
  const [settlementDays, setSettlementDays] = useState<number>(7);
  const [fullPaymentDueDate, setFullPaymentDueDate] = useState<string>('');

  useEffect(() => {
    isMountedRef.current = true;

    if (id) {
      loadOffer(id);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [id]);

  const loadOffer = async (offerId: string) => {
    try {
      const { data: offerData, error: offerError } = await supabase
        .from('offers')
        .select('*')
        .eq('id', offerId)
        .maybeSingle();

      if (!isMountedRef.current) return;

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

      if (!isMountedRef.current) return;

      if (showError) throw showError;
      if (!showData) {
        navigate('/offers');
        return;
      }

      if (!isMountedRef.current) return;

      console.log('Loading offer data:', { showData, offerData });

      setShowId(showData.id);
      setEventName(showData.event_name || '');
      setArtistName(showData.artist_name || '');
      setVenueName(showData.venue_name || '');
      setEventDate(toLocalDateString(showData.event_date) || '');
      setCapacity(showData.capacity ?? 0);
      setMode(offerData.mode || 'estimate');
      setStatus(offerData.status || 'planning');
      setVenueStreet(offerData.venue_street || '');
      setVenueCity(offerData.venue_city || '');
      setVenueState(offerData.venue_state || '');
      setVenueZip(offerData.venue_zip || '');
      setFacilityFeePerTicket(offerData.facility_fee_per_ticket ?? 2.00);
      setAgeLimit(offerData.age_limit || 'All Ages');
      setDoorsTime(offerData.doors_time || '20:00');
      setDoorsDuration(offerData.doors_duration ?? 60);
      setShowTime(offerData.show_time || '21:00');
      setShowDuration(offerData.show_duration ?? 240);
      setCurfewTime(offerData.curfew_time || '01:00');
      setDealType(offerData.deal_type || 'flat_fee');
      setGuarantee(offerData.guarantee ?? 0);
      setArtistPercentage(offerData.artist_percentage ?? 100);
      setTaxWithholdingPct(offerData.tax_withholding_pct ?? 2);
      setDepositPct(offerData.deposit_pct ?? 20);
      setArtistBackendPct(offerData.artist_backend_pct ?? 85);
      setPromoterBackendPct(offerData.promoter_backend_pct ?? 15);
      setDepositDueTiming(offerData.deposit_due_timing || '30_days_before');
      setCustomDepositDate(toLocalDateString(offerData.deposit_due_date) || '');
      setArtistDepositStatus(offerData.artist_deposit_status || 'pending');
      setBalanceDueTiming(offerData.balance_due_timing || 'at_settlement');
      setCustomBalanceDueDate(toLocalDateString(offerData.custom_balance_due_date) || '');
      setVenueDeposit(offerData.venue_deposit ?? 0);
      setVenueDepositDueDate(toLocalDateString(offerData.venue_deposit_due_date) || '');
      setVenueDepositStatus(offerData.venue_deposit_status || 'pending');
      setMerchRateSoft(offerData.merch_rate_soft ?? 100);
      setMerchRateHard(offerData.merch_rate_hard ?? 100);
      setArtistDeductions(offerData.artist_deductions || []);
      setTicketTiers(offerData.ticket_tiers || [{ type: 'GA', allotment: 0, comps: 0, price: 0 }]);
      setSalesTaxPct(offerData.sales_tax_pct ?? 13.18);
      setIncludeExtraRevenue(offerData.include_extra_revenue ?? false);
      setExtraRevenue(Array.isArray(offerData.extra_revenue) ? offerData.extra_revenue : []);
      setCompsArtist(offerData.comps_artist ?? 0);
      setCompsVenue(offerData.comps_venue ?? 0);
      setCompsPromoter(offerData.comps_promoter ?? 0);
      setExpenses(offerData.expenses || {
        talent: { rider_hospitality: 0 },
        general: { security: 0, emt: 0, gate_staff: 0 },
        marketing: { radio: 0, marketing: 0, paid_social: 0 },
        production: { production: 0, crew_stagehands: 0, camera_operator: 0, technical_director: 0 }
      });
      setAscapRate(offerData.ascap_rate ?? 0.0023);
      setBmiRate(offerData.bmi_rate ?? 0.003);
      setSesacRate(offerData.sesac_rate ?? 0.000214);
      setInsurancePerAttendee(offerData.insurance_per_attendee ?? 0.62);
      setCcFeeRate(offerData.cc_fee_rate ?? 0.012);
      setSupportActs(offerData.support_acts || []);

      // Load accommodation fields
      setIncludeHotel(offerData.include_hotel ?? false);
      setHotelBudget(offerData.hotel_budget ?? 0);
      setHotelNights(offerData.hotel_nights ?? 1);
      setHotelNotes(offerData.hotel_notes || '');
      setIncludeTransport(offerData.include_transport ?? false);
      setTransportBudget(offerData.transport_budget ?? 0);
      setTransportNotes(offerData.transport_notes || '');
      setIncludeFlights(offerData.include_flights ?? false);
      setFlightBudget(offerData.flight_budget ?? 0);
      setFlightNotes(offerData.flight_notes || '');
      setIncludeRider(offerData.include_rider ?? false);
      setRiderCap(offerData.rider_cap ?? 100);
      setRiderNotes(offerData.rider_notes || '');

      // Load payment method fields
      setPaymentMethod(offerData.payment_method || 'deposit_balance');
      setSettlementDays(offerData.settlement_days ?? 7);
      setFullPaymentDueDate(toLocalDateString(offerData.full_payment_due_date) || '');

      console.log('State after loading:', {
        artistName: showData.artist_name,
        venueName: showData.venue_name,
        capacity: showData.capacity,
        eventDate: toLocalDateString(showData.event_date)
      });
    } catch (error) {
      console.error('Error loading offer:', error);
      navigate('/offers');
    } finally {
      setLoading(false);
    }
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
    { number: 1, label: 'Event Details' },
    { number: 2, label: 'Artist Deal' },
    { number: 3, label: 'Deposits' },
    { number: 4, label: 'Ticket Scaling' },
    { number: 5, label: 'Expenses' },
    { number: 6, label: 'Summary' },
  ];

  const handleNext = () => {
    console.log('handleNext called, currentStep:', currentStep);
    console.log('Current form state:', { artistName, venueName, eventDate, capacity });

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
    console.log('handlePrevious called, currentStep:', currentStep);
    console.log('Current form state:', { artistName, venueName, eventDate, capacity });

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
      const { error: showError } = await supabase
        .from('shows')
        .update({
          event_name: eventName || null,
          artist_name: artistName,
          venue_name: venueName,
          event_date: eventDate,
          capacity: capacity,
        })
        .eq('id', showId);

      if (showError) throw showError;

      const venueFullAddress = [
        venueStreet,
        `${venueCity}${venueState ? ', ' + venueState : ''}${venueZip ? ' ' + venueZip : ''}`
      ].filter(Boolean).join('\n');

      const { error: offerError } = await supabase
        .from('offers')
        .update({
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
        })
        .eq('id', id);

      if (offerError) throw offerError;

      navigate(`/offers/${id}`);
    } catch (error) {
      console.error('Error saving offer:', error);
      alert('Failed to save offer. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1140F0] flex items-center justify-center">
        <div className="text-gray-400">Loading offer...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1140F0]">
      {/* Sticky Header */}
      <div className="bg-[#14171E] border-b border-gray-800 sticky top-16 z-40">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-white">Edit Offer</h1>
              <span className="px-3 py-1 bg-[#22262F] text-gray-400 rounded-full text-sm">
                Step {currentStep} of {steps.length}
              </span>
            </div>
            <button
              onClick={() => navigate(`/offers/${id}`)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="relative mb-6">
            <div className="h-2 bg-[#22262F] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#8FD3FF] rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / steps.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between gap-2">
            {steps.map((step) => (
              <div
                key={step.number}
                className="flex flex-col items-center cursor-pointer flex-1"
                onClick={() => setCurrentStep(step.number)}
              >
                <div
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-base sm:text-lg font-bold transition-all ${
                    step.number === currentStep
                      ? 'bg-[#8FD3FF] text-[#04214D] scale-110 shadow-lg shadow-[#8FD3FF]/30'
                      : step.number < currentStep
                      ? 'bg-[#8FD3FF]/30 text-[#8FD3FF]'
                      : 'bg-[#22262F] text-gray-600'
                  }`}
                >
                  {step.number < currentStep ? (
                    <Check className="h-5 w-5 sm:h-6 sm:w-6" />
                  ) : (
                    step.number
                  )}
                </div>
                <p className={`text-[10px] sm:text-xs mt-2 text-center leading-tight ${
                  step.number === currentStep ? 'text-[#8FD3FF] font-semibold' : 'text-gray-500'
                }`}>
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Form Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-8">
          {currentStep === 1 && (
            <EventDetailsTab
              key="event-details"
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
              key="artist-deal"
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
              key="deposits"
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
              key="ticket-scaling"
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
                key="expenses"
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
              key="summary"
              calculations={calculations}
              dealType={dealType}
              guarantee={guarantee}
              taxWithholdingPct={taxWithholdingPct}
              depositPct={depositPct}
              mode={mode}
              ticketTiers={ticketTiers}
              salesTaxPct={salesTaxPct}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="bg-[#22262F] text-gray-400 hover:text-white hover:bg-[#2A3040] rounded-2xl px-8 py-6 text-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
            Previous
          </button>

          {currentStep < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="bg-[#8FD3FF] text-[#04214D] hover:bg-[#6FB8F2] rounded-2xl px-8 py-6 text-lg font-bold transition-colors flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-[#8FD3FF] text-[#04214D] hover:bg-[#6FB8F2] rounded-2xl px-8 py-6 text-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
              <Check className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Cancel Button */}
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => navigate(`/offers/${id}`)}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 mx-auto"
          >
            <Save className="h-4 w-4" />
            Cancel Changes
          </button>
        </div>
      </div>
    </div>
  );
}
