import React, { useState, useEffect, useRef } from 'react';
import { Music2, Plus, User, LogOut, Menu, X, Settings, CreditCard, LayoutDashboard, FileText, Music } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

export function Header() {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [companyName, setCompanyName] = useState<string>('');
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/offers', label: 'My Offers', icon: FileText },
    { href: '/tours', label: 'Tours', icon: Music },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/subscription', label: 'Subscription', icon: CreditCard }
  ];

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      loadCompanySettings();
    }
  }, [user]);

  const loadCompanySettings = async () => {
    try {
      const { data } = await supabase
        .from('company_settings')
        .select('company_name')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (data?.company_name) {
        setCompanyName(data.company_name);
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <>
      <header className="bg-[#1A1D1F] border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link
              to={user ? "/dashboard" : "/"}
              className={`${user ? 'hidden md:flex' : 'flex'} items-center gap-2 group flex-shrink-0`}
            >
              <img
                src="/untitled_project_-_standard_1_(13).png"
                alt="PROMTP Logo"
                className="w-10 h-10 object-contain transform group-hover:scale-110 transition-transform"
              />
              <span className="text-2xl font-bold text-white">
                PROMTP
              </span>
            </Link>

            {user && (
              <>
                <nav className="hidden lg:flex items-center gap-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                          isActive(item.href)
                            ? 'bg-[#C4FF0D]/10 text-[#C4FF0D]'
                            : 'text-[#A8B3B8] hover:bg-[#252A2E] hover:text-white'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>

                <div className="hidden lg:flex items-center gap-3">
                  <Link to="/offers/create">
                    <button className="flex items-center gap-2 px-4 py-2 bg-[#C4FF0D] text-black rounded-lg font-semibold hover:bg-[#A3D60A] transform hover:scale-105 transition-all">
                      <Plus className="h-5 w-5" />
                      <span>Create</span>
                    </button>
                  </Link>

                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-[#252A2E] transition-all"
                    >
                      <User className="h-5 w-5 text-[#A8B3B8]" />
                    </button>

                    {userMenuOpen && (
                      <div className="absolute right-0 mt-2 w-64 bg-[#252A2E] rounded-xl shadow-xl border border-gray-800 py-2">
                        <div className="px-4 py-3 border-b border-gray-800">
                          {companyName && (
                            <div className="text-sm font-semibold text-white truncate mb-1">{companyName}</div>
                          )}
                          <div className="text-xs text-[#A8B3B8] truncate">{user.email}</div>
                        </div>

                        <Link to="/settings" onClick={() => setUserMenuOpen(false)}>
                          <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#A8B3B8] hover:bg-[#1A1D1F] hover:text-white transition-all">
                            <Settings className="h-4 w-4" />
                            <span>Settings</span>
                          </button>
                        </Link>

                        <Link to="/subscription" onClick={() => setUserMenuOpen(false)}>
                          <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#A8B3B8] hover:bg-[#1A1D1F] hover:text-white transition-all">
                            <CreditCard className="h-4 w-4" />
                            <span>Subscription</span>
                          </button>
                        </Link>

                        <div className="border-t border-gray-800 mt-2 pt-2">
                          <button
                            onClick={async () => {
                              setUserMenuOpen(false);
                              await handleSignOut();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-all"
                          >
                            <LogOut className="h-4 w-4" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 rounded-lg hover:bg-[#252A2E] transition-all"
                >
                  {mobileMenuOpen ? (
                    <X className="h-6 w-6 text-[#A8B3B8]" />
                  ) : (
                    <Menu className="h-6 w-6 text-[#A8B3B8]" />
                  )}
                </button>
              </>
            )}

            {!user && (
              <div className="flex items-center space-x-2 sm:space-x-4">
                <Link
                  to="/login"
                  className="text-[#A8B3B8] hover:text-[#C4FF0D] px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="bg-[#C4FF0D] text-black hover:bg-[#A3D60A] hover:shadow-lg px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all transform hover:scale-105"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>

        {user && mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-800 bg-[#1A1D1F]">
            <div className="px-4 py-4 space-y-2">
              <Link to="/offers/create" onClick={() => setMobileMenuOpen(false)}>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#C4FF0D] text-black rounded-lg font-semibold mb-4 transform active:scale-95 transition-all">
                  <Plus className="h-5 w-5" />
                  <span>Create New Offer</span>
                </button>
              </Link>

              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                      isActive(item.href)
                        ? 'bg-[#C4FF0D]/10 text-[#C4FF0D]'
                        : 'text-[#A8B3B8] hover:bg-[#252A2E]'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <div className="border-t border-gray-800 mt-4 pt-4">
                <div className="px-4 py-2">
                  {companyName && (
                    <div className="text-sm font-semibold text-white truncate mb-1">{companyName}</div>
                  )}
                  <div className="text-xs text-[#A8B3B8] truncate">{user.email}</div>
                </div>
                <button
                  onClick={async () => {
                    await handleSignOut();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
