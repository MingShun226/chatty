import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import { ChatbotPageLayout } from '@/components/business-chatbot/ChatbotPageLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Import content components
import { ProductGalleryFull } from '@/components/business-chatbot/ProductGalleryFull';
import { PromotionsGalleryFull } from '@/components/business-chatbot/PromotionsGalleryFull';
import { KnowledgeBase } from '@/components/chatbot-training/KnowledgeBase';

import {
  ShoppingBag,
  Tag,
  BookOpen
} from 'lucide-react';

// Helper to get/set tab state from localStorage
const TAB_STORAGE_KEY = 'chatbot-content-active-tab';
const getStoredTab = () => {
  try {
    return localStorage.getItem(TAB_STORAGE_KEY) || 'products';
  } catch {
    return 'products';
  }
};
const setStoredTab = (tab: string) => {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // Ignore
  }
};

// Content tabs component
const ContentTabs = ({ chatbot, onRefresh }: { chatbot: any; onRefresh?: () => void }) => {
  const [activeTab, setActiveTab] = useState(getStoredTab);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setStoredTab(tab);
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="products" className="gap-2">
          <ShoppingBag className="h-4 w-4" />
          Products
        </TabsTrigger>
        <TabsTrigger value="promotions" className="gap-2">
          <Tag className="h-4 w-4" />
          Promotions
        </TabsTrigger>
        <TabsTrigger value="knowledge" className="gap-2">
          <BookOpen className="h-4 w-4" />
          Knowledge Base
        </TabsTrigger>
      </TabsList>

      <TabsContent value="products" className="mt-0">
        <ProductGalleryFull
          chatbotId={chatbot.id}
          chatbotName={chatbot.name}
          priceVisible={chatbot.price_visible ?? true}
          onPriceVisibleChange={onRefresh}
        />
      </TabsContent>

      <TabsContent value="promotions" className="mt-0">
        <PromotionsGalleryFull
          chatbotId={chatbot.id}
          chatbotName={chatbot.name}
        />
      </TabsContent>

      <TabsContent value="knowledge" className="mt-0">
        <KnowledgeBase
          avatarId={chatbot.id}
          isTraining={false}
        />
      </TabsContent>
    </Tabs>
  );
};

const ChatbotContent = () => {
  const [activeSection, setActiveSection] = useState('chatbot-content');
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
          <ChatbotPageLayout title="Content Management">
            {(chatbot, isTraining, onRefresh) => <ContentTabs chatbot={chatbot} onRefresh={onRefresh} />}
          </ChatbotPageLayout>
        </div>
      </main>
    </div>
  );
};

export default ChatbotContent;
