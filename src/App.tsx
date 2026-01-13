
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import NotFound from '@/pages/NotFound';
import AvatarDetail from '@/pages/AvatarDetailNew';
import MyAvatars from '@/pages/MyAvatars';
import ChatbotStudio from '@/pages/ChatbotStudio';
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

// Chatbot sub-pages
import ChatbotSettings from '@/pages/chatbot/ChatbotSettings';
import ChatbotProducts from '@/pages/chatbot/ChatbotProducts';
import ChatbotPromotions from '@/pages/chatbot/ChatbotPromotions';
import ChatbotKnowledge from '@/pages/chatbot/ChatbotKnowledge';
import ChatbotPromptEngineer from '@/pages/chatbot/ChatbotPromptEngineer';
import ChatbotModelTraining from '@/pages/chatbot/ChatbotModelTraining';
import WhatsAppIntegration from '@/pages/chatbot/WhatsAppIntegration';
import ChatbotFollowups from '@/pages/chatbot/ChatbotFollowups';
import ChatbotTest from '@/pages/chatbot/ChatbotTest';

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
import { GlobalNotification } from '@/components/notifications';

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
  const { user, loading } = useAuth();

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

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
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
            path="/dashboard" 
            element={user ? <Dashboard onLogout={handleLogout} /> : <Navigate to="/auth" />} 
          />
          <Route 
            path="/create-avatar" 
            element={user ? <CreateAvatar /> : <Navigate to="/auth" />} 
          />
          <Route 
            path="/create-avatar/:id" 
            element={user ? <CreateAvatar /> : <Navigate to="/auth" />} 
          />
          <Route
            path="/avatar/:id"
            element={user ? <AvatarDetail /> : <Navigate to="/auth" />}
          />
          <Route
            path="/my-avatars"
            element={user ? <MyAvatars /> : <Navigate to="/auth" />}
          />
          <Route
            path="/chatbot-studio"
            element={user ? <ChatbotStudio /> : <Navigate to="/auth" />}
          />

          {/* Chatbot Sub-Pages */}
          <Route
            path="/chatbot/settings"
            element={user ? <ChatbotSettings /> : <Navigate to="/auth" />}
          />
          <Route
            path="/chatbot/products"
            element={user ? <ChatbotProducts /> : <Navigate to="/auth" />}
          />
          <Route
            path="/chatbot/promotions"
            element={user ? <ChatbotPromotions /> : <Navigate to="/auth" />}
          />
          <Route
            path="/chatbot/knowledge"
            element={user ? <ChatbotKnowledge /> : <Navigate to="/auth" />}
          />
          <Route
            path="/chatbot/prompt-engineer"
            element={user ? <ChatbotPromptEngineer /> : <Navigate to="/auth" />}
          />
          <Route
            path="/chatbot/model-training"
            element={user ? <ChatbotModelTraining /> : <Navigate to="/auth" />}
          />
          <Route
            path="/chatbot/whatsapp"
            element={user ? <WhatsAppIntegration /> : <Navigate to="/auth" />}
          />
          <Route
            path="/chatbot/followups"
            element={user ? <ChatbotFollowups /> : <Navigate to="/auth" />}
          />
          <Route
            path="/chatbot/test"
            element={user ? <ChatbotTest /> : <Navigate to="/auth" />}
          />

          <Route
            path="/images-studio"
            element={user ? <ImagesStudio /> : <Navigate to="/auth" />}
          />
          <Route
            path="/video-studio"
            element={user ? <VideoStudio /> : <Navigate to="/auth" />}
          />
          <Route
            path="/billing"
            element={user ? <Billing /> : <Navigate to="/auth" />}
          />
          <Route
            path="/settings"
            element={user ? <Settings /> : <Navigate to="/auth" />}
          />
          <Route
            path="/api-keys"
            element={user ? <APIKeys /> : <Navigate to="/auth" />}
          />
          <Route
            path="/test-chatbot-setup"
            element={user ? <TestChatbotSetup /> : <Navigate to="/auth" />}
          />
          <Route
            path="/create-chatbot"
            element={user ? <ChatbotCreationWizard /> : <Navigate to="/auth" />}
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
      </SidebarProvider>
    </QueryClientProvider>
  );
}

export default App;
