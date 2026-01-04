import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SimpleAvatarSelector } from '@/components/chatbot-training/SimpleAvatarSelector';
import { ChatbotCreationWizardModern } from '@/components/chatbot-creation/ChatbotCreationWizardModern';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ChatbotPageLayoutProps {
  title: string;
  children: (chatbot: any, isTraining: boolean, onRefresh: () => void) => React.ReactNode;
}

export const ChatbotPageLayout = ({ title, children }: ChatbotPageLayoutProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const chatbotIdFromUrl = searchParams.get('id') || searchParams.get('avatar');
  const showWizardParam = searchParams.get('create');

  const getInitialChatbotId = () => {
    if (chatbotIdFromUrl) return chatbotIdFromUrl;
    return localStorage.getItem('chatbot_selected_id') || null;
  };

  const [selectedChatbotId, setSelectedChatbotId] = useState<string | null>(getInitialChatbotId());
  const [selectedChatbot, setSelectedChatbot] = useState<any>(null);
  const [isTraining, setIsTraining] = useState(false);
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

  const handleRefresh = () => {
    if (selectedChatbotId) {
      fetchChatbotData(selectedChatbotId);
    }
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
            {title}
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
        <div className="mt-6">
          {children(selectedChatbot, isTraining, handleRefresh)}
        </div>
      )}
    </div>
  );
};
