import { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DealAnalyzerProps {
  offerData: {
    artist_name: string;
    venue_name: string;
    capacity: number;
    guarantee: number;
    gross_potential: number;
    net_profit: number;
    total_costs: number;
    ticket_tiers: any[];
  };
  onAnalysisComplete?: (score: number) => void;
}

interface Factor {
  factor: string;
  score: number;
  max: number;
  status: string;
  detail: string;
}

interface Analysis {
  overall_score: number;
  max_score: number;
  recommendation: string;
  recommendation_type: string;
  factors: Factor[];
  improvement_tips: string[];
  analyzed_at: string;
}

export function DealAnalyzer({ offerData, onAnalysisComplete }: DealAnalyzerProps) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('DealAnalyzer offerData:', offerData);
    if (offerData && offerData.capacity > 0) {
      console.log('Starting deal analysis...');
      analyzeDeal();
    } else {
      console.log('Skipping analysis - capacity is 0 or data is missing');
    }
  }, [offerData]);

  async function analyzeDeal() {
    console.log('analyzeDeal called');
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session:', session ? 'Found' : 'Not found');
      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-deal`;
      console.log('Calling API:', apiUrl);
      console.log('Request body:', offerData);

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(offerData)
      });

      console.log('Response status:', res.status);

      if (!res.ok) {
        const errorData = await res.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Failed to analyze deal');
      }

      const data = await res.json();
      console.log('Analysis result:', data);
      setAnalysis(data);

      if (onAnalysisComplete) {
        onAnalysisComplete(data.overall_score);
      }
    } catch (err) {
      console.error('Error analyzing deal:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze deal');
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'EXCELLENT':
      case 'PROVEN':
      case 'OPTIMIZED':
      case 'LOW RISK':
        return 'bg-green-100 text-green-800 border border-green-300';
      case 'GOOD':
      case 'DECENT':
      case 'BASIC':
      case 'MEDIUM RISK':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
      case 'RISKY':
      case 'HIGH RISK':
      case 'UNDERPERFORMER':
      case 'SIMPLISTIC':
        return 'bg-orange-100 text-orange-800 border border-orange-300';
      case 'DANGEROUS':
      case 'UNKNOWN':
        return 'bg-red-100 text-red-800 border border-red-300';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getRecommendationStyle = (type: string) => {
    switch (type) {
      case 'STRONG_BUY':
        return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
      case 'PROCEED':
        return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
      case 'CAUTION':
        return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white';
      case 'PASS':
        return 'bg-gradient-to-r from-red-500 to-pink-500 text-white';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="bg-white border-2 border-blue-200 rounded-xl shadow-sm p-8 text-center">
        <div className="animate-pulse">
          <Sparkles className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-slate-600">AI analyzing deal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 text-red-700">
          <AlertTriangle className="h-6 w-6" />
          <div>
            <h4 className="font-bold">Analysis Error</h4>
            <p className="text-sm">{error}</p>
          </div>
        </div>
        <button
          onClick={analyzeDeal}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="bg-white border-4 border-blue-500 rounded-xl shadow-xl p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">AI Deal Score</h3>
            <p className="text-sm text-slate-600">Powered by your historical data</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-6xl font-bold ${getScoreColor(analysis.overall_score)}`}>
            {analysis.overall_score}
          </div>
          <div className="text-sm text-slate-600">out of 100</div>
        </div>
      </div>

      <div className={`mb-6 p-5 rounded-xl ${getRecommendationStyle(analysis.recommendation_type)}`}>
        <div className="flex items-center gap-3">
          {analysis.recommendation_type === 'STRONG_BUY' && (
            <CheckCircle2 className="h-8 w-8 flex-shrink-0" />
          )}
          {analysis.recommendation_type === 'PROCEED' && (
            <TrendingUp className="h-8 w-8 flex-shrink-0" />
          )}
          {analysis.recommendation_type === 'CAUTION' && (
            <AlertTriangle className="h-8 w-8 flex-shrink-0" />
          )}
          {analysis.recommendation_type === 'PASS' && (
            <AlertTriangle className="h-8 w-8 flex-shrink-0" />
          )}
          <div className="text-lg font-bold leading-tight">
            {analysis.recommendation}
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <h4 className="font-bold text-lg mb-3 text-slate-900">Score Breakdown</h4>
        {analysis.factors.map((factor, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-semibold text-base text-slate-900">{factor.factor}</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getStatusColor(factor.status)}`}>
                  {factor.status}
                </span>
              </div>
              <p className="text-sm text-slate-600 mb-2">{factor.detail}</p>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    factor.score === factor.max ? 'bg-green-500' :
                    factor.score >= factor.max * 0.6 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${(factor.score / factor.max) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${getScoreColor(factor.score)}`}>
                {factor.score}
              </div>
              <div className="text-xs text-slate-500">/ {factor.max}</div>
            </div>
          </div>
        ))}
      </div>

      {analysis.improvement_tips && analysis.improvement_tips.length > 0 && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
          <h4 className="font-bold mb-3 flex items-center gap-2 text-slate-900">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Ways to Improve Score
          </h4>
          <ul className="space-y-2">
            {analysis.improvement_tips.map((tip, i) => (
              <li key={i} className="text-sm flex items-start gap-2 text-slate-700">
                <span className="text-blue-600 font-bold">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-center pt-4 border-t">
        <button
          onClick={analyzeDeal}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Re-analyze Deal
        </button>
      </div>
    </div>
  );
}
