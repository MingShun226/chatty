import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from the URL hash
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          setError(sessionError.message);
          return;
        }

        if (session) {
          // Check if this is a new user (profile might not exist yet for OAuth users)
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, onboarding_completed')
            .eq('id', session.user.id)
            .single();

          // If profile doesn't exist, create it with data from OAuth provider
          if (!profile) {
            const { error: createError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
                account_status: 'active',
                onboarding_completed: false,
              });

            if (createError) {
              console.error('Error creating profile:', createError);
            }
          }

          // Check if user is admin
          const { data: adminData } = await supabase
            .from('admin_users')
            .select('id, default_dashboard')
            .eq('user_id', session.user.id)
            .eq('is_active', true)
            .maybeSingle();

          if (adminData && adminData.default_dashboard === 'admin') {
            navigate('/admin', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        } else {
          // No session, redirect to auth page
          navigate('/auth', { replace: true });
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'An error occurred during authentication');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="text-destructive text-lg font-medium">Authentication Error</div>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate('/auth')}
            className="text-primary hover:underline"
          >
            Return to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
