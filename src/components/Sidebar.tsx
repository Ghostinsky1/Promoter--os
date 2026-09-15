import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Calendar, BarChart3,
  Settings, MapPin, Building2, CreditCard, Lock
} from 'lucide-react';
import { useOrganization } from '../hooks/useOrganization';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasFeature } = useOrganization();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', feature: null },
    { icon: FileText, label: 'Reports', path: '/reports', feature: null },
    { icon: Calendar, label: 'Calendar', path: '/calendar', feature: null },
    { icon: BarChart3, label: 'Settlements', path: '/settlements', feature: null },
    { icon: MapPin, label: 'Tours', path: '/tours', feature: 'tours' },
    { icon: CreditCard, label: 'Subscription', path: '/pricing', feature: null },
    { icon: Settings, label: 'Settings', path: '/settings', feature: null },
  ];

  return (
    <div className="w-64 bg-white shadow-lg h-full">
      <div className="p-6">
        <div className="flex items-center space-x-2">
          <Building2 className="h-8 w-8 text-blue-600" />
          <span className="text-xl font-bold text-gray-900">TourGuide</span>
        </div>
      </div>
      
      <nav className="mt-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const hasAccess = !item.feature || hasFeature(item.feature);

          return (
            <button
              key={item.path}
              onClick={() => {
                if (hasAccess) {
                  navigate(item.path);
                } else {
                  navigate('/pricing');
                }
              }}
              className={`w-full flex items-center justify-between px-6 py-3 text-left transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                  : hasAccess
                  ? 'text-gray-600 hover:bg-gray-50'
                  : 'text-gray-400 opacity-60 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center">
                <Icon className="h-5 w-5 mr-3" />
                {item.label}
              </div>
              {!hasAccess && <Lock className="h-4 w-4 text-gray-400" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}