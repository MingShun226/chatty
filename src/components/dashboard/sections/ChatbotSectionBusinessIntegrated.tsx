import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
  AlertCircle,
  Brain,
  BookOpen,
  History,
  Settings as SettingsIcon,
  ShoppingBag,
  Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SimpleAvatarSelector } from '@/components/chatbot-training/SimpleAvatarSelector';
import { SimplifiedTrainingInterface } from './SimplifiedTrainingInterface';
import { TestChatSimple } from '@/components/chatbot-training/TestChatSimple';
import { KnowledgeBase } from '@/components/chatbot-training/KnowledgeBase';
import { DatabaseVersionControl } from '@/components/chatbot-training/DatabaseVersionControl';
import { ProductGalleryFull } from '@/components/business-chatbot/ProductGalleryFull';
import { ChatbotSettingsModern } from '@/components/business-chatbot/ChatbotSettingsModern';
import { ChatbotCreationWizardModern } from '@/components/chatbot-creation/ChatbotCreationWizardModern';
import { AIPromptGenerator } from '@/components/business-chatbot/AIPromptGenerator';
import { BusinessChatbotTest } from '@/components/business-chatbot/BusinessChatbotTest';
import { PromptAgentChat } from '@/components/business-chatbot/PromptAgentChat';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ChatbotSectionBusinessIntegratedProps {
  defaultTab?: string;
}

