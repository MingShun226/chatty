import React from 'react';
import { NotificationBell } from './NotificationBell';
import { JobProgressIndicator } from '@/components/advertising';
import { useAuth } from '@/hooks/useAuth';

/**
 * Global notification component that appears fixed on the top right corner
 * Shows notification bell and job progress indicator for authenticated users
 */
export function GlobalNotification() {
  const { user } = useAuth();

  // Only show for authenticated users
  if (!user) return null;

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
