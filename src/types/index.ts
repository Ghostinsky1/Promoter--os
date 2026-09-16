export interface Show {
  id: string;
  event_name?: string;
  artist_name: string;
  venue_name: string;
  event_date: string;
  capacity: number;
  created_at: string;
}

export interface TicketTier {
  type: string;
  allotment: number;
  comps: number;
  price: number;
  actualSold?: number;
}

export interface Expenses {
  talent: Record<string, number>;
  general: Record<string, number>;
  marketing: Record<string, number>;
  production: Record<string, number>;
}

export interface Calculations {
  grossPotential: number;
  salesTax: number;
  netGross: number;
  totalExpenses: number;
  fixedExpensesTotal?: number;
  variableExpensesTotal?: number;
  netProfit: number;
  artistTotalPayout: number;
  profitPool?: number;
  promoterProfit?: number;
  splitPoint?: number;
  backend?: number;
  artistBackend?: number;
  promoterBackend?: number;
  projections?: {
    capacity70: ProjectionResult;
    capacity85: ProjectionResult;
    capacity100: ProjectionResult;
  };
}

export interface ProjectionResult {
  tickets: number;
  grossPotential: number;
  netGross: number;
  artistPayout: number;
  promoterProfit: number;
  netProfit: number;
  splitPointHit: boolean;
}

export type OfferStatus = 'planning' | 'offer_sent' | 'confirmed' | 'active' | 'settled' | 'cancelled';

export interface SupportAct {
  name: string;
  type: 'dj' | 'band' | 'artist' | 'special_guest';
  role?: 'headliner' | 'support' | 'opener';
  guarantee: number;
  set_length: number;
  genre?: string;
  notes?: string;
  deal_type?: string;
  payment_method?: string;
  deposit_type?: 'percentage' | 'fixed';
  deposit_value?: number;
  deposit_due_date?: string;
  settlement_days?: number;
  include_hotel?: boolean;
  hotel_budget?: number;
  hotel_nights?: number;
  hotel_notes?: string;
  include_transport?: boolean;
  transport_budget?: number;
  transport_notes?: string;
  include_flights?: boolean;
  flight_budget?: number;
  flight_notes?: string;
  include_rider?: boolean;
  rider_cap?: number;
  rider_notes?: string;
}

export interface ScheduleItem {
  id: string;
  time: string;
  duration: number;
  title: string;
  category: 'production' | 'technical' | 'artist' | 'performance' | 'venue' | 'other';
  description: string;
  responsible: string;
}

export interface VenueContact {
  name: string;
  phone: string;
  email: string;
}

export interface RunOfShow {
  id: string;
  offer_id: string;
  event_date: string;
  venue_contact: VenueContact;
  schedule: ScheduleItem[];
  notes: string;
  created_at: string;
  updated_at?: string;
  user_id: string;
}

export interface Offer {
  id: string;
  show_id: string;
  mode: 'estimate' | 'settlement';
  status?: OfferStatus;
  event_type?: 'estimate' | 'budgeting' | 'active' | 'closeout';
  deal_type: 'flat_guarantee' | 'promoter_profit' | 'flat_fee' | 'guarantee_vs_percentage' | 'percentage_only' | 'door_deal';
  guarantee: number;
  artist_percentage?: number;
  promoter_profit?: number;
  artist_payout?: number;
  artist_backend_pct?: number;
  promoter_backend_pct?: number;
  tax_withholding_pct: number;
  deposit_pct: number;
  deposit_due_date?: string;
  deposit_due_timing?: string;
  venue_deposit?: number;
  venue_deposit_due_date?: string;
  venue_deposit_status?: 'pending' | 'paid' | 'refunded';
  venue_street?: string;
  venue_city?: string;
  venue_state?: string;
  venue_zip?: string;
  venue_full_address?: string;
  ticket_tiers: TicketTier[];
  sales_tax_pct: number;
  expenses: Expenses;
  calculations: Calculations;
  support_acts?: SupportAct[];
  facility_fee_per_ticket?: number;
  comps_artist?: number;
  comps_venue?: number;
  comps_promoter?: number;
  doors_time?: string;
  doors_duration?: number;
  show_time?: string;
  show_duration?: number;
  curfew_time?: string;
  age_limit?: string;
  merch_rate_soft?: number;
  merch_rate_hard?: number;
  artist_deductions?: any[];
  ascap_rate?: number;
  bmi_rate?: number;
  sesac_rate?: number;
  insurance_per_attendee?: number;
  cc_fee_rate?: number;
  offer_sent_date?: string;
  offer_expiration_date?: string;
  artist_photo_url?: string;
  holds?: string[];
  tour_id?: string;
  show_number?: number;
  include_hotel?: boolean;
  hotel_budget?: number;
  hotel_nights?: number;
  hotel_notes?: string;
  include_transport?: boolean;
  transport_budget?: number;
  transport_notes?: string;
  include_flights?: boolean;
  flight_budget?: number;
  flight_notes?: string;
  include_rider?: boolean;
  rider_cap?: number;
  rider_notes?: string;
  payment_method?: string;
  settlement_days?: number;
  full_payment_due_date?: string;
  balance_due_timing?: string;
  custom_balance_due_date?: string;
  created_at: string;
}