const ChatbotSectionBusinessIntegrated = ({ defaultTab }: ChatbotSectionBusinessIntegratedProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const chatbotIdFromUrl = searchParams.get('id') || searchParams.get('avatar');
  const showWizardParam = searchParams.get('create');

  const getInitialChatbotId = () => {
    if (chatbotIdFromUrl) return chatbotIdFromUrl;
    return localStorage.getItem('chatbot_selected_id') || null;
  };

  const [selectedChatbotId, setSelectedChatbotId] = useState<string | null>(getInitialChatbotId());
  const [selectedChatbot, setSelectedChatbot] = useState<any>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab || localStorage.getItem('chatbot_active_tab') || 'settings');
  const [showWizard, setShowWizard] = useState(showWizardParam === 'true');
  const [userChatbots, setUserChatbots] = useState<any[]>([]);
  const [loadingChatbots, setLoadingChatbots] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  // Check if user has any chatbots
  useEffect(() => {
    if (user) {
      checkUserChatbots();
    }
  }, [user]);

  useEffect(() => {
    if (chatbotIdFromUrl && chatbotIdFromUrl !== selectedChatbotId) {
      setSelectedChatbotId(chatbotIdFromUrl);
      localStorage.setItem('chatbot_selected_id', chatbotIdFromUrl);
      setShowWizard(false);
    }
  }, [chatbotIdFromUrl]);

  useEffect(() => {
    if (selectedChatbotId && user) {
      fetchChatbotData(selectedChatbotId);
      setShowWizard(false);
    } else {
      setSelectedChatbot(null);
    }
  }, [selectedChatbotId, user]);

  const checkUserChatbots = async () => {
    try {
      setLoadingChatbots(true);
      const { data, error } = await supabase
        .from('avatars')
        .select('id, name, chatbot_type, industry, company_name')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUserChatbots(data || []);

      // If user has no chatbots and no specific chatbot selected, show wizard
      if (data && data.length === 0 && !chatbotIdFromUrl) {
        setShowWizard(true);
      } else if (data && data.length > 0 && !chatbotIdFromUrl && !selectedChatbotId) {
        // Auto-select first chatbot if none selected
        setSelectedChatbotId(data[0].id);
        localStorage.setItem('chatbot_selected_id', data[0].id);
      }
    } catch (error) {
      console.error('Error checking chatbots:', error);
    } finally {
      setLoadingChatbots(false);
    }
  };

  const fetchChatbotData = async (chatbotId: string) => {
    try {
      const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('id', chatbotId)
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('Error fetching chatbot:', error);
        if (error.code === 'PGRST116') {
          localStorage.removeItem('chatbot_selected_id');
          setSelectedChatbotId(null);
        }
        toast({
          title: "Error",
          description: "Failed to load chatbot data.",
          variant: "destructive"
        });
        return;
      }

      setSelectedChatbot(data);
    } catch (error) {
      console.error('Error fetching chatbot:', error);
    }
  };

  const handleChatbotSelection = (chatbotId: string) => {
    if (isTraining) {
      toast({
        title: "Cannot Switch Chatbot",
        description: "Please wait for current training to complete before switching chatbots.",
        variant: "destructive"
      });
      return;
    }

    setSelectedChatbotId(chatbotId);
    localStorage.setItem('chatbot_selected_id', chatbotId);
    setShowWizard(false);

    // Update URL
    setSearchParams({ id: chatbotId });

    toast({
      title: "Chatbot Selected",
      description: "You can now configure your chatbot.",
    });
  };

  const handleTrainingStart = () => {
    setIsTraining(true);
  };

  const handleTrainingComplete = () => {
    setIsTraining(false);
    // Refresh chatbot data after training
    if (selectedChatbotId) {
      fetchChatbotData(selectedChatbotId);
    }
  };

  const handleTabChange = (value: string) => {
    if (isTraining && value !== activeTab) {
      toast({
        title: "Training in Progress",
        description: "Please wait for training to complete before switching tabs.",
        variant: "destructive"
      });
      return;
    }
    setActiveTab(value);
    localStorage.setItem('chatbot_active_tab', value);
  };

  const handleSettingsUpdate = () => {
    // Refresh chatbot data when settings are updated
    if (selectedChatbotId) {
      fetchChatbotData(selectedChatbotId);
    }
  };

  const handleCreateNewChatbot = () => {
    setShowWizard(true);
    setSelectedChatbotId(null);
    localStorage.removeItem('chatbot_selected_id');
    setSearchParams({ create: 'true' });
  };

  const handleWizardComplete = (newChatbotId: string) => {
    // Refresh chatbot list
    checkUserChatbots();
    // Select the newly created chatbot
    setSelectedChatbotId(newChatbotId);
    localStorage.setItem('chatbot_selected_id', newChatbotId);
    setShowWizard(false);
    setSearchParams({ id: newChatbotId });
  };

  // Show wizard if user is creating a new chatbot or has no chatbots
  if (showWizard || (userChatbots.length === 0 && !loadingChatbots && !selectedChatbotId)) {
    return (
      <ChatbotCreationWizardModern onComplete={handleWizardComplete} />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b">
        <div>
          <h1 className="text-3xl font-bold">
            Chatbot Studio
          </h1>
          <p className="text-muted-foreground mt-1">
            {selectedChatbot
              ? `${selectedChatbot.name} • ${selectedChatbot?.company_name || 'No company'}`
              : 'Select or create a chatbot to get started'
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isTraining && (
            <Badge variant="destructive" className="animate-pulse">
              Training Active
            </Badge>
          )}
          <Button onClick={handleCreateNewChatbot} variant="outline" size="lg">
            <Plus className="h-4 w-4 mr-2" />
            New Chatbot
          </Button>
          <SimpleAvatarSelector
            selectedAvatarId={selectedChatbotId}
            onSelectAvatar={handleChatbotSelection}
          />
        </div>
      </div>

      {/* Main Content */}
      {!selectedChatbot ? (
        <div className="flex flex-col items-center justify-center py-24">
          <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Chatbot Selected</h3>
          <p className="text-muted-foreground mb-6">
            Choose a chatbot above or create a new one to get started
          </p>
          <Button onClick={handleCreateNewChatbot} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Chatbot
          </Button>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-8">
          <TabsList className="inline-flex h-11 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
            <TabsTrigger
              value="settings"
              disabled={isTraining && activeTab !== 'settings'}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all"
            >
              <SettingsIcon className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger
              value="products"
              disabled={isTraining && activeTab !== 'products'}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              Products
            </TabsTrigger>
            <TabsTrigger
              value="knowledge"
              disabled={(isTraining && activeTab !== 'knowledge')}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Knowledge
            </TabsTrigger>
            <TabsTrigger
              value="train"
              disabled={isTraining && activeTab !== 'train'}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all"
            >
              <Brain className="h-4 w-4 mr-2" />
              Fine-tune
            </TabsTrigger>
            <TabsTrigger
              value="test"
              disabled={(isTraining && activeTab !== 'test')}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Test Chat
            </TabsTrigger>
            <TabsTrigger
              value="versions"
              disabled={(isTraining && activeTab !== 'versions')}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all"
            >
              <History className="h-4 w-4 mr-2" />
              Versions
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab - Business Context, Compliance, Guidelines */}
          <TabsContent value="settings" className="mt-0">
            <ChatbotSettingsModern
              chatbot={selectedChatbot}
              onUpdate={handleSettingsUpdate}
            />
          </TabsContent>

          {/* Products Tab - Product Gallery Management */}
          <TabsContent value="products" className="mt-0">
            <ProductGalleryFull
              chatbotId={selectedChatbot.id}
              chatbotName={selectedChatbot.name}
            />
          </TabsContent>

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge" className="mt-0">
            <KnowledgeBase
              avatarId={selectedChatbot.id}
              isTraining={isTraining}
            />
          </TabsContent>

          {/* Fine-tune Tab */}
          <TabsContent value="train" className="mt-0">
            <div className="space-y-6">
              {/* Prompt Agent - Conversational Prompt Editing */}
              {user && (
                <PromptAgentChat
                  chatbotId={selectedChatbot.id}
                  userId={user.id}
                  onPromptUpdated={() => {
                    // Refresh chatbot data when prompt is updated
                    fetchChatbotData(selectedChatbot.id);
                  }}
                />
              )}

              {/* Traditional Fine-tuning Interface */}
              {user && (
                <SimplifiedTrainingInterface
                  avatarId={selectedChatbot.id}
                  avatarName={selectedChatbot.name}
                  userId={user.id}
                  onTrainingComplete={handleTrainingComplete}
                />
              )}
            </div>
          </TabsContent>

          {/* Test Chat Tab */}
          <TabsContent value="test" className="mt-0">
            <BusinessChatbotTest
              chatbotId={selectedChatbot.id}
              chatbotName={selectedChatbot.name}
            />
          </TabsContent>

          {/* Versions Tab */}
          <TabsContent value="versions" className="mt-0">
            <div className="space-y-6">
              {/* AI Prompt Generator */}
              {user && (
                <AIPromptGenerator
                  chatbotId={selectedChatbot.id}
                  userId={user.id}
                  onPromptGenerated={() => {
                    // Refresh chatbot data to show new version
                    fetchChatbotData(selectedChatbot.id);
                  }}
                />
              )}

              {/* Version Control */}
              <DatabaseVersionControl
                avatarId={selectedChatbot.id}
                isTraining={isTraining}
              />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default ChatbotSectionBusinessIntegrated;
