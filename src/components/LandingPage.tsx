import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2, X, FileText, DollarSign, Sparkles, Calendar,
  Upload, BarChart3, Clock, TrendingUp, Award, Target,
  Star, Music, Mic, Guitar, Ticket, Radio, Disc, Users, ChevronDown, MessageSquare, Zap
} from 'lucide-react';

export function LandingPage() {
  const navigate = useNavigate();
  const [dealScore, setDealScore] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);
  const [visibleSteps, setVisibleSteps] = useState<Set<number>>(new Set());
  const stepsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const scoreTimer = setTimeout(() => {
      let current = 0;
      const interval = setInterval(() => {
        current += 1;
        setDealScore(current);
        if (current >= 87) clearInterval(interval);
      }, 15);
    }, 500);

    const progressTimer = setTimeout(() => {
      setProgressWidth(75);
    }, 800);

    return () => {
      clearTimeout(scoreTimer);
      clearTimeout(progressTimer);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = stepsRef.current.findIndex((ref) => ref === entry.target);
            if (index !== -1) {
              setVisibleSteps((prev) => new Set(prev).add(index));
            }
          }
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -50px 0px' }
    );

    stepsRef.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#1140F0]">
      <nav className="fixed top-0 w-full bg-[#14171E]/95 backdrop-blur-lg border-b border-gray-800 z-50 animate-[slideDown_0.5s_ease-out]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/promoter-os-mark.png"
              alt="PROMOTER OS Logo"
              className="w-10 h-10 object-contain"
            />
            <img src="/promoter-os-wordmark.png" alt="PROMOTER OS" className="h-6 w-auto object-contain" />
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-[#A8B2C1] hover:text-[#8FD3FF] transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-[#A8B2C1] hover:text-[#8FD3FF] transition-colors">
              Pricing
            </a>
            <button
              onClick={() => navigate('/login')}
              className="text-[#A8B2C1] hover:text-[#8FD3FF] transition-colors"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="bg-[#8FD3FF] text-[#04214D] hover:bg-[#6FB8F2] font-semibold px-6 py-2 rounded-xl transition-colors"
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </nav>

      <section className="pt-8 md:pt-16 pb-8 md:pb-16 px-4 md:px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-0 animate-[fadeIn_2s_ease-out_0.5s_forwards]">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(to right, rgba(196, 255, 13, 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(196, 255, 13, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
            maskImage: 'radial-gradient(ellipse 80% 50% at 50% 40%, black 0%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 50% at 50% 40%, black 0%, transparent 80%)'
          }}></div>
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse 60% 40% at 50% 35%, rgba(196, 255, 13, 0.03), transparent 70%)'
          }}></div>

          <Mic className="absolute top-[15%] left-[10%] w-16 h-16 md:w-24 md:h-24 text-[#8FD3FF] opacity-5 animate-[float_6s_ease-in-out_infinite]" style={{ animationDelay: '0s' }} />
          <Guitar className="absolute top-[25%] right-[15%] w-20 h-20 md:w-32 md:h-32 text-[#8FD3FF] opacity-5 animate-[float_8s_ease-in-out_infinite] rotate-12" style={{ animationDelay: '1s' }} />
          <Ticket className="absolute top-[45%] left-[8%] w-14 h-14 md:w-20 md:h-20 text-[#8FD3FF] opacity-5 animate-[float_7s_ease-in-out_infinite] -rotate-12" style={{ animationDelay: '2s' }} />
          <Music className="absolute top-[60%] right-[12%] w-16 h-16 md:w-24 md:h-24 text-[#8FD3FF] opacity-5 animate-[float_9s_ease-in-out_infinite]" style={{ animationDelay: '0.5s' }} />
          <Radio className="absolute top-[35%] right-[8%] w-12 h-12 md:w-16 md:h-16 text-[#8FD3FF] opacity-5 animate-[float_7s_ease-in-out_infinite] rotate-45" style={{ animationDelay: '1.5s' }} />
          <Disc className="absolute top-[20%] left-[20%] w-14 h-14 md:w-20 md:h-20 text-[#8FD3FF] opacity-5 animate-[float_10s_ease-in-out_infinite]" style={{ animationDelay: '2.5s' }} />
          <Users className="absolute top-[50%] left-[15%] w-16 h-16 md:w-24 md:h-24 text-[#8FD3FF] opacity-5 animate-[float_8s_ease-in-out_infinite] -rotate-6" style={{ animationDelay: '3s' }} />
          <Star className="absolute top-[10%] right-[25%] w-12 h-12 md:w-16 md:h-16 text-[#8FD3FF] opacity-5 animate-[float_6s_ease-in-out_infinite] rotate-12" style={{ animationDelay: '1s' }} />
          <DollarSign className="absolute top-[55%] right-[20%] w-14 h-14 md:w-20 md:h-20 text-[#8FD3FF] opacity-5 animate-[float_7.5s_ease-in-out_infinite]" style={{ animationDelay: '2s' }} />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-block mb-8 px-6 py-3 bg-[#22262F] rounded-full border border-gray-800 animate-[fadeIn_0.6s_ease-out]">
              <span className="text-[#8FD3FF] font-semibold text-sm">
                Built By Promoters, For Promoters
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-6 text-white leading-tight animate-[fadeIn_0.8s_ease-out_0.2s_both]">
              Know Your{' '}
              <span
                className="inline-block bg-gradient-to-r from-[#8FD3FF] via-[#BFE6FF] to-[#8FD3FF] bg-clip-text text-transparent animate-[shimmer_3s_ease-in-out_infinite]"
                style={{
                  backgroundSize: '200% auto',
                }}
              >
                Profit
              </span>
              {' '}Before You Book the Show.
            </h1>

            <p className="text-base sm:text-lg text-[#A8B2C1] mb-8 max-w-3xl mx-auto leading-relaxed animate-[fadeIn_0.8s_ease-out_0.4s_both]">
              Create professional offers in minutes, track every dollar from estimate to settlement, and stop guessing if a deal makes sense.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8 animate-[fadeIn_0.8s_ease-out_0.6s_both]">
              <button
                onClick={() => navigate('/signup')}
                className="bg-[#8FD3FF] text-[#04214D] hover:bg-[#6FB8F2] text-lg px-10 py-7 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95"
              >
                Start Free Trial →
              </button>
              <button
                onClick={() => navigate('/login')}
                className="border-2 border-gray-700 text-white hover:bg-[#22262F] text-lg px-10 py-7 rounded-2xl transition-all hover:scale-105 active:scale-95"
              >
                See How It Works
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-[#A8B2C1]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#8FD3FF]" />
                <span>7-day free trial</span>
              </div>
              <span className="text-gray-600">•</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#8FD3FF]" />
                <span>Try it on your next deal</span>
              </div>
              <span className="text-gray-600">•</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#8FD3FF]" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          <div className="mt-8 md:mt-12 relative animate-[fadeIn_1s_ease-out_0.8s_both]">
            <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border-2 md:border-4 border-gray-800 shadow-2xl hover:shadow-[#8FD3FF]/20 hover:shadow-3xl transition-shadow duration-500">
              <div className="bg-[#14171E] p-3 sm:p-6 md:p-8">
                <div className="bg-[#22262F] rounded-xl md:rounded-2xl shadow-xl p-3 sm:p-6 md:p-8 border border-gray-800">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-red-500"></div>
                      <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-[#8FD3FF]/10 rounded-lg border border-[#8FD3FF]/30">
                      <Sparkles className="h-2.5 w-2.5 md:h-3 md:w-3 text-[#8FD3FF]" />
                      <span className="text-[10px] md:text-xs font-semibold text-[#8FD3FF]">AI ANALYSIS</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4">
                    <div className="lg:col-span-7 space-y-2 md:space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 md:gap-3">
                          <Music className="h-4 w-4 md:h-5 md:w-5 text-[#8FD3FF] flex-shrink-0" />
                          <div>
                            <h3 className="text-white font-bold text-xs md:text-sm">The Midnight - Summer Tour 2025</h3>
                            <p className="text-[#A8B2C1] text-[10px] md:text-xs">The Wiltern, Los Angeles</p>
                          </div>
                        </div>
                        <div className="px-2 md:px-3 py-0.5 md:py-1 bg-green-500/20 rounded-full">
                          <span className="text-green-400 text-[10px] md:text-xs font-semibold">CONFIRMED</span>
                        </div>
                      </div>

                      <div className="bg-[#14171E] rounded-lg md:rounded-xl p-3 md:p-4 border border-gray-700">
                        <div className="grid grid-cols-3 gap-2 md:gap-3 mb-3 md:mb-4">
                          <div>
                            <p className="text-[#A8B2C1] text-[10px] md:text-xs mb-1">Deal Type</p>
                            <p className="text-white font-semibold text-xs md:text-sm">Guarantee vs %</p>
                          </div>
                          <div>
                            <p className="text-[#A8B2C1] text-[10px] md:text-xs mb-1">Capacity</p>
                            <p className="text-white font-semibold text-xs md:text-sm">1,850</p>
                          </div>
                          <div>
                            <p className="text-[#A8B2C1] text-[10px] md:text-xs mb-1">Avg Ticket</p>
                            <p className="text-white font-semibold text-xs md:text-sm">$45.00</p>
                          </div>
                        </div>

                        <div className="space-y-1.5 md:space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[#A8B2C1] text-[10px] md:text-xs">Projected Revenue</span>
                            <span className="text-white font-semibold text-xs md:text-sm">$83,250</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#A8B2C1] text-[10px] md:text-xs">Total Expenses</span>
                            <span className="text-white font-semibold text-xs md:text-sm">$62,400</span>
                          </div>
                          <div className="h-px bg-gray-700 my-1.5 md:my-2"></div>
                          <div className="flex justify-between items-center">
                            <span className="text-white font-bold text-xs md:text-sm">Net Profit</span>
                            <span className="text-[#8FD3FF] font-bold text-base md:text-lg">$20,850</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-1.5 md:h-2 mt-1.5 md:mt-2 overflow-hidden">
                            <div
                              className="bg-[#8FD3FF] h-1.5 md:h-2 rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${progressWidth}%` }}
                            ></div>
                          </div>
                          <p className="text-[#A8B2C1] text-[10px] md:text-xs">75% to break-even</p>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-5 space-y-2 md:space-y-3">
                      <div className="bg-gradient-to-br from-[#8FD3FF]/20 to-[#8FD3FF]/5 rounded-lg md:rounded-xl p-3 md:p-4 border-2 border-[#8FD3FF]/40 animate-[pulse_2s_ease-in-out_infinite]">
                        <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                          <Target className="h-3 w-3 md:h-4 md:w-4 text-[#8FD3FF]" />
                          <span className="text-[#8FD3FF] font-bold text-[10px] md:text-xs">DEAL SCORE</span>
                        </div>
                        <div className="flex items-end gap-1.5 md:gap-2 mb-2">
                          <span className="text-3xl md:text-5xl font-bold text-[#8FD3FF] transition-all duration-300">
                            {dealScore}
                          </span>
                          <span className="text-[#A8B2C1] text-xs md:text-sm mb-1 md:mb-2">/100</span>
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-[#8FD3FF] rounded-lg animate-[bounce_1s_ease-in-out_2s]">
                          <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-[#04214D]" />
                          <span className="text-[#04214D] font-bold text-xs md:text-sm">STRONG BUY</span>
                        </div>
                      </div>

                      <div className="bg-[#14171E] rounded-lg md:rounded-xl p-3 md:p-4 border border-gray-700 space-y-2 md:space-y-3">
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <Award className="h-3 w-3 md:h-4 md:w-4 text-[#8FD3FF]" />
                          <span className="text-white font-semibold text-[10px] md:text-xs">AI Insights</span>
                        </div>
                        <div className="space-y-1.5 md:space-y-2">
                          <div className="flex items-start gap-1.5 md:gap-2">
                            <CheckCircle2 className="h-2.5 w-2.5 md:h-3 md:w-3 text-green-400 mt-0.5 flex-shrink-0" />
                            <p className="text-[#A8B2C1] text-[10px] md:text-xs">This venue has 92% sell-through rate</p>
                          </div>
                          <div className="flex items-start gap-1.5 md:gap-2">
                            <CheckCircle2 className="h-2.5 w-2.5 md:h-3 md:w-3 text-green-400 mt-0.5 flex-shrink-0" />
                            <p className="text-[#A8B2C1] text-[10px] md:text-xs">Strong profit margin at 25%</p>
                          </div>
                          <div className="flex items-start gap-1.5 md:gap-2">
                            <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                            <p className="text-[#A8B2C1] text-[10px] md:text-xs">Similar shows avg 78% capacity</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 bg-[#8FD3FF]/10 blur-3xl -z-10 rounded-full"></div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-[#14171E]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full"></div>
                <div className="relative bg-gradient-to-br from-red-600 to-red-800 p-4 rounded-2xl">
                  <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" opacity="0.7" />
                  </svg>
                </div>
              </div>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white leading-tight">
              <span className="text-red-400">Spreadsheets Cost Promoters Money.</span>
              <br />
              <span className="bg-gradient-to-r from-[#8FD3FF] to-[#6FB8F2] bg-clip-text text-transparent">
                PROMOTER OS Saves It.
              </span>
            </h2>
            <p className="text-lg text-[#A8B2C1] max-w-2xl mx-auto">
              Every miscalculation, missed detail, or last-minute scramble chips away at your profit.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-8 bg-[#22262F] border border-gray-800 rounded-2xl hover:border-[#8FD3FF]/50 transition-all hover:scale-105 animate-[fadeIn_0.6s_ease-out]">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#8FD3FF]/10 rounded-xl">
                  <CheckCircle2 className="h-6 w-6 text-[#8FD3FF]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-white">Stop rebuilding offers in Excel</h3>
                  <p className="text-[#A8B2C1]">
                    Professional offer sheets in 10 minutes. Save templates. Auto-calculate everything.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 bg-[#22262F] border border-gray-800 rounded-2xl hover:border-[#8FD3FF]/50 transition-all hover:scale-105 animate-[fadeIn_0.6s_ease-out_0.1s_both]">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#8FD3FF]/10 rounded-xl">
                  <CheckCircle2 className="h-6 w-6 text-[#8FD3FF]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-white">Know real profit, not guesses</h3>
                  <p className="text-[#A8B2C1]">
                    See projected vs actual revenue. Track every expense. Know your margins before you commit.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 bg-[#22262F] border border-gray-800 rounded-2xl hover:border-[#8FD3FF]/50 transition-all hover:scale-105 animate-[fadeIn_0.6s_ease-out_0.2s_both]">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#8FD3FF]/10 rounded-xl">
                  <CheckCircle2 className="h-6 w-6 text-[#8FD3FF]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-white">Track what worked after every show</h3>
                  <p className="text-[#A8B2C1]">
                    Settlement tracking shows you what actually happened. Learn from wins and losses.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 bg-[#22262F] border border-gray-800 rounded-2xl hover:border-[#8FD3FF]/50 transition-all hover:scale-105 animate-[fadeIn_0.6s_ease-out_0.3s_both]">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#8FD3FF]/10 rounded-xl">
                  <CheckCircle2 className="h-6 w-6 text-[#8FD3FF]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-white">See which deals are worth repeating</h3>
                  <p className="text-[#A8B2C1]">
                    AI analyzes your history. Know which venues and artists make you money.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-[#1140F0]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#8FD3FF]/10 rounded-full mb-6">
              <div className="w-2 h-2 bg-[#8FD3FF] rounded-full animate-pulse"></div>
              <span className="text-[#8FD3FF] font-bold text-sm tracking-wide">HOW IT WORKS</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white leading-tight">
              From Deal → Profit, in Minutes
            </h2>
            <p className="text-base text-[#A8B2C1]">
              Five simple steps to run better shows and make more money
            </p>
          </div>

          <div className="space-y-4">
            <div
              ref={(el) => (stepsRef.current[0] = el)}
              className={`flex gap-4 items-start transition-all duration-700 ease-out ${
                visibleSteps.has(0)
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: '0ms' }}
            >
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-[#8FD3FF] rounded-xl flex items-center justify-center text-2xl font-bold text-[#04214D]">
                  1
                </div>
              </div>
              <div className="flex-1 bg-[#22262F] border border-gray-800 rounded-xl p-5 hover:border-[#8FD3FF]/30 transition-colors">
                <h3 className="text-xl font-bold text-white mb-2">Create the Offer</h3>
                <p className="text-[#A8B2C1] text-sm leading-relaxed mb-3">
                  Enter the artist, venue, date, and deal type. PROMOTER OS calculates break-even, fees, and profit automatically.
                </p>
                <div className="flex items-center gap-2 text-[#8FD3FF] text-sm font-bold">
                  <FileText className="h-4 w-4" />
                  <span>Auto-calculations in real-time</span>
                </div>
              </div>
            </div>

            <div
              ref={(el) => (stepsRef.current[1] = el)}
              className={`flex gap-4 items-start transition-all duration-700 ease-out ${
                visibleSteps.has(1)
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: '100ms' }}
            >
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-[#8FD3FF] rounded-xl flex items-center justify-center text-2xl font-bold text-[#04214D]">
                  2
                </div>
              </div>
              <div className="flex-1 bg-[#22262F] border border-gray-800 rounded-xl p-5 hover:border-[#8FD3FF]/30 transition-colors">
                <h3 className="text-xl font-bold text-white mb-2">Send It</h3>
                <p className="text-[#A8B2C1] text-sm leading-relaxed mb-3">
                  Generate a clean, professional PDF and send it instantly. No more formatting headaches.
                </p>
                <div className="flex items-center gap-2 text-[#8FD3FF] text-sm font-bold">
                  <Upload className="h-4 w-4" />
                  <span>One-click PDF generation</span>
                </div>
              </div>
            </div>

            <div
              ref={(el) => (stepsRef.current[2] = el)}
              className={`flex gap-4 items-start transition-all duration-700 ease-out ${
                visibleSteps.has(2)
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: '200ms' }}
            >
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-[#8FD3FF] rounded-xl flex items-center justify-center text-2xl font-bold text-[#04214D]">
                  3
                </div>
              </div>
              <div className="flex-1 bg-[#22262F] border border-gray-800 rounded-xl p-5 hover:border-[#8FD3FF]/30 transition-colors">
                <h3 className="text-xl font-bold text-white mb-2">Run the Show</h3>
                <p className="text-[#A8B2C1] text-sm leading-relaxed mb-3">
                  Track changes, expenses, and sales in one place. Everything updates in real-time.
                </p>
                <div className="flex items-center gap-2 text-[#8FD3FF] text-sm font-bold">
                  <BarChart3 className="h-4 w-4" />
                  <span>Live tracking dashboard</span>
                </div>
              </div>
            </div>

            <div
              ref={(el) => (stepsRef.current[3] = el)}
              className={`flex gap-4 items-start transition-all duration-700 ease-out ${
                visibleSteps.has(3)
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: '300ms' }}
            >
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-[#8FD3FF] rounded-xl flex items-center justify-center text-2xl font-bold text-[#04214D]">
                  4
                </div>
              </div>
              <div className="flex-1 bg-[#22262F] border border-gray-800 rounded-xl p-5 hover:border-[#8FD3FF]/30 transition-colors">
                <h3 className="text-xl font-bold text-white mb-2">Settle & Learn</h3>
                <p className="text-[#A8B2C1] text-sm leading-relaxed mb-3">
                  After the show, enter actuals and see your real profit. Build institutional knowledge.
                </p>
                <div className="flex items-center gap-2 text-[#8FD3FF] text-sm font-bold">
                  <DollarSign className="h-4 w-4" />
                  <span>Projected vs actual comparison</span>
                </div>
              </div>
            </div>

            <div
              ref={(el) => (stepsRef.current[4] = el)}
              className={`flex gap-4 items-start transition-all duration-700 ease-out ${
                visibleSteps.has(4)
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: '400ms' }}
            >
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-[#8FD3FF] rounded-xl flex items-center justify-center text-2xl font-bold text-[#04214D]">
                  5
                </div>
              </div>
              <div className="flex-1 bg-[#22262F] border border-gray-800 rounded-xl p-5 hover:border-[#8FD3FF]/30 transition-colors relative">
                <div className="absolute top-3 right-3">
                  <span className="px-2.5 py-1 bg-[#8FD3FF] text-[#04214D] text-xs font-bold rounded">PRO</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Check the Deal Score</h3>
                <p className="text-[#A8B2C1] text-sm leading-relaxed mb-3">
                  AI scores the deal and flags risk before you commit. Make smarter decisions with data.
                </p>
                <div className="flex items-center gap-2 text-[#8FD3FF] text-sm font-bold">
                  <Sparkles className="h-4 w-4" />
                  <span>AI-powered insights</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-[#14171E]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              Does This Sound Like You?
            </h2>
            <p className="text-lg text-[#A8B2C1]">Be honest 👇</p>
          </div>

          <div className="bg-gradient-to-br from-[#22262F] to-[#14171E] border-2 border-[#8FD3FF]/30 rounded-3xl p-8 md:p-12">
            <div className="space-y-5">
              {[
                "You stress over whether a deal is actually good",
                "You don't know your real profit until after the show",
                "You waste time hunting for numbers",
                "You bounce between spreadsheets, email, and notes",
                "You've had a 'sold well but still lost money' show",
                "You feel less professional using spreadsheets with agents",
                "You second-guess pricing after tickets go live"
              ].map((item, index) => (
                <label key={index} className="flex items-start gap-4 cursor-pointer group">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-6 h-6 border-2 border-gray-600 rounded group-hover:border-[#8FD3FF] transition-colors flex items-center justify-center">
                      <div className="w-3 h-3 bg-[#8FD3FF] rounded opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                  </div>
                  <span className="text-white text-lg group-hover:text-[#8FD3FF] transition-colors">{item}</span>
                </label>
              ))}
            </div>

            <div className="mt-12 pt-8 border-t border-gray-700 text-center">
              <p className="text-xl md:text-2xl font-bold text-white mb-6">
                If you checked even <span className="text-[#8FD3FF]">one</span>:
              </p>
              <p className="text-2xl md:text-3xl font-bold mb-8">
                <span className="bg-gradient-to-r from-[#8FD3FF] to-[#6FB8F2] bg-clip-text text-transparent">
                  PROMOTER OS will save you time — and money.
                </span>
              </p>
              <button
                onClick={() => navigate('/signup')}
                className="px-8 py-4 bg-[#8FD3FF] text-[#04214D] font-bold text-lg rounded-xl hover:bg-[#6FB8F2] transition-all hover:scale-105 shadow-lg shadow-[#8FD3FF]/20"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-6 bg-[#1140F0]">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-[#22262F] border border-gray-800 rounded-2xl hover:border-[#8FD3FF]/50 transition-all">
              <div className="w-12 h-12 bg-[#8FD3FF]/10 rounded-xl flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-[#8FD3FF]" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">Create Offers in 10 Minutes</h3>
              <p className="text-[#A8B2C1] text-sm">
                Professional offer sheets with 4 deal structures. Everything auto-calculated.
              </p>
            </div>

            <div className="p-6 bg-[#22262F] border border-gray-800 rounded-2xl hover:border-[#8FD3FF]/50 transition-all">
              <div className="w-12 h-12 bg-[#8FD3FF]/10 rounded-xl flex items-center justify-center mb-4">
                <DollarSign className="h-6 w-6 text-[#8FD3FF]" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">Settlement Tracking</h3>
              <p className="text-[#A8B2C1] text-sm">
                Compare projected vs actual. Learn from every show.
              </p>
            </div>

            <div className="p-6 bg-gradient-to-br from-[#8FD3FF]/10 to-[#8FD3FF]/5 border-2 border-[#8FD3FF]/50 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-[#8FD3FF] rounded-xl flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-[#04214D]" />
                </div>
                <span className="px-3 py-1 bg-[#8FD3FF] text-[#04214D] text-xs font-bold rounded-full">
                  PRO
                </span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">AI Deal Analyzer</h3>
              <p className="text-[#A8B2C1] text-sm">
                Know if a deal is worth it before you commit. Scored 0-100.
              </p>
            </div>

            <div className="p-6 bg-gradient-to-br from-[#8FD3FF]/10 to-[#8FD3FF]/5 border-2 border-[#8FD3FF]/50 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-[#8FD3FF] rounded-xl flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-[#04214D]" />
                </div>
                <span className="px-3 py-1 bg-[#8FD3FF] text-[#04214D] text-xs font-bold rounded-full">
                  PRO
                </span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">Tour Management</h3>
              <p className="text-[#A8B2C1] text-sm">
                Group shows into tours. Track P&L across multiple markets.
              </p>
            </div>

            <div className="p-6 bg-[#22262F] border border-gray-800 rounded-2xl hover:border-[#8FD3FF]/50 transition-all">
              <div className="w-12 h-12 bg-[#8FD3FF]/10 rounded-xl flex items-center justify-center mb-4">
                <Upload className="h-6 w-6 text-[#8FD3FF]" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">Import From Anywhere</h3>
              <p className="text-[#A8B2C1] text-sm">
                Upload CSV, Excel, or PDF. Auto-parse everything.
              </p>
            </div>

            <div className="p-6 bg-[#22262F] border border-gray-800 rounded-2xl hover:border-[#8FD3FF]/50 transition-all">
              <div className="w-12 h-12 bg-[#8FD3FF]/10 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-[#8FD3FF]" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">Dashboard + Calendar</h3>
              <p className="text-[#A8B2C1] text-sm">
                See all shows at a glance. Filter by status, venue, artist.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* ---------- MCP connector: run your events from a chat ---------- */}
      <section id="ai-connector" className="py-20 px-4 sm:px-6 bg-[#08090D] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(143,211,255,0.12) 0%, rgba(8,9,13,0) 70%)' }} />
        <div className="max-w-7xl mx-auto relative">

          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#8FD3FF]/10 border border-[#8FD3FF]/30 mb-5">
              <Zap className="h-3.5 w-3.5 text-[#8FD3FF]" />
              <span className="font-label text-[11px] tracking-[0.2em] text-[#8FD3FF] uppercase">New · AI Connector</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-white leading-tight">
              Your events are one chat away.
            </h2>
            <p className="text-[#A8B2C1] text-base sm:text-lg max-w-2xl mx-auto">
              Connect PROMOTER OS to your own AI and run the whole night by typing. Ask for the numbers,
              build the offer, email the agent — without opening the app.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-start">

            {/* chat mockup */}
            <div className="bg-[#14171E] border border-[#2A3040] rounded-3xl p-4 sm:p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-[#2A3040]">
                <MessageSquare className="h-4 w-4 text-[#8FD3FF] flex-shrink-0" />
                <span className="font-label text-[11px] tracking-[0.18em] text-gray-400 uppercase truncate">
                  Your AI · PROMOTER OS connected
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex justify-end">
                  <div className="bg-[#8FD3FF] text-[#04214D] rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-semibold max-w-[85%]">
                    What's my break-even on the Kansas City show?
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-[#22262F] text-gray-200 rounded-2xl rounded-bl-md px-4 py-3 text-sm max-w-[90%] border border-[#2A3040]">
                    411 tickets — 65% of the room. At 100% sold you clear <span className="text-[#8FD3FF] font-semibold">$5,501</span>.
                    Capital needed up front is $800.
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-[#8FD3FF] text-[#04214D] rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-semibold max-w-[85%]">
                    Build the same offer for Nov 14 at $2,500 and email it to the agent.
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-[#22262F] text-gray-200 rounded-2xl rounded-bl-md px-4 py-3 text-sm max-w-[90%] border border-[#2A3040]">
                    Offer created and the PDF is attached. Here's the draft — say the word and it goes out.
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-[#2A3040]">
                <p className="font-label text-[11px] tracking-[0.18em] text-gray-500 uppercase mb-2">Nothing sends without your yes</p>
                <p className="text-[#A8B2C1] text-sm leading-relaxed">
                  It drafts, calculates and shows you the result first. Emails, settlements and anything that
                  leaves your hands wait for you to confirm.
                </p>
              </div>
            </div>

            {/* what it does */}
            <div>
              <div className="space-y-3 mb-8">
                {[
                  ['Ask anything about your shows', 'Offers, lineups, tasks, run of show, settlements — answered in plain language.'],
                  ['Build and edit offers by typing', 'Deal terms, ticket scaling and expenses, recalculated as you talk.'],
                  ['Run the numbers before you commit', 'What-if a guarantee, a ticket price or a whole deal structure. Nothing is saved until you say so.'],
                  ['Generate the PDF and send it', 'The same offer sheet the app makes, emailed to the agent from your own address.'],
                ].map(([title, body]) => (
                  <div key={title} className="flex gap-3 p-4 rounded-2xl bg-[#14171E] border border-[#2A3040]">
                    <CheckCircle2 className="h-5 w-5 text-[#8FD3FF] flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h3 className="text-white font-bold text-sm mb-1">{title}</h3>
                      <p className="text-[#A8B2C1] text-sm leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-[#2A3040] bg-[#0B0D12] p-5">
                <p className="font-label text-[11px] tracking-[0.18em] text-[#8FD3FF] uppercase mb-2">How it works</p>
                <p className="text-[#A8B2C1] text-sm leading-relaxed mb-4">
                  Paste one link into Claude — or any assistant that supports MCP — sign in once, and approve the
                  connection. It only ever sees your own organization's data, every action runs under your login,
                  and you can disconnect it at any time.
                </p>
                <button
                  onClick={() => navigate('/signup')}
                  className="w-full sm:w-auto bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] px-6 py-3 rounded-xl font-bold transition-colors text-sm"
                >
                  Start free trial
                </button>
                <p className="text-gray-500 text-xs mt-3">On Pro and Agency Scale. No extra setup fee.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Free playbook — CRT band */}
      <section id="playbook" className="crt-band py-20 px-4 sm:px-6 bg-[#1140F0] relative overflow-hidden">
        <div className="crt-grid" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="font-label text-[11px] tracking-[0.22em] text-[#cfe4ff] uppercase mb-3">[ Free promoter playbook ]</p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-[1.05]">
                Stop paying artists <span className="text-[#8FD3FF]">your profit.</span>
              </h2>
              <p className="text-[#dbe7ff] mt-4 max-w-md">
                Twelve pages, seven steps, one real show followed from first offer to final settlement.
                Know your break-even before you make the offer.
              </p>
              <a
                href="/playbook/"
                className="inline-flex items-center justify-center gap-2 mt-7 bg-[#8FD3FF] hover:bg-[#B4E2FF] text-[#04214D] px-7 py-4 rounded-xl font-bold transition-colors"
              >
                Get it free &darr;
              </a>
              <p className="text-[#cfe0ff] text-sm mt-3">No cost. Instant download.</p>
            </div>

            <div className="bg-[#14171E] rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F0605A]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#F2B640]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#8FD3FF]" />
                <span className="font-label text-[10px] tracking-[0.18em] uppercase text-white ml-2">Inside: one show, run the right way</span>
              </div>
              <div className="p-5 grid grid-cols-3 gap-3">
                <div className="bg-[#22262F] rounded-xl p-4">
                  <p className="text-gray-400 text-xs mb-1">Break-even</p>
                  <p className="text-white text-xl sm:text-2xl font-bold whitespace-nowrap">400 tix</p>
                </div>
                <div className="bg-[#22262F] rounded-xl p-4">
                  <p className="text-gray-400 text-xs mb-1">Artist fee</p>
                  <p className="text-white text-xl sm:text-2xl font-bold whitespace-nowrap">$5,000</p>
                </div>
                <div className="bg-[#22262F] rounded-xl p-4">
                  <p className="text-gray-400 text-xs mb-1">You keep at 550</p>
                  <p className="text-[#8FD3FF] text-xl sm:text-2xl font-bold whitespace-nowrap">$4,500</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 px-6 bg-[#14171E]">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="p-8 bg-[#22262F] border border-gray-800 rounded-2xl hover:border-gray-700 transition-all">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2 text-white">Starter</h3>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-5xl font-bold text-white">$49</span>
                  <span className="text-[#A8B2C1]">/mo</span>
                </div>
              </div>

              <button
                onClick={() => navigate('/signup')}
                className="w-full mb-6 bg-gray-700 hover:bg-gray-600 text-white py-4 rounded-xl font-semibold transition-colors"
              >
                Start Trial
              </button>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-[#A8B2C1]">Up to 10 active events</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-[#A8B2C1]">1 seat</span>
                </div>
                <div className="flex items-start gap-3">
                  <X className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-600">No AI</span>
                </div>
                <div className="flex items-start gap-3">
                  <X className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-600">No tours</span>
                </div>
                <div className="flex items-start gap-3">
                  <X className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-600">No AI connector</span>
                </div>
              </div>
            </div>

            <div className="p-8 bg-gradient-to-br from-[#8FD3FF]/20 to-[#8FD3FF]/5 border-2 border-[#8FD3FF] rounded-2xl relative transform scale-105 shadow-2xl shadow-[#8FD3FF]/20">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="px-6 py-2 bg-[#8FD3FF] text-[#04214D] rounded-full font-bold text-sm">
                  MOST POPULAR
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2 text-white">Pro</h3>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-5xl font-bold text-[#8FD3FF]">$99</span>
                  <span className="text-[#A8B2C1]">/mo</span>
                </div>
              </div>

              <button
                onClick={() => navigate('/signup')}
                className="w-full mb-6 bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] py-4 rounded-xl font-bold transition-colors"
              >
                Start Trial
              </button>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-white font-semibold">Unlimited events</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-white font-semibold">Unlimited tours</span>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-[#8FD3FF] mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-white font-semibold">AI Deal Analyzer</span>
                </div>
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 text-[#8FD3FF] mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-white font-semibold">AI connector (run your shows from chat)</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-white font-semibold">2 seats</span>
                </div>
              </div>
            </div>

            <div className="p-8 bg-[#22262F]/50 border border-gray-800 rounded-2xl opacity-75">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2 text-white">Agency Scale</h3>
                <div className="inline-block px-3 py-1 bg-gray-700 rounded-full text-xs font-bold text-gray-400 mb-4">
                  COMING SOON
                </div>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-5xl font-bold text-white">$297</span>
                  <span className="text-[#A8B2C1]">/mo</span>
                </div>
              </div>

              <button className="w-full mb-6 bg-gray-700 hover:bg-gray-600 text-white py-4 rounded-xl font-semibold transition-colors">
                Join Waitlist
              </button>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-400">5+ seats</span>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-400">Advanced AI</span>
                </div>
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-400">AI connector</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-400">White-label PDFs</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-[#1140F0]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#8FD3FF]/10 rounded-full mb-6">
              <BarChart3 className="h-4 w-4 text-[#8FD3FF]" />
              <span className="text-[#8FD3FF] font-semibold text-sm">PLANS & FEATURES</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              What You Get
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full bg-[#14171E] rounded-2xl border border-gray-800 overflow-hidden">
              <thead className="bg-[#22262F]">
                <tr>
                  <th className="px-6 py-4 text-left text-white font-bold border-b border-gray-800">Feature</th>
                  <th className="px-6 py-4 text-center text-white font-bold border-b border-gray-800">Starter</th>
                  <th className="px-6 py-4 text-center text-white font-bold border-b border-gray-800 bg-[#8FD3FF]/10">
                    <div className="flex items-center justify-center gap-2">
                      <span>Pro</span>
                      <span className="px-2 py-0.5 bg-[#8FD3FF] text-[#04214D] text-xs font-bold rounded">POPULAR</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-white font-bold border-b border-gray-800">Agency</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="px-6 py-4 text-[#A8B2C1]">Active Events</td>
                  <td className="px-6 py-4 text-center text-white">10</td>
                  <td className="px-6 py-4 text-center text-white bg-[#8FD3FF]/5">Unlimited</td>
                  <td className="px-6 py-4 text-center text-white">Unlimited</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-6 py-4 text-[#A8B2C1]">Seats</td>
                  <td className="px-6 py-4 text-center text-white">1</td>
                  <td className="px-6 py-4 text-center text-white bg-[#8FD3FF]/5">2</td>
                  <td className="px-6 py-4 text-center text-white">5+</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-6 py-4 text-[#A8B2C1]">Offer Builder + PDFs</td>
                  <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-[#8FD3FF]/5"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-6 py-4 text-[#A8B2C1]">Settlement Tracking</td>
                  <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-[#8FD3FF]/5"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-6 py-4 text-[#A8B2C1]">Dashboard + Calendar</td>
                  <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-[#8FD3FF]/5"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-6 py-4 text-[#A8B2C1]">Imports (CSV / PDF)</td>
                  <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-[#8FD3FF]/5"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-6 py-4 text-[#A8B2C1]">Tour Management</td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-gray-600 mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-[#8FD3FF]/5"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-6 py-4 text-[#A8B2C1]">AI connector (Claude & other assistants)</td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-gray-600 mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-[#8FD3FF]/5"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-6 py-4 text-[#A8B2C1]">AI Deal Analyzer</td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-gray-600 mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-[#8FD3FF]/5"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="px-6 py-4 text-[#A8B2C1]">Advanced AI</td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-gray-600 mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-[#8FD3FF]/5"><X className="h-5 w-5 text-gray-600 mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mx-auto" /></td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-[#A8B2C1] font-semibold">Status</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full">Live</span>
                  </td>
                  <td className="px-6 py-4 text-center bg-[#8FD3FF]/5">
                    <span className="inline-block px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full">Live</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block px-3 py-1 bg-gray-700 text-gray-400 text-xs font-bold rounded-full">Soon</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-[#14171E]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-[#A8B2C1]">
              Everything you need to know about PROMOTER OS
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                question: "What is PROMOTER OS?",
                answer: "PROMOTER OS is a professional offer management platform designed specifically for concert promoters. It helps you create, manage, and analyze event offers with advanced calculations and AI-powered insights."
              },
              {
                question: "How does the free trial work?",
                answer: "You get full access to PROMOTER OS for 7 days, completely free. No credit card required. Try all features including AI insights and professional PDF generation."
              },
              {
                question: "Can I cancel my subscription anytime?",
                answer: "Yes, absolutely. You can cancel your subscription at any time with no penalties. Your access continues until the end of your current billing period."
              },
              {
                question: "What payment methods do you accept?",
                answer: "We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our secure payment processor, Stripe."
              },
              {
                question: "Is my data secure?",
                answer: "Absolutely. We use bank-level encryption (AES-256), secure authentication, and industry-standard security practices. Your data is backed up daily and never shared with third parties."
              },
              {
                question: "Can multiple people in my organization use PROMOTER OS?",
                answer: "Yes! Our Pro plan supports 2 seats and Agency supports 5+. Each team member gets their own login with appropriate permissions."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-[#22262F] border border-gray-800 rounded-xl overflow-hidden hover:border-[#8FD3FF]/30 transition-colors">
                <details className="group">
                  <summary className="px-6 py-5 flex items-center justify-between cursor-pointer list-none">
                    <h3 className="text-lg font-semibold text-white pr-4">{faq.question}</h3>
                    <ChevronDown className="h-5 w-5 text-[#8FD3FF] flex-shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-6 pb-5 text-[#A8B2C1]">
                    <p>{faq.answer}</p>
                  </div>
                </details>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-[#A8B2C1] mb-4">Have more questions?</p>
            <Link
              to="/faq"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#22262F] border border-gray-800 hover:border-[#8FD3FF]/50 text-white rounded-lg transition-colors"
            >
              View All FAQs
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gradient-to-br from-[#8FD3FF] to-[#6FB8F2]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-[#04214D]">
            Stop Guessing. Start Booking Smarter.
          </h2>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <button
              onClick={() => navigate('/signup')}
              className="bg-black text-[#8FD3FF] hover:bg-gray-900 text-lg px-10 py-7 rounded-2xl font-bold transition-colors"
            >
              Start Free Trial →
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-[#04214D]/70">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              <span>7-day free trial</span>
            </div>
            <span className="text-[#04214D]/40">•</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              <span>Try it on your next deal</span>
            </div>
            <span className="text-[#04214D]/40">•</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-[#1140F0] border-t border-gray-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
            Try it on your next deal.
          </h2>
          <button
            onClick={() => navigate('/signup')}
            className="px-10 py-5 bg-[#8FD3FF] text-[#04214D] font-bold text-xl rounded-xl hover:bg-[#6FB8F2] transition-all hover:scale-105 shadow-lg shadow-[#8FD3FF]/20 mb-6"
          >
            Start Free Trial →
          </button>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-[#A8B2C1]">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#8FD3FF]" />
              <span>7-day free trial</span>
            </div>
            <span className="text-gray-600">•</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#8FD3FF]" />
              <span>Try it on your next deal</span>
            </div>
            <span className="text-gray-600">•</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#8FD3FF]" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#1140F0] border-t border-gray-800 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img
                  src="/promoter-os-mark.png"
                  alt="PROMOTER OS Logo"
                  className="w-8 h-8 object-contain"
                />
                <img src="/promoter-os-wordmark.png" alt="PROMOTER OS" className="h-5 w-auto object-contain" />
              </div>
              <p className="text-sm text-[#A8B2C1]">
                Concert promotion software built by promoters, for promoters.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-[#A8B2C1]">
                <li><a href="#features" className="hover:text-[#8FD3FF]">Features</a></li>
                <li><a href="#pricing" className="hover:text-[#8FD3FF]">Pricing</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-[#A8B2C1]">
                <li><a href="#" className="hover:text-[#8FD3FF]">About</a></li>
                <li><a href="#" className="hover:text-[#8FD3FF]">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-[#A8B2C1]">
                <li><Link to="/privacy" className="hover:text-[#8FD3FF] transition-colors">Privacy</Link></li>
                <li><Link to="/terms" className="hover:text-[#8FD3FF] transition-colors">Terms</Link></li>
                <li><Link to="/security" className="hover:text-[#8FD3FF] transition-colors">Security</Link></li>
                <li><Link to="/faq" className="hover:text-[#8FD3FF] transition-colors">FAQ</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-sm text-[#6B7280]">
            <p>&copy; 2025 PROMOTER OS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