export type TourStatus = 'planning' | 'booking' | 'confirmed' | 'active' | 'completed' | 'cancelled';

export interface Tour {
  id: string;
  user_id: string;
  name: string;
  artist_name: string;
  start_date: string;
  end_date: string;
  description: string;
  status: TourStatus;
  projected_revenue: number;
  total_costs: number;
  net_profit: number;
  completed_count: number;
  settled_count: number;
  created_at: string;
  updated_at?: string;
}

export interface TourWithDates extends Tour {
  dates: TourDate[];
}

export interface TourDate {
  offer_id: string;
  event_date: string;
  venue_name: string;
  city: string;
  capacity: number;
  net_profit: number;
  status: string;
  show_number: number;
}

export interface OfferWithShow extends Offer {
  show: Show;
}

export interface OfferDeposit {
  id: string;
  offer_id: string;
  organization_id: string;
  related_type: 'artist' | 'expense' | 'venue' | 'other';
  related_id?: string;
  label: string;
  amount: number;
  due_date?: string;
  paid: boolean;
  paid_date?: string;
  method?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface OfferTask {
  id: string;
  offer_id: string;
  organization_id: string;
  title: string;
  due_date?: string;
  completed: boolean;
  priority: 'low' | 'med' | 'high';
  owner?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface PinnedNote {
  id: string;
  text: string;
  createdAt: string;
}

export interface OfferNotes {
  id: string;
  offer_id: string;
  organization_id: string;
  event_notes: string;
  pinned_notes: PinnedNote[];
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  id: string;
  user_id?: string;
  company_name?: string;
  logo_url?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  business_address?: string;
  legal_terms?: string;
  created_at?: string;
  updated_at?: string;
}

export type ArtistRole = 'headliner' | 'direct_support' | 'support' | 'local_opener';

export type ArtistOfferStatus =
  | 'draft'
  | 'sent'
  | 'negotiating'
  | 'accepted'
  | 'confirmed'
  | 'declined'
  | 'contracted'
  | 'deposit_paid'
  | 'fully_paid';

export interface EventArtist {
  id: string;
  offer_id: string;
  organization_id: string;
  artist_name: string;
  role: ArtistRole;
  status: ArtistOfferStatus;
  agency: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  guarantee: number;
  deposit_type: 'percentage' | 'fixed';
  deposit_percentage: number;
  deposit_amount: number;
  balance_due: number;
  payment_notes: string;
  flight_covered: boolean;
  flight_budget: number;
  hotel_covered: boolean;
  hotel_rooms: number;
  hotel_nights: number;
  hotel_budget: number;
  ground_transport_covered: boolean;
  ground_transport_budget: number;
  airport_pickup: boolean;
  travel_notes: string;
  rider_included: boolean;
  hospitality_buyout: number;
  dinner_buyout: number;
  drink_tickets: number;
  backstage_needs: string;
  hospitality_notes: string;
  set_length: number;
  performance_time: string;
  soundcheck_time: string;
  guest_list_spots: number;
  merch_cut: number;
  meet_and_greet: boolean;
  special_terms: string;
  internal_notes: string;
  total_artist_cost: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EventArtistTask {
  id: string;
  event_artist_id: string;
  organization_id: string;
  title: string;
  due_date?: string;
  completed: boolean;
  created_at: string;
}

export interface ArtistCostBreakdown {
  guarantee: number;
  deposit: number;
  balance: number;
  flightCost: number;
  hotelCost: number;
  transportCost: number;
  hospitalityBuyout: number;
  dinnerBuyout: number;
  totalTravelCost: number;
  totalHospitalityCost: number;
  totalCost: number;
}

export interface ArtistsSummary {
  count: number;
  totalGuarantees: number;
  totalDeposits: number;
  totalBalances: number;
  totalTravelCosts: number;
  totalHospitalityCosts: number;
  totalArtistCosts: number;
  unpaidDeposits: number;
  missingTravelInfo: number;
  mostExpensiveArtist: string;
}

export interface TicketTierTemplate {
  type: string;
  price: number;
  default_allotment: number;
  default_comps: number;
}

export interface ExpenseCategoryTemplate {
  title: string;
  items: {
    name: string;
    default_amount: number;
  }[];
}

export interface Template {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  type: 'venue' | 'artist' | 'event';
  deal_type: string;
  deposit_pct: number;
  deposit_due_timing: string;
  tax_withholding_pct: number;
  sales_tax_pct: number;
  ticket_tier_templates: TicketTierTemplate[];
  expense_categories: ExpenseCategoryTemplate[];
  legal_terms?: string;
  created_at: string;
  updated_at?: string;
}
