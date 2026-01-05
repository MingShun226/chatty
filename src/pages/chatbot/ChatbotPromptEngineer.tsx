import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '@/components/dashboard/Sidebar';
import { ChatbotPageLayout } from '@/components/business-chatbot/ChatbotPageLayout';
import { PromptAgentChat } from '@/components/business-chatbot/PromptAgentChat';
import { AIPromptGenerator } from '@/components/business-chatbot/AIPromptGenerator';
import { DatabaseVersionControl } from '@/components/chatbot-training/DatabaseVersionControl';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';
import { supabase } from '@/integrations/supabase/client';

const ChatbotPromptEngineer = () => {
  const [activeSection, setActiveSection] = useState('chatbot-finetune');
  const [hasPrompt, setHasPrompt] = useState<boolean | null>(null);
  const { signOut } = useAuth();
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSectionChange = (section: string) => {
    // Navigation is handled by Sidebar component's Link elements
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
          <ChatbotPageLayout title="Prompt Engineer">
            {(chatbot, isTraining, onRefresh) => (
              <PromptEngineerContent
                chatbot={chatbot}
                isTraining={isTraining}
                onRefresh={onRefresh}
                user={user}
              />
            )}
          </ChatbotPageLayout>
        </div>
      </main>
    </div>
  );
};

// Separate content component to handle chatbot-specific logic
const PromptEngineerContent = ({ chatbot, isTraining, onRefresh, user }: any) => {
  const [hasPrompt, setHasPrompt] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkIfHasPrompt();
  }, [chatbot?.id]);

  const checkIfHasPrompt = async () => {
    if (!chatbot?.id || !user?.id) return;

    try {
      const { data: activePrompt } = await supabase
        .from('avatar_prompt_versions')
        .select('id')
        .eq('avatar_id', chatbot.id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      setHasPrompt(!!activePrompt);
    } catch (error) {
      console.error('Error checking prompt:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Conversational Prompt Editing Section */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <span className="text-2xl">🎨</span>
              Conversational Prompt Editing
            </h2>
            <p className="text-muted-foreground">
              Chat with our AI assistant to refine your chatbot's behavior. Describe what you want, and we'll help craft the perfect prompt.
            </p>
          </div>

          {/* AI Generator Button - Only show for first-time setup */}
          {!loading && !hasPrompt && user && (
            <div className="flex-shrink-0">
              <AIPromptGenerator
                chatbotId={chatbot.id}
                userId={user.id}
                onPromptGenerated={() => {
                  onRefresh();
                  checkIfHasPrompt();
                }}
                compact={true}
              />
            </div>
          )}
        </div>

        {user && (
          <PromptAgentChat
            chatbotId={chatbot.id}
            userId={user.id}
            onPromptUpdated={onRefresh}
          />
        )}
      </div>

      <Separator className="my-8" />

      {/* Version History Section */}
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
            <span className="text-2xl">📚</span>
            Version History
          </h2>
          <p className="text-muted-foreground">
            Track all changes to your prompts. View, compare, and restore previous versions anytime.
          </p>
        </div>

        <DatabaseVersionControl
          avatarId={chatbot.id}
          isTraining={isTraining}
        />
      </div>
    </div>
  );
};

export default ChatbotPromptEngineer;
