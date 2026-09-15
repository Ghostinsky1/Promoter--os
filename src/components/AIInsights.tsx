import { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, RefreshCw, Loader2 } from 'lucide-react';
import { supabase, SUPABASE_URL } from '../lib/supabase';

interface Insight {
  type: string;
  title: string;
  description: string;
  recommendation: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  icon: string;
  data: any;
}

interface InsightsResponse {
  ready: boolean;
  insights?: Insight[];
  settled_count: number;
  message?: string;
  generated_at?: string;
}

export function AIInsights() {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [settledCount, setSettledCount] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadInsights();
  }, []);

  async function loadInsights() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const apiUrl = `${SUPABASE_URL}/functions/v1/ai-insights`;
      const res = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch insights');
      }

      const data: InsightsResponse = await res.json();

      if (data.ready && data.insights) {
        setInsights(data.insights);
        setReady(true);
        setSettledCount(data.settled_count);
      } else {
        setReady(false);
        setSettledCount(data.settled_count);
        setMessage(data.message || '');
      }
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  }

  function getImpactColor(impact: string) {
    switch (impact) {
      case 'HIGH':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <div className="animate-pulse">
          <Sparkles className="h-12 w-12 text-purple-600 mx-auto mb-4" />
          <Loader2 className="h-6 w-6 animate-spin text-purple-600 mx-auto mb-2" />
          <p className="text-slate-600">Analyzing your data...</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg shadow-sm p-8">
        <div className="text-center">
          <Sparkles className="h-12 w-12 text-purple-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2 text-slate-900">AI Learning Mode</h3>
          <p className="text-slate-700 mb-4">
            {message || 'Settle more shows to unlock AI insights'}
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-700">
            <div className="w-48 h-3 bg-purple-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                style={{ width: `${(settledCount / 5) * 100}%` }}
              />
            </div>
            <span className="font-semibold text-slate-900">{settledCount} / 5</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-purple-600" />
          <div>
            <h3 className="text-2xl font-bold text-slate-900">AI Business Insights</h3>
            <p className="text-sm text-slate-600">
              Discovered from {insights?.length || 0} patterns in your data
            </p>
          </div>
        </div>
        <button
          onClick={loadInsights}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {insights && insights.length > 0 ? (
          insights.map((insight, i) => (
            <div
              key={i}
              className="border-l-4 border-purple-500 bg-purple-50 p-4 rounded-r-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="text-4xl flex-shrink-0">{insight.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h4 className="font-bold text-lg text-slate-900">{insight.title}</h4>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getImpactColor(
                        insight.impact
                      )}`}
                    >
                      {insight.impact} Impact
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mb-3">{insight.description}</p>
                  <div className="bg-white p-3 rounded-lg border-l-2 border-green-500">
                    <div className="text-xs text-slate-600 mb-1 font-semibold">
                      AI Recommendation
                    </div>
                    <div className="font-semibold text-slate-900">{insight.recommendation}</div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-slate-600 py-8">
            No insights available yet. Settle more shows to unlock AI analysis.
          </p>
        )}
      </div>

      <div className="mt-6 pt-6 border-t text-center text-sm text-slate-500">
        <TrendingUp className="h-4 w-4 inline mr-2" />
        Powered by your settlement data • Updates automatically
      </div>
    </div>
  );
}
