import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '@/components/dashboard/Sidebar';
import { ChatbotPageLayout } from '@/components/business-chatbot/ChatbotPageLayout';
import { SimplifiedTrainingInterface } from '@/components/dashboard/sections/SimplifiedTrainingInterface';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';

const ChatbotModelTraining = () => {
  const [activeSection, setActiveSection] = useState('chatbot-model-training');
  const { signOut } = useAuth();
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const { user } = useAuth();

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
          <ChatbotPageLayout title="Model Training">
            {(chatbot, isTraining, onRefresh) => (
              <div className="space-y-6">
                {/* Header Description */}
                <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-pink-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">⚡</div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                        Train Your Own AI Model
                      </h2>
                      <div className="space-y-3 mb-4">
                        <p className="text-muted-foreground leading-relaxed">
                          Create a fully custom AI model by providing <strong>conversation examples</strong>. Upload chat histories, Q&A pairs,
                          or dialogues that represent how you want your chatbot to respond. The AI will learn your unique communication style and business knowledge.
                        </p>
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                          <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                            💡 This is NOT prompt engineering - you're training an entirely new model from your data!
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800/50 rounded-lg border border-indigo-100 dark:border-indigo-900">
                          <span className="text-lg">💬</span>
                          <span className="text-xs font-medium">Upload Examples</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800/50 rounded-lg border border-purple-100 dark:border-purple-900">
                          <span className="text-lg">📊</span>
                          <span className="text-xs font-medium">Monitor Training</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800/50 rounded-lg border border-pink-100 dark:border-pink-900">
                          <span className="text-lg">🎯</span>
                          <span className="text-xs font-medium">View Models</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800/50 rounded-lg border border-rose-100 dark:border-rose-900">
                          <span className="text-lg">🚀</span>
                          <span className="text-xs font-medium">Deploy & Use</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Model Training Interface - Upload examples, monitor progress, view trained models */}
                {user && (
                  <SimplifiedTrainingInterface
                    avatarId={chatbot.id}
                    avatarName={chatbot.name}
                    userId={user.id}
                    onTrainingComplete={onRefresh}
                    onlyFineTuning={true}
                  />
                )}
              </div>
            )}
          </ChatbotPageLayout>
        </div>
      </main>
    </div>
  );
};

export default ChatbotModelTraining;
