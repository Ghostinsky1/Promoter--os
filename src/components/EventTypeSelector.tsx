import { useNavigate } from 'react-router-dom';
import { FileText, Calculator, Activity, CheckCircle } from 'lucide-react';

export function EventTypeSelector() {
  const navigate = useNavigate();

  const startEvent = (eventType: 'estimate' | 'budgeting' | 'active' | 'closeout') => {
    navigate(`/offers/create?type=${eventType}`);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">Create New Event</h1>
          <p className="text-lg text-gray-600">What type of event are you creating?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => startEvent('estimate')}
            className="bg-white border-2 border-gray-200 hover:border-blue-500 rounded-xl p-8 text-left transition-all hover:shadow-lg"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <FileText className="h-7 w-7 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Estimate</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Pre-show financial projections for planning and decision-making
                </p>
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                  Planning Phase
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={() => startEvent('budgeting')}
            className="bg-white border-2 border-gray-200 hover:border-purple-500 rounded-xl p-8 text-left transition-all hover:shadow-lg"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Calculator className="h-7 w-7 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Budgeting</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Detailed budget planning with multiple scenarios and what-if analysis
                </p>
                <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
                  Budget Planning
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={() => startEvent('active')}
            className="bg-white border-2 border-gray-200 hover:border-green-500 rounded-xl p-8 text-left transition-all hover:shadow-lg"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Activity className="h-7 w-7 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Active Event</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Track live event with real-time ticket sales and actual expenses
                </p>
                <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                  Currently Running
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={() => startEvent('closeout')}
            className="bg-white border-2 border-gray-200 hover:border-orange-500 rounded-xl p-8 text-left transition-all hover:shadow-lg"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-7 w-7 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Closeout</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Post-show final settlement with actual numbers and artist payout
                </p>
                <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                  Post-Show
                </span>
              </div>
            </div>
          </button>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-500 mb-4">Or</p>
          <button
            onClick={() => navigate('/offers')}
            className="px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold hover:border-gray-400 transition-colors"
          >
            Load Existing Event
          </button>
        </div>
      </div>
    </div>
  );
}
