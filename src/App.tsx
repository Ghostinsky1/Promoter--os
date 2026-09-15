import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginForm } from './components/auth/LoginForm';
import { SignupForm } from './components/auth/SignupForm';
import { LandingPage } from './components/LandingPage';
import { Home } from './components/Home';
import { CreateOffer } from './components/CreateOffer';
import { CreateOfferDistrict } from './components/CreateOfferDistrict';
import { EditOffer } from './components/EditOffer';
import { OfferDetails } from './components/OfferDetails';
import { OffersList } from './components/OffersList';
import { CompanySettings } from './components/CompanySettings';
import { Analytics } from './components/Analytics';
import { RunOfShow } from './components/RunOfShow';
import { Settlement } from './components/Settlement';
import { DealEstimator } from './components/DealEstimator';
import { ArtistFeeEstimator } from './components/ArtistFeeEstimator';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { SuccessPage } from './pages/SuccessPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { ToursPage } from './pages/ToursPage';
import { CreateTourPage } from './pages/CreateTourPage';
import { TourDetailsPage } from './pages/TourDetailsPage';
import { PricingPage } from './components/PricingPage';
import { Pricing } from './pages/Pricing';
import { CheckoutPage } from './pages/CheckoutPage';
import { Success } from './pages/Success';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import SecurityPage from './pages/SecurityPage';
import FAQPage from './pages/FAQPage';
import { useAuth } from './hooks/useAuth';
import OAuthConsentPage from './pages/OAuthConsentPage';
import { safeNext } from './lib/safeNext';

function AfterLogin() {
  const [params] = useSearchParams();
  return <Navigate to={safeNext(params.get('next')) || '/dashboard'} replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={!user ? <LoginForm /> : <AfterLogin />} />
      <Route path="/signup" element={!user ? <SignupForm /> : <Navigate to="/dashboard" />} />
      <Route path="/oauth/consent" element={<OAuthConsentPage />} />
      <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/dashboard" />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/security" element={<SecurityPage />} />
      <Route path="/faq" element={<FAQPage />} />

      {/* Protected routes */}
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
      <Route path="/success" element={<Success />} />
      <Route path="/dashboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/offers" element={<ProtectedRoute><OffersList /></ProtectedRoute>} />
      <Route path="/offers/create" element={<ProtectedRoute><CreateOffer /></ProtectedRoute>} />
      <Route path="/offers/create-district" element={<ProtectedRoute><CreateOfferDistrict /></ProtectedRoute>} />
      <Route path="/offers/:id" element={<ProtectedRoute><OfferDetails /></ProtectedRoute>} />
      <Route path="/offers/:id/edit" element={<ProtectedRoute><EditOffer /></ProtectedRoute>} />
      <Route path="/offers/:id/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path="/offers/:id/run-of-show" element={<ProtectedRoute><RunOfShow /></ProtectedRoute>} />
      <Route path="/offers/:id/settlement" element={<ProtectedRoute><Settlement /></ProtectedRoute>} />
      <Route path="/deal-estimator" element={<ProtectedRoute><DealEstimator /></ProtectedRoute>} />
      <Route path="/artist-fee" element={<ProtectedRoute><ArtistFeeEstimator /></ProtectedRoute>} />
      <Route path="/templates" element={<ProtectedRoute><TemplatesPage /></ProtectedRoute>} />
      <Route path="/tours" element={<ProtectedRoute><ToursPage /></ProtectedRoute>} />
      <Route path="/tours/create" element={<ProtectedRoute><CreateTourPage /></ProtectedRoute>} />
      <Route path="/tours/:id" element={<ProtectedRoute><TourDetailsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><CompanySettings /></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Header />
        <AppRoutes />
      </div>
    </Router>
  );
}

export default App;