
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import NotFound from '@/pages/NotFound';
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

// Chatbot sub-pages (consolidated 5-page structure)
import ChatbotOverview from '@/pages/chatbot/ChatbotOverview';
import ChatbotContent from '@/pages/chatbot/ChatbotContent';
import ChatbotAIStudio from '@/pages/chatbot/ChatbotAIStudio';
import WhatsAppIntegration from '@/pages/chatbot/WhatsAppIntegration';
import ChatbotContacts from '@/pages/chatbot/ChatbotContacts';

// Note: Legacy chatbot pages are no longer imported as they redirect to consolidated pages

// Admin imports
import { AdminRoute } from '@/components/admin/AdminRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { UsersManagement } from '@/pages/admin/UsersManagement';
import { TiersManagementNew } from '@/pages/admin/TiersManagementNew';
import { UserDetails } from '@/pages/admin/UserDetails';
import { AdminSettings } from '@/pages/admin/AdminSettings';

import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { ContactsCacheProvider } from '@/contexts/ContactsCacheContext';
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
  const { user, loading, accountStatus } = useAuth();

  // Show loading screen while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
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

  // Protected route element - redirects suspended users to /suspended
  const protectedRoute = (element: React.ReactNode) => {
    if (!user) return <Navigate to="/auth" />;
    if (isSuspended) return <Navigate to="/suspended" />;
    return element;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
      <ContactsCacheProvider>
        <Router>
        <Routes>
          <Route 
            path="/" 
            element={
              <Index 
                isAuthenticated={!!user} 
                onLogin={handleLogin} 
                onLogout={handleLogout} 
              />
            } 
          />
          <Route
            path="/auth"
            element={!user ? <Auth onLogin={handleLogin} /> : <Navigate to="/" />}
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
            element={protectedRoute(<ChatbotAIStudio />)}
          />
          <Route
            path="/chatbot/whatsapp"
            element={protectedRoute(<WhatsAppIntegration />)}
          />
          <Route
            path="/chatbot/contacts"
            element={protectedRoute(<ChatbotContacts />)}
          />

          {/* Legacy Chatbot Routes (redirect to new consolidated pages) */}
          <Route
            path="/chatbot/settings"
            element={protectedRoute(<Navigate to="/chatbot/ai-studio" replace />)}
          />
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
            element={protectedRoute(<Navigate to="/chatbot/ai-studio" replace />)}
          />
          <Route
            path="/chatbot/model-training"
            element={protectedRoute(<Navigate to="/chatbot/ai-studio" replace />)}
          />
          <Route
            path="/chatbot/followups"
            element={protectedRoute(<Navigate to="/chatbot/contacts" replace />)}
          />
          <Route
            path="/chatbot/test"
            element={protectedRoute(<Navigate to="/chatbot/ai-studio" replace />)}
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
    </QueryClientProvider>
  );
}

export default App;
