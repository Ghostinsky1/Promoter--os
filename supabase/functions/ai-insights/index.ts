import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all settled offers with settlements and shows
    const { data: offers, error } = await supabase
      .from('offers')
      .select(`
        *,
        show:shows(*),
        settlement:settlements(*)
      `)
      .eq('user_id', user.id)
      .eq('is_settled', true);

    if (error) throw error;

    // Filter to only offers with settlement data
    const settledOffers = offers?.filter(o => o.settlement && o.settlement.length > 0) || [];

    // Need at least 5 settled shows for meaningful insights
    if (settledOffers.length < 5) {
      return new Response(JSON.stringify({
        ready: false,
        message: `Need ${5 - settledOffers.length} more settled shows to generate insights`,
        settled_count: settledOffers.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const insights = [];

    // INSIGHT 1: Venue Performance
    const venueGroups: { [key: string]: any[] } = {};
    settledOffers.forEach(offer => {
      const venueName = offer.show?.venue_name || 'Unknown';
      if (!venueGroups[venueName]) {
        venueGroups[venueName] = [];
      }
      venueGroups[venueName].push(offer);
    });

    const venueStats = Object.entries(venueGroups).map(([venue, shows]) => ({
      venue,
      avg_profit: shows.reduce((sum, s) => sum + (parseFloat(s.actual_profit) || 0), 0) / shows.length,
      count: shows.length,
      total_profit: shows.reduce((sum, s) => sum + (parseFloat(s.actual_profit) || 0), 0)
    })).sort((a, b) => b.avg_profit - a.avg_profit);

    if (venueStats.length > 0) {
      const best = venueStats[0];
      const avgProfit = settledOffers.reduce((sum, o) => sum + (parseFloat(o.actual_profit) || 0), 0) / settledOffers.length;

      if (best.avg_profit > avgProfit * 1.2) {
        insights.push({
          type: 'venue_performance',
          title: `${best.venue} is your highest performer`,
          description: `Average profit of $${Math.round(best.avg_profit).toLocaleString()} vs $${Math.round(avgProfit).toLocaleString()} overall`,
          recommendation: `Book more shows at this venue - it outperforms your average by ${Math.round(((best.avg_profit / avgProfit - 1) * 100))}%`,
          impact: 'HIGH',
          icon: '🏟️',
          data: { venue: best.venue, avg_profit: best.avg_profit, show_count: best.count }
        });
      }
    }

    // INSIGHT 2: Day of Week Analysis
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayGroups: { [key: string]: any[] } = {};

    settledOffers.forEach(offer => {
      if (offer.show?.event_date) {
        const day = dayOfWeek[new Date(offer.show.event_date).getDay()];
        if (!dayGroups[day]) dayGroups[day] = [];
        dayGroups[day].push(offer);
      }
    });

    const dayStats = Object.entries(dayGroups).map(([day, shows]) => ({
      day,
      avg_profit: shows.reduce((sum, s) => sum + (parseFloat(s.actual_profit) || 0), 0) / shows.length,
      count: shows.length
    })).sort((a, b) => b.avg_profit - a.avg_profit);

    if (dayStats.length > 0 && dayStats[0].count >= 2) {
      const best = dayStats[0];
      insights.push({
        type: 'timing',
        title: `${best.day} shows are your most profitable`,
        description: `Average profit: $${Math.round(best.avg_profit).toLocaleString()} from ${best.count} shows`,
        recommendation: `Schedule more ${best.day} events to maximize profitability`,
        impact: 'MEDIUM',
        icon: '📅',
        data: { day: best.day, avg_profit: best.avg_profit }
      });
    }

    // INSIGHT 3: Profit Margin Analysis
    const avgMargin = settledOffers.reduce((sum, o) => {
      const revenue = parseFloat(o.settlement[0]?.actual_revenue) || 0;
      const profit = parseFloat(o.actual_profit) || 0;
      const margin = revenue > 0 ? (profit / revenue) : 0;
      return sum + margin;
    }, 0) / settledOffers.length * 100;

    if (avgMargin < 20) {
      insights.push({
        type: 'margins',
        title: `Your profit margin is ${Math.round(avgMargin)}%`,
        description: `Industry standard is 20-30%. You have room to improve.`,
        recommendation: `Review ticket pricing and expense management to increase margins`,
        impact: 'HIGH',
        icon: '💰',
        data: { margin: avgMargin }
      });
    } else if (avgMargin > 30) {
      insights.push({
        type: 'margins',
        title: `Excellent ${Math.round(avgMargin)}% profit margin`,
        description: `You're well above the 20% industry average`,
        recommendation: `Maintain current pricing and cost management strategies`,
        impact: 'HIGH',
        icon: '💰',
        data: { margin: avgMargin }
      });
    }

    // INSIGHT 4: Revenue Variance Pattern
    const revenueVariances = settledOffers.filter(o => {
      const settlement = o.settlement[0];
      return settlement && parseFloat(settlement.variance_revenue) !== undefined;
    });

    if (revenueVariances.length > 0) {
      const avgRevenueVariance = revenueVariances.reduce((sum, o) => {
        return sum + parseFloat(o.settlement[0].variance_revenue);
      }, 0) / revenueVariances.length;

      const avgRevenue = revenueVariances.reduce((sum, o) => {
        return sum + parseFloat(o.settlement[0].actual_revenue);
      }, 0) / revenueVariances.length;

      const variancePct = (avgRevenueVariance / avgRevenue) * 100;

      if (Math.abs(variancePct) > 10) {
        insights.push({
          type: 'forecasting',
          title: `Your revenue projections are ${variancePct > 0 ? 'conservative' : 'optimistic'}`,
          description: `On average, actual revenue is ${Math.abs(Math.round(variancePct))}% ${variancePct > 0 ? 'higher' : 'lower'} than projected`,
          recommendation: `Adjust your sell-through assumptions ${variancePct > 0 ? 'upward' : 'downward'} for more accurate projections`,
          impact: 'MEDIUM',
          icon: '📊',
          data: { variance: variancePct }
        });
      }
    }

    // INSIGHT 5: Expense Control
    const expenseVariances = settledOffers.filter(o => {
      const settlement = o.settlement[0];
      return settlement && parseFloat(settlement.variance_expenses) !== undefined;
    });

    if (expenseVariances.length > 0) {
      const avgExpenseVariance = expenseVariances.reduce((sum, o) => {
        return sum + parseFloat(o.settlement[0].variance_expenses);
      }, 0) / expenseVariances.length;

      if (avgExpenseVariance < -1000) {
        insights.push({
          type: 'expense_control',
          title: `Expenses consistently exceed budget`,
          description: `On average, you're $${Math.abs(Math.round(avgExpenseVariance)).toLocaleString()} over budget per show`,
          recommendation: `Review vendor contracts and negotiate better rates, or increase expense budgets`,
          impact: 'HIGH',
          icon: '⚠️',
          data: { variance: avgExpenseVariance }
        });
      } else if (avgExpenseVariance > 500) {
        insights.push({
          type: 'expense_control',
          title: `Excellent expense management`,
          description: `You're consistently under budget by $${Math.round(avgExpenseVariance).toLocaleString()} per show`,
          recommendation: `Your cost control is working well - maintain current practices`,
          impact: 'LOW',
          icon: '✅',
          data: { variance: avgExpenseVariance }
        });
      }
    }

    return new Response(JSON.stringify({
      ready: true,
      insights,
      settled_count: settledOffers.length,
      generated_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI Insights Error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
