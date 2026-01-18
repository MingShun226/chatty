import React, { useState } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import { ChatbotPageLayout } from '@/components/business-chatbot/ChatbotPageLayout';
import { ChatbotSettings } from '@/components/business-chatbot/ChatbotSettings';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';

const ChatbotSettingsPage = () => {
  const [activeSection, setActiveSection] = useState('chatbot-settings');
  const { signOut } = useAuth();
  const { isCollapsed } = useSidebar();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onLogout={handleLogout}
      />

      <main className={`${isCollapsed ? 'ml-16' : 'ml-56'} overflow-auto transition-all duration-300`}>
        <div className="p-8 max-w-7xl mx-auto">
          <ChatbotPageLayout title="Chatbot Settings">
            {(chatbot, isTraining, onRefresh) => (
              <ChatbotSettings chatbot={chatbot} onUpdate={onRefresh} />
            )}
          </ChatbotPageLayout>
        </div>
      </main>
    </div>
  );
};

export default ChatbotSettingsPage;
