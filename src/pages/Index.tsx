
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Auth from './Auth';
import Dashboard from './Dashboard';

interface IndexProps {
  isAuthenticated: boolean;
  onLogin: (token: string) => void;
  onLogout: () => void;
}

const Index = ({ isAuthenticated, onLogin, onLogout }: IndexProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    const checkIfAdmin = async () => {
      if (!isAuthenticated) {
        setCheckingAdmin(false);
        return;
      }

      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.user) {
          setCheckingAdmin(false);
          return;
        }

        // Check if user is an admin
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', session.session.user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (adminUser) {
          // Redirect admin to admin dashboard
          navigate('/admin', { replace: true });
          return;
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
      setCheckingAdmin(false);
    };

    checkIfAdmin();
  }, [isAuthenticated, navigate]);

  // Check if we're on an avatar detail route
  if (location.pathname.startsWith('/avatar/')) {
    // This will be handled by the AvatarDetail component
    return null;
  }

  // Show loading while checking admin status
  if (isAuthenticated && checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Always render either Auth or Dashboard - never a blank state
  if (isAuthenticated) {
    return <Dashboard onLogout={onLogout} />;
  }

  return <Auth onLogin={onLogin} />;
};

export default Index;
