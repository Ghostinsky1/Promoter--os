import { useNavigate } from 'react-router-dom';
import { SubscriptionStatus } from './SubscriptionStatus';
import { Music, User, LogOut, Settings, CreditCard } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { useState } from 'react';

export function Header() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { plan } = useSubscription();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-xl font-bold text-purple-600"
            >
              <Music className="h-8 w-8" />
              MusicGen
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <>
                {plan && (
                  <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                    <span>{plan.name}</span>
                  </div>
                )}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100"
                  >
                    <User className="h-5 w-5" />
                    <span className="hidden md:block">{user.email}</span>
                  </button>
                  
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          navigate('/settings');
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          navigate('/pricing');
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
                      >
                        <CreditCard className="h-4 w-4" />
                        Subscription
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          signOut();
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <SubscriptionStatus className="ml-4" />
      </div>
    </header>
  );
}