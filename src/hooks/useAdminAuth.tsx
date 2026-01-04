import { useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { AdminUser } from '@/types/admin';

export const useAdminAuth = () => {
  const { user, loading: authLoading } = useAuth();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasCheckedRef = useRef<string | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (authLoading) return;

      if (!user) {
        setAdminUser(null);
        setIsAdmin(false);
        setLoading(false);
        hasCheckedRef.current = null;
        return;
      }

      // Prevent duplicate checks for the same user
      if (hasCheckedRef.current === user.id) {
        return;
      }

      hasCheckedRef.current = user.id;

      try {
        // Query admin_users table to check if user is an admin
        // Use maybeSingle() instead of single() to avoid 406 errors when no rows exist
        const { data, error: queryError } = await supabase
          .from('admin_users')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (queryError) {
          // Only log unexpected errors
          console.warn('[AdminAuth] Admin status check error:', queryError.code || queryError.message);
          setAdminUser(null);
          setIsAdmin(false);
        } else if (data) {
          // User is an admin
          setAdminUser(data as AdminUser);
          setIsAdmin(true);

          // Update last_login_at (fire and forget, don't await)
          supabase
            .from('admin_users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', data.id)
            .then(() => {})
            .catch(() => {});
        } else {
          // No admin record found - user is not an admin (normal case, don't log)
          setAdminUser(null);
          setIsAdmin(false);
        }
      } catch (err) {
        // Silently handle errors - admin check is not critical
        console.warn('[AdminAuth] Exception during admin check:', err);
        setAdminUser(null);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, authLoading, hasCheckedRef]);

  const hasPermission = (resource: string, action: 'read' | 'write' | 'delete'): boolean => {
    if (!adminUser || !adminUser.permissions) return false;

    const resourcePermissions = adminUser.permissions[resource as keyof typeof adminUser.permissions];
    if (!resourcePermissions) return false;

    return resourcePermissions[action] === true;
  };

  const isSuperAdmin = (): boolean => {
    return adminUser?.role === 'super_admin';
  };

  return {
    adminUser,
    isAdmin,
    loading,
    error,
    hasPermission,
    isSuperAdmin,
  };
};
