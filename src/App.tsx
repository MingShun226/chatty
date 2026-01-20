
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import AuthCallback from '@/pages/AuthCallback';
import Dashboard from '@/pages/Dashboard';
import NotFound from '@/pages/NotFound';
import Terms from '@/pages/Terms';
import AvatarDetail from '@/pages/AvatarDetailNew';
import MyAvatars from '@/pages/MyAvatars';
// Note: ChatbotStudio is deprecated - redirects to /chatbot/overview
import ImagesStudio from '@/pages/ImagesStudio';
import VideoStudio from '@/pages/VideoStudio';
import Billing from '@/pages/Billing';
import Settings from '@/pages/Settings';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import CreateAvatar from '@/pages/CreateAvatar';
import APIKeys from '@/pages/APIKeys';
import TestChatbotSetup from '@/pages/TestChatbotSetup';
import { ChatbotCreationWizard } from '@/components/chatbot-creation/ChatbotCreationWizard';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

// Chatbot sub-pages (consolidated 5-page structure - AI Studio removed, now admin-only)
import ChatbotOverview from '@/pages/chatbot/ChatbotOverview';
import ChatbotContent from '@/pages/chatbot/ChatbotContent';
import WhatsAppIntegration from '@/pages/chatbot/WhatsAppIntegration';
import ChatbotContacts from '@/pages/chatbot/ChatbotContacts';
import ChatbotSettingsPage from '@/pages/chatbot/ChatbotSettingsPage';

// Note: Legacy chatbot pages are no longer imported as they redirect to consolidated pages

// Admin imports
import { AdminRoute } from '@/components/admin/AdminRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { UsersManagement } from '@/pages/admin/UsersManagement';
import { UserDetails } from '@/pages/admin/UserDetails';
import { TiersManagementNew } from '@/pages/admin/TiersManagementNew';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { AdminStatistics } from '@/pages/admin/AdminStatistics';
import { AdminAuditLogs } from '@/pages/admin/AdminAuditLogs';
import { AdminManagement } from '@/pages/admin/AdminManagement';
import { WorkflowTemplates } from '@/pages/admin/WorkflowTemplates';
import { FineTuningManagement } from '@/pages/admin/FineTuningManagement';

