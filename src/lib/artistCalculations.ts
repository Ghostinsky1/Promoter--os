import type { EventArtist, ArtistCostBreakdown, ArtistsSummary } from '../types';

export function calculateArtistCost(artist: EventArtist): ArtistCostBreakdown {
  const guarantee = artist.guarantee || 0;

  let deposit = 0;
  if (artist.deposit_type === 'percentage') {
    deposit = guarantee * ((artist.deposit_percentage || 0) / 100);
  } else {
    deposit = artist.deposit_amount || 0;
  }
  deposit = Math.min(deposit, guarantee);

  const balance = Math.max(guarantee - deposit, 0);

  const flightCost = artist.flight_covered ? (artist.flight_budget || 0) : 0;
  const hotelCost = artist.hotel_covered
    ? (artist.hotel_budget || 0) * (artist.hotel_nights || 1)
    : 0;
  const transportCost = artist.ground_transport_covered ? (artist.ground_transport_budget || 0) : 0;

  const totalTravelCost = flightCost + hotelCost + transportCost;

  const hospitalityBuyout = artist.hospitality_buyout || 0;
  const dinnerBuyout = artist.dinner_buyout || 0;
  const totalHospitalityCost = hospitalityBuyout + dinnerBuyout;

  const totalCost = guarantee + totalTravelCost + totalHospitalityCost;

  return {
    guarantee,
    deposit,
    balance,
    flightCost,
    hotelCost,
    transportCost,
    hospitalityBuyout,
    dinnerBuyout,
    totalTravelCost,
    totalHospitalityCost,
    totalCost,
  };
}

export function calculateArtistsSummary(artists: EventArtist[]): ArtistsSummary {
  let totalGuarantees = 0;
  let totalDeposits = 0;
  let totalBalances = 0;
  let totalTravelCosts = 0;
  let totalHospitalityCosts = 0;
  let totalArtistCosts = 0;
  let unpaidDeposits = 0;
  let missingTravelInfo = 0;
  let mostExpensiveArtist = '';
  let maxCost = 0;

  for (const artist of artists) {
    const costs = calculateArtistCost(artist);
    totalGuarantees += costs.guarantee;
    totalDeposits += costs.deposit;
    totalBalances += costs.balance;
    totalTravelCosts += costs.totalTravelCost;
    totalHospitalityCosts += costs.totalHospitalityCost;
    totalArtistCosts += costs.totalCost;

    if (costs.deposit > 0 && artist.status !== 'deposit_paid' && artist.status !== 'fully_paid') {
      unpaidDeposits++;
    }

    if (artist.role !== 'local_opener' && !artist.flight_covered && !artist.hotel_covered) {
      missingTravelInfo++;
    }

    if (costs.totalCost > maxCost) {
      maxCost = costs.totalCost;
      mostExpensiveArtist = artist.artist_name;
    }
  }

  return {
    count: artists.length,
    totalGuarantees,
    totalDeposits,
    totalBalances,
    totalTravelCosts,
    totalHospitalityCosts,
    totalArtistCosts,
    unpaidDeposits,
    missingTravelInfo,
    mostExpensiveArtist,
  };
}
