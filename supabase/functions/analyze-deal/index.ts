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

    const offerData = await req.json();

    let totalScore = 0;
    const factors = [];

    const grossPotential = parseFloat(offerData.gross_potential) || 0;
    const netProfit = parseFloat(offerData.net_profit) || 0;
    const guarantee = parseFloat(offerData.guarantee) || 0;
    const capacity = parseInt(offerData.capacity) || 0;

    if (grossPotential === 0 || capacity === 0) {
      return new Response(JSON.stringify({
        error: 'Invalid offer data - missing required fields'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // FACTOR 1: PROFIT MARGIN (max 30 points)
    const margin = (netProfit / grossPotential) * 100;

    let marginScore = 0;
    let marginStatus = '';
    let marginDetail = '';

    if (margin >= 30) {
      marginScore = 30;
      marginStatus = 'EXCELLENT';
      marginDetail = `${margin.toFixed(1)}% margin is well above the 20% industry standard`;
    } else if (margin >= 20) {
      marginScore = 20;
      marginStatus = 'GOOD';
      marginDetail = `${margin.toFixed(1)}% margin meets industry standards`;
    } else if (margin >= 10) {
      marginScore = 10;
      marginStatus = 'RISKY';
      marginDetail = `${margin.toFixed(1)}% margin is below the recommended 20%`;
    } else {
      marginScore = 5;
      marginStatus = 'DANGEROUS';
      marginDetail = `${margin.toFixed(1)}% margin is too low - high risk of loss`;
    }

    totalScore += marginScore;
    factors.push({
      factor: 'Profit Margin',
      score: marginScore,
      max: 30,
      status: marginStatus,
      detail: marginDetail
    });

    // FACTOR 2: RISK/REWARD RATIO (max 25 points)
    const guaranteePerSeat = guarantee / capacity;

    let riskScore = 0;
    let riskStatus = '';
    let riskDetail = '';

    if (guaranteePerSeat < 15) {
      riskScore = 25;
      riskStatus = 'LOW RISK';
      riskDetail = `Guarantee of $${guaranteePerSeat.toFixed(2)}/seat is very manageable`;
    } else if (guaranteePerSeat < 25) {
      riskScore = 15;
      riskStatus = 'MEDIUM RISK';
      riskDetail = `Guarantee of $${guaranteePerSeat.toFixed(2)}/seat requires good turnout`;
    } else {
      riskScore = 5;
      riskStatus = 'HIGH RISK';
      riskDetail = `Guarantee of $${guaranteePerSeat.toFixed(2)}/seat is very aggressive`;
    }

    totalScore += riskScore;
    factors.push({
      factor: 'Risk/Reward Ratio',
      score: riskScore,
      max: 25,
      status: riskStatus,
      detail: riskDetail
    });

    // FACTOR 3: VENUE TRACK RECORD (max 25 points)
    const { data: venueHistory } = await supabase
      .from('offers')
      .select('actual_profit')
      .eq('user_id', user.id)
      .eq('venue_name', offerData.venue_name)
      .eq('is_settled', true);

    let venueScore = 10;
    let venueStatus = 'UNKNOWN';
    let venueDetail = 'No history at this venue yet';

    if (venueHistory && venueHistory.length > 0) {
      const avgProfit = venueHistory.reduce((sum, o) => sum + (parseFloat(o.actual_profit) || 0), 0) / venueHistory.length;

      if (avgProfit > 5000) {
        venueScore = 25;
        venueStatus = 'PROVEN';
        venueDetail = `Strong track record: $${Math.round(avgProfit).toLocaleString()} avg profit from ${venueHistory.length} show${venueHistory.length > 1 ? 's' : ''}`;
      } else if (avgProfit > 2000) {
        venueScore = 15;
        venueStatus = 'DECENT';
        venueDetail = `Moderate performance: $${Math.round(avgProfit).toLocaleString()} avg profit from ${venueHistory.length} show${venueHistory.length > 1 ? 's' : ''}`;
      } else {
        venueScore = 8;
        venueStatus = 'UNDERPERFORMER';
        venueDetail = `Below average: $${Math.round(avgProfit).toLocaleString()} avg profit from ${venueHistory.length} show${venueHistory.length > 1 ? 's' : ''}`;
      }
    }

    totalScore += venueScore;
    factors.push({
      factor: 'Venue Track Record',
      score: venueScore,
      max: 25,
      status: venueStatus,
      detail: venueDetail
    });

    // FACTOR 4: TICKET PRICING STRATEGY (max 20 points)
    const tierCount = offerData.ticket_tiers?.length || 0;
    const totalAllotment = offerData.ticket_tiers?.reduce((sum: number, t: any) => sum + (parseInt(t.allotment) || 0), 0) || 0;
    const avgPrice = totalAllotment > 0
      ? offerData.ticket_tiers?.reduce((sum: number, t: any) => sum + (parseFloat(t.price) * parseInt(t.allotment)), 0) / totalAllotment
      : 0;

    let pricingScore = 0;
    let pricingStatus = '';
    let pricingDetail = '';

    if (tierCount >= 3) {
      pricingScore = 20;
      pricingStatus = 'OPTIMIZED';
      pricingDetail = `${tierCount} tiers with avg price $${avgPrice.toFixed(2)} - maximizes revenue capture`;
    } else if (tierCount === 2) {
      pricingScore = 12;
      pricingStatus = 'BASIC';
      pricingDetail = `${tierCount} tiers - consider adding VIP or early bird tier`;
    } else {
      pricingScore = 5;
      pricingStatus = 'SIMPLISTIC';
      pricingDetail = `Only ${tierCount} tier - missing revenue opportunities`;
    }

    totalScore += pricingScore;
    factors.push({
      factor: 'Ticket Pricing',
      score: pricingScore,
      max: 20,
      status: pricingStatus,
      detail: pricingDetail
    });

    // GENERATE RECOMMENDATION
    let recommendation = '';
    let recommendationType = '';

    if (totalScore >= 80) {
      recommendation = 'STRONG BUY - This is an excellent opportunity with high profit potential and manageable risk';
      recommendationType = 'STRONG_BUY';
    } else if (totalScore >= 60) {
      recommendation = 'PROCEED - Deal looks solid with acceptable risk/reward ratio';
      recommendationType = 'PROCEED';
    } else if (totalScore >= 40) {
      recommendation = 'CAUTION - Consider negotiating better terms or adjusting ticket prices';
      recommendationType = 'CAUTION';
    } else {
      recommendation = 'PASS - Risk is too high. Look for a better opportunity';
      recommendationType = 'PASS';
    }

    // GENERATE IMPROVEMENT TIPS
    const tips = [];

    if (marginScore < 20) {
      tips.push('Increase ticket prices or reduce expenses to improve margin');
    }
    if (riskScore < 15) {
      tips.push('Negotiate a lower guarantee or add percentage split above break-even');
    }
    if (pricingScore < 15) {
      tips.push('Add more ticket tiers (VIP, early bird) to capture more revenue');
    }
    if (tierCount < 3 && avgPrice > 0) {
      tips.push(`Add a premium tier at $${(avgPrice * 1.5).toFixed(0)} to increase revenue`);
    }

    return new Response(JSON.stringify({
      overall_score: totalScore,
      max_score: 100,
      recommendation,
      recommendation_type: recommendationType,
      factors,
      improvement_tips: tips,
      analyzed_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Deal Analysis Error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
