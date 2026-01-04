import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageCircle,
  AlertCircle,
  Brain,
  BookOpen,
  History,
  Settings as SettingsIcon,
  ShoppingBag
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SimpleAvatarSelector } from '@/components/chatbot-training/SimpleAvatarSelector';
import { SimplifiedTrainingInterface } from './SimplifiedTrainingInterface';
import { TestChatSimple } from '@/components/chatbot-training/TestChatSimple';
import { KnowledgeBase } from '@/components/chatbot-training/KnowledgeBase';
import { DatabaseVersionControl } from '@/components/chatbot-training/DatabaseVersionControl';
import { ProductGalleryFull } from '@/components/business-chatbot/ProductGalleryFull';
import { ChatbotSettings } from '@/components/business-chatbot/ChatbotSettings';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const ChatbotSectionBusiness = () => {
  const [searchParams] = useSearchParams();
  const chatbotIdFromUrl = searchParams.get('id') || searchParams.get('avatar');

  const getInitialChatbotId = () => {
    if (chatbotIdFromUrl) return chatbotIdFromUrl;
    return localStorage.getItem('chatbot_selected_id') || null;
  };

  const [selectedChatbotId, setSelectedChatbotId] = useState<string | null>(getInitialChatbotId());
  const [selectedChatbot, setSelectedChatbot] = useState<any>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [activeTab, setActiveTab] = useState(localStorage.getItem('chatbot_active_tab') || 'settings');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (chatbotIdFromUrl && chatbotIdFromUrl !== selectedChatbotId) {
      setSelectedChatbotId(chatbotIdFromUrl);
      localStorage.setItem('chatbot_selected_id', chatbotIdFromUrl);
    }
  }, [chatbotIdFromUrl]);

  useEffect(() => {
    if (selectedChatbotId && user) {
      fetchChatbotData(selectedChatbotId);
    } else {
      setSelectedChatbot(null);
    }
  }, [selectedChatbotId, user]);

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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <MessageCircle className="h-6 w-6" />
            Chatbot Studio
            {selectedChatbot && (
              <Badge variant="outline" className="text-sm font-normal">
                {selectedChatbot.name}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground">
            {selectedChatbot?.chatbot_type === 'business'
              ? `${selectedChatbot?.industry || 'Business'} chatbot for ${selectedChatbot?.company_name || 'your company'}`
              : 'Configure and train your chatbot'
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isTraining && (
            <Badge variant="destructive" className="animate-pulse">
              Training Active
            </Badge>
          )}
          <SimpleAvatarSelector
            selectedAvatarId={selectedChatbotId}
            onSelectAvatar={handleChatbotSelection}
          />
        </div>
      </div>

      {/* Main Content */}
      {!selectedChatbot ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a Chatbot</h3>
            <p className="text-muted-foreground">
              Choose a chatbot above to start configuring
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger
              value="settings"
              disabled={isTraining && activeTab !== 'settings'}
              className="flex items-center gap-2"
            >
              <SettingsIcon className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger
              value="products"
              disabled={isTraining && activeTab !== 'products'}
              className="flex items-center gap-2"
            >
              <ShoppingBag className="h-4 w-4" />
              Products
            </TabsTrigger>
            <TabsTrigger
              value="knowledge"
              disabled={(isTraining && activeTab !== 'knowledge')}
              className="flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Knowledge
            </TabsTrigger>
            <TabsTrigger
              value="train"
              disabled={isTraining && activeTab !== 'train'}
              className="flex items-center gap-2"
            >
              <Brain className="h-4 w-4" />
              Fine-tune
            </TabsTrigger>
            <TabsTrigger
              value="test"
              disabled={(isTraining && activeTab !== 'test')}
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Test Chat
            </TabsTrigger>
            <TabsTrigger
              value="versions"
              disabled={(isTraining && activeTab !== 'versions')}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              Versions
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab - Business Context, Compliance, Guidelines */}
          <TabsContent value="settings">
            <ChatbotSettings
              chatbot={selectedChatbot}
              onUpdate={handleSettingsUpdate}
            />
          </TabsContent>

          {/* Products Tab - Product Gallery Management */}
          <TabsContent value="products">
            <ProductGalleryFull
              chatbotId={selectedChatbot.id}
              chatbotName={selectedChatbot.name}
            />
          </TabsContent>

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge">
            <KnowledgeBase
              avatarId={selectedChatbot.id}
              isTraining={isTraining}
            />
          </TabsContent>

          {/* Fine-tune Tab */}
          <TabsContent value="train">
            {user && (
              <SimplifiedTrainingInterface
                avatarId={selectedChatbot.id}
                avatarName={selectedChatbot.name}
                userId={user.id}
                onTrainingComplete={handleTrainingComplete}
              />
            )}
          </TabsContent>

          {/* Test Chat Tab */}
          <TabsContent value="test">
            <TestChatSimple selectedAvatar={selectedChatbot} />
          </TabsContent>

          {/* Versions Tab */}
          <TabsContent value="versions">
            <DatabaseVersionControl
              avatarId={selectedChatbot.id}
              isTraining={isTraining}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default ChatbotSectionBusiness;
