import React, { useState } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import FollowUpsSection from '@/components/dashboard/sections/FollowUpsSection';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';

const ChatbotFollowups = () => {
  const [activeSection, setActiveSection] = useState('chatbot-followups');
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
          <FollowUpsSection />
        </div>
      </main>
    </div>
  );
};

export default ChatbotFollowups;