import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { ContactsCacheProvider } from '@/contexts/ContactsCacheContext';
import { PlatformSettingsProvider } from '@/contexts/PlatformSettingsContext';
import { GlobalNotification } from '@/components/notifications';
import SuspendedAccount from '@/pages/SuspendedAccount';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  const { user, loading, accountStatus, onboardingCompleted, refetchProfile } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminAuth();

  // Show loading screen while checking auth state
  if (loading || (user && adminLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show onboarding wizard for new users who haven't completed setup
  // Only show when: user exists, not suspended, and onboarding explicitly false (not null/loading)
  if (user && accountStatus !== 'suspended' && onboardingCompleted === false) {
    return (
      <QueryClientProvider client={queryClient}>
        <PlatformSettingsProvider>
          <OnboardingWizard onComplete={refetchProfile} />
          <Toaster />
          <SonnerToaster />
        </PlatformSettingsProvider>
      </QueryClientProvider>
    );
  }

  const handleLogin = () => {
    // Authentication is handled by the useAuth hook
    // This is just a placeholder for compatibility
  };

  const handleLogout = async () => {
    // Logout is handled by the useAuth hook in the Dashboard component
  };

  // Helper to get the correct element for protected routes
  const isSuspended = user && accountStatus === 'suspended';

  // Protected route element - redirects suspended users to /suspended, admins to /admin
  const protectedRoute = (element: React.ReactNode) => {
    if (!user) return <Navigate to="/auth" />;
    if (isSuspended) return <Navigate to="/suspended" />;
    // Redirect admins to admin dashboard instead of user pages
    if (isAdmin) return <Navigate to="/admin" replace />;
    return element;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <PlatformSettingsProvider>
      <SidebarProvider>
      <ContactsCacheProvider>
        <Router>
        <Routes>
          <Route
            path="/"
            element={
              user && isAdmin ? (
                <Navigate to="/admin" replace />
              ) : (
                <Index
                  isAuthenticated={!!user}
                  onLogin={handleLogin}
                  onLogout={handleLogout}
                />
              )
            }
          />
          <Route
            path="/auth"
            element={!user ? <Auth onLogin={handleLogin} /> : <Navigate to={isAdmin ? "/admin" : "/"} replace />}
          />
          <Route
            path="/auth/callback"
            element={<AuthCallback />}
          />
          <Route
            path="/terms"
            element={<Terms />}
          />
          <Route
            path="/suspended"
            element={user ? (isSuspended ? <SuspendedAccount /> : <Navigate to="/dashboard" />) : <Navigate to="/auth" />}
          />
          <Route
            path="/dashboard"
            element={protectedRoute(<Dashboard onLogout={handleLogout} />)}
          />
          <Route
            path="/create-avatar"
            element={protectedRoute(<CreateAvatar />)}
          />
          <Route
            path="/create-avatar/:id"
            element={protectedRoute(<CreateAvatar />)}
          />
          <Route
            path="/avatar/:id"
            element={protectedRoute(<AvatarDetail />)}
          />
          <Route
            path="/my-avatars"
            element={protectedRoute(<MyAvatars />)}
          />
          <Route
            path="/chatbot-studio"
            element={protectedRoute(<Navigate to="/chatbot/overview" replace />)}
          />

          {/* Chatbot Sub-Pages (New Consolidated Structure) */}
          <Route
            path="/chatbot/overview"
            element={protectedRoute(<ChatbotOverview />)}
          />
          <Route
            path="/chatbot/content"
            element={protectedRoute(<ChatbotContent />)}
          />
          <Route
            path="/chatbot/ai-studio"
            element={protectedRoute(<Navigate to="/chatbot/overview" replace />)}
          />
          <Route
            path="/chatbot/whatsapp"
            element={protectedRoute(<WhatsAppIntegration />)}
          />
          <Route
            path="/chatbot/contacts"
            element={protectedRoute(<ChatbotContacts />)}
          />
          <Route
            path="/chatbot/settings"
            element={protectedRoute(<ChatbotSettingsPage />)}
          />

          {/* Legacy Chatbot Routes (redirect to new consolidated pages) */}
          <Route
            path="/chatbot/products"
            element={protectedRoute(<Navigate to="/chatbot/content" replace />)}
          />
          <Route
            path="/chatbot/promotions"
            element={protectedRoute(<Navigate to="/chatbot/content" replace />)}
          />
          <Route
            path="/chatbot/knowledge"
            element={protectedRoute(<Navigate to="/chatbot/content" replace />)}
          />
          <Route
            path="/chatbot/prompt-engineer"
            element={protectedRoute(<Navigate to="/chatbot/overview" replace />)}
          />
          <Route
            path="/chatbot/model-training"
            element={protectedRoute(<Navigate to="/chatbot/overview" replace />)}
          />
          <Route
            path="/chatbot/followups"
            element={protectedRoute(<Navigate to="/chatbot/contacts" replace />)}
          />
          <Route
            path="/chatbot/test"
            element={protectedRoute(<Navigate to="/chatbot/overview" replace />)}
          />

          <Route
            path="/images-studio"
            element={protectedRoute(<ImagesStudio />)}
          />
          <Route
            path="/video-studio"
            element={protectedRoute(<VideoStudio />)}
          />
          <Route
            path="/billing"
            element={protectedRoute(<Billing />)}
          />
          <Route
            path="/settings"
            element={protectedRoute(<Settings />)}
          />
          <Route
            path="/api-keys"
            element={protectedRoute(<APIKeys />)}
          />
          <Route
            path="/test-chatbot-setup"
            element={protectedRoute(<TestChatbotSetup />)}
          />
          <Route
            path="/create-chatbot"
            element={protectedRoute(<ChatbotCreationWizard />)}
          />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<UsersManagement />} />
            <Route path="users/:userId" element={<UserDetails />} />
            <Route path="tiers" element={<TiersManagementNew />} />
            <Route path="statistics" element={<AdminStatistics />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="admins" element={<AdminManagement />} />
            <Route path="workflows" element={<WorkflowTemplates />} />
            <Route path="fine-tuning" element={<FineTuningManagement />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
        <SonnerToaster />
        <GlobalNotification />
        </Router>
      </ContactsCacheProvider>
      </SidebarProvider>
      </PlatformSettingsProvider>
    </QueryClientProvider>
  );
}

export default App;
