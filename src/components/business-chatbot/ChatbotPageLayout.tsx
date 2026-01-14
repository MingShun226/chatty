import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SimpleAvatarSelector } from '@/components/chatbot-training/SimpleAvatarSelector';
import { ChatbotCreationWizardModern } from '@/components/chatbot-creation/ChatbotCreationWizardModern';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface PlanInfo {
  currentCount: number;
  maxAllowed: number;
  canCreate: boolean;
}

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
  const [loadingSelectedChatbot, setLoadingSelectedChatbot] = useState(false);
  const [planInfo, setPlanInfo] = useState<PlanInfo>({ currentCount: 0, maxAllowed: 1, canCreate: true });
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

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
        .is('deleted_at', null) // Exclude soft-deleted chatbots
        .order('created_at', { ascending: false });

      if (error) throw error;

      const chatbotCount = data?.length || 0;
      setUserChatbots(data || []);

      // Fetch user's plan limits
      await fetchPlanInfo(chatbotCount);

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

  const fetchPlanInfo = async (chatbotCount: number) => {
    try {
      // Get user's subscription tier from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier_id')
        .eq('id', user?.id)
        .single();

      if (profile?.subscription_tier_id) {
        const { data: tier } = await supabase
          .from('subscription_tiers')
          .select('max_avatars')
          .eq('id', profile.subscription_tier_id)
          .single();

        const maxAllowed = tier?.max_avatars ?? 1;
        const canCreate = maxAllowed === -1 || chatbotCount < maxAllowed;

        setPlanInfo({
          currentCount: chatbotCount,
          maxAllowed,
          canCreate
        });
      } else {
        // Default free plan: 1 chatbot
        setPlanInfo({
          currentCount: chatbotCount,
          maxAllowed: 1,
          canCreate: chatbotCount < 1
        });
      }
    } catch (error) {
      console.error('Error fetching plan info:', error);
      // Default to allowing creation if we can't fetch plan
      setPlanInfo({
        currentCount: chatbotCount,
        maxAllowed: 1,
        canCreate: chatbotCount < 1
      });
    }
  };

  const fetchChatbotData = async (chatbotId: string) => {
    try {
      setLoadingSelectedChatbot(true);
      const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('id', chatbotId)
        .eq('user_id', user?.id)
        .is('deleted_at', null) // Exclude soft-deleted chatbots
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
    } finally {
      setLoadingSelectedChatbot(false);
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
    // Check plan limits
    if (!planInfo.canCreate) {
      toast({
        title: "Chatbot Limit Reached",
        description: `Your plan allows ${planInfo.maxAllowed} chatbot${planInfo.maxAllowed !== 1 ? 's' : ''}. Upgrade to create more.`,
      });
      navigate('/billing');
      return;
    }

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
          <SimpleAvatarSelector
            selectedAvatarId={selectedChatbotId}
            onSelectAvatar={handleChatbotSelection}
            onAddNew={handleCreateNewChatbot}
            planInfo={planInfo}
          />
        </div>
      </div>

      {/* Main Content */}
      {loadingChatbots || loadingSelectedChatbot ? (
        // Show nothing while loading to prevent flash
        <div className="mt-6" />
      ) : !selectedChatbot ? (
        <div className="flex flex-col items-center justify-center py-24">
          <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Chatbot Selected</h3>
          <p className="text-muted-foreground mb-6">
            Choose a chatbot from the dropdown above or create a new one
          </p>
          {planInfo.canCreate && (
            <Button onClick={handleCreateNewChatbot} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Chatbot
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-6">
          {children(selectedChatbot, isTraining, handleRefresh)}
        </div>
      )}
    </div>
  );
};
