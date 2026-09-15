import { X, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpgradePromptProps {
  message: string;
  onClose?: () => void;
}

export function UpgradePrompt({ message, onClose }: UpgradePromptProps) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1A1D1F] border border-gray-800 rounded-3xl p-8 max-w-md w-full relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="w-16 h-16 bg-gradient-to-br from-[#C4FF0D] to-[#A3D60A] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Sparkles className="h-8 w-8 text-black" />
        </div>

        <h3 className="text-2xl font-bold text-white mb-3 text-center">
          Upgrade Required
        </h3>

        <p className="text-gray-400 text-center mb-8">
          {message}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              navigate('/pricing');
              onClose?.();
            }}
            className="w-full bg-[#C4FF0D] text-black hover:bg-[#A3D60A] px-6 py-4 rounded-2xl font-bold transition-colors inline-flex items-center justify-center gap-2"
          >
            View Upgrade Options <ArrowRight className="h-5 w-5" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-full border-2 border-gray-700 text-white hover:bg-[#252A2E] px-6 py-4 rounded-2xl font-semibold transition-colors"
            >
              Maybe Later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
