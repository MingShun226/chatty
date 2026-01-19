
import React from 'react';
import { useLocation } from 'react-router-dom';
import LandingPage from './LandingPage';
import Dashboard from './Dashboard';

interface IndexProps {
  isAuthenticated: boolean;
  onLogin: (token: string) => void;
  onLogout: () => void;
}

const Index = ({ isAuthenticated, onLogin, onLogout }: IndexProps) => {
  const location = useLocation();

  // Check if we're on an avatar detail route
  if (location.pathname.startsWith('/avatar/')) {
    // This will be handled by the AvatarDetail component
    return null;
  }

  // Always render either LandingPage or Dashboard - never a blank state
  // Admin redirect is handled at App.tsx level
  if (isAuthenticated) {
    return <Dashboard onLogout={onLogout} />;
  }

  // Show landing page for non-authenticated users
  return <LandingPage />;
};

export default Index;
