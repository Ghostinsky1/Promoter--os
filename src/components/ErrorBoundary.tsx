import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy } from 'lucide-react';

/**
 * Stops one broken screen from taking down the whole app.
 *
 * Without this, a single render error unmounts everything and you get a blank
 * page that stays blank even when you navigate away — the app looks dead until
 * a full reload. Now the broken screen says what went wrong, everything else
 * keeps working, and going to another page clears it (App.tsx keys this on the
 * current path, so it resets on navigation).
 */

interface Props { children: ReactNode }
interface State { error: Error | null; info: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Keep the detail around so it can be copied and sent on.
    this.setState({ info: info?.componentStack ?? '' });
    console.error('Screen crashed:', error, info);
  }

  copyDetails = () => {
    const { error, info } = this.state;
    const text = [
      `Page: ${window.location.pathname}`,
      `Error: ${error?.name}: ${error?.message}`,
      error?.stack ? `\nStack:\n${error.stack}` : '',
      info ? `\nComponent:\n${info}` : '',
    ].join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-[#14171E] border border-[#2A3040] rounded-3xl p-7">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-[#FFB86B]/15 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#FFB86B]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-white leading-tight">This page didn't load</h2>
              <p className="text-gray-400 text-sm mt-1">
                Your data is safe — nothing was saved or changed. The rest of the app still works.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0B0D12] border border-[#2A3040] p-4 mb-5">
            <p className="font-label text-[10px] tracking-[0.18em] uppercase text-gray-500 mb-2">What went wrong</p>
            <p className="text-sm text-[#FF9E9E] break-words font-mono leading-relaxed">
              {error.name}: {error.message}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => window.location.reload()}
              className="sm:col-span-2 h-12 rounded-xl bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] font-bold transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Reload the page
            </button>
            <button
              onClick={this.copyDetails}
              className="h-12 rounded-xl bg-[#22262F] hover:bg-[#2A3040] border border-[#2A3040] text-white font-bold transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Copy className="w-4 h-4 text-[#8FD3FF]" /> Copy details
            </button>
          </div>

          <p className="text-gray-500 text-xs mt-4 text-center">
            Copy the details and send them over — they say exactly which line broke.
          </p>
        </div>
      </div>
    );
  }
}
