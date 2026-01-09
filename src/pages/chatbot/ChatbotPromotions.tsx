import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '@/components/dashboard/Sidebar';
import { ChatbotPageLayout } from '@/components/business-chatbot/ChatbotPageLayout';
import { PromotionsGalleryFull } from '@/components/business-chatbot/PromotionsGalleryFull';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';

const ChatbotPromotions = () => {
  const [activeSection, setActiveSection] = useState('chatbot-promotions');
  const { signOut } = useAuth();
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();

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
          <ChatbotPageLayout title="Promotions Management">
            {(chatbot) => (
              <PromotionsGalleryFull
                chatbotId={chatbot.id}
                chatbotName={chatbot.name}
              />
            )}
          </ChatbotPageLayout>
        </div>
      </main>
    </div>
  );
};

export default ChatbotPromotions;
