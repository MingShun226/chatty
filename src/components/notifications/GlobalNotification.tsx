import React from 'react';
import { useLocation } from 'react-router-dom';
import { NotificationBell } from './NotificationBell';
import { JobProgressIndicator } from '@/components/advertising';
import { useAuth } from '@/hooks/useAuth';

/**
 * Global notification component that appears fixed on the top right corner
 * Shows notification bell and job progress indicator for authenticated users
 * Hidden on admin pages
 */
export function GlobalNotification() {
  const { user } = useAuth();
  const location = useLocation();

  // Only show for authenticated users
  if (!user) return null;

  // Hide on admin pages
  if (location.pathname.startsWith('/admin')) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
      {/* Job Progress Indicator */}
      <JobProgressIndicator />

      {/* Notification Bell */}
      <div className="bg-white rounded-full shadow-lg border">
        <NotificationBell />
      </div>
    </div>
  );
}

export default GlobalNotification;
