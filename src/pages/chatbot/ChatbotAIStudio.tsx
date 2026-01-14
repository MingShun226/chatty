import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import { ChatbotPageLayout } from '@/components/business-chatbot/ChatbotPageLayout';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

// Import AI components
import { PromptAgentChat } from '@/components/business-chatbot/PromptAgentChat';
import { AIPromptGenerator } from '@/components/business-chatbot/AIPromptGenerator';
import { BusinessChatbotTest } from '@/components/business-chatbot/BusinessChatbotTest';
import { SimplifiedTrainingInterface } from '@/components/dashboard/sections/SimplifiedTrainingInterface';
import { ChatbotSettingsModern } from '@/components/business-chatbot/ChatbotSettingsModern';

import {
  Wand2,
  TestTube,
  Brain,
  Settings,
  ChevronDown,
  History,
  Play,
  Eye,
  Edit2,
  Save,
  Loader2,
  Check
} from 'lucide-react';

interface PromptVersion {
  id: string;
  version_number: number;
  version_name: string | null;
  system_prompt: string;
  is_active: boolean;
  created_at: string;
}

// Version Dropdown Component
const VersionDropdown = ({ chatbotId, userId, onVersionChange }: {
  chatbotId: string;
  userId: string;
  onVersionChange?: () => void;
}) => {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<PromptVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadVersions();
  }, [chatbotId, userId]);

  const loadVersions = async () => {
    try {
      const { data, error } = await supabase
        .from('avatar_prompt_versions')
        .select('id, version_number, version_name, system_prompt, is_active, created_at')
        .eq('avatar_id', chatbotId)
        .eq('user_id', userId)
        .order('version_number', { ascending: false });

      if (error) throw error;

      setVersions(data || []);
      const active = data?.find(v => v.is_active);
      setActiveVersion(active || null);
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateVersion = async (version: PromptVersion) => {
    try {
      // Deactivate all
      await supabase
        .from('avatar_prompt_versions')
        .update({ is_active: false })
        .eq('avatar_id', chatbotId)
        .eq('user_id', userId);

      // Activate selected
      await supabase
        .from('avatar_prompt_versions')
        .update({ is_active: true })
        .eq('id', version.id);

      toast({
        title: "Version Activated",
        description: `v${version.version_number} is now active`,
      });

      loadVersions();
      onVersionChange?.();
    } catch (error) {
      console.error('Error activating version:', error);
      toast({
        title: "Error",
        description: "Failed to activate version",
        variant: "destructive"
      });
    }
  };

  const handleViewVersion = (version: PromptVersion) => {
    setSelectedVersion(version);
    setViewDialogOpen(true);
  };

  const handleEditVersion = (version: PromptVersion) => {
    setSelectedVersion(version);
    setEditedPrompt(version.system_prompt);
    setEditDialogOpen(true);
  };

  const handleSavePrompt = async () => {
    if (!selectedVersion) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('avatar_prompt_versions')
        .update({ system_prompt: editedPrompt })
        .eq('id', selectedVersion.id);

      if (error) throw error;

      toast({
        title: "Prompt Updated",
        description: `v${selectedVersion.version_number} has been updated`,
      });

      setEditDialogOpen(false);
      loadVersions();
      onVersionChange?.();
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast({
        title: "Error",
        description: "Failed to save prompt",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (versions.length === 0) {
    return (
      <Badge variant="secondary" className="text-xs">
        <History className="h-3 w-3 mr-1" />
        No versions yet
      </Badge>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            {activeVersion ? `v${activeVersion.version_number}` : 'Select Version'}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <div className="px-2 py-1.5 text-sm font-semibold">Prompt Versions</div>
          <DropdownMenuSeparator />
          <ScrollArea className="h-[300px]">
            {versions.map((version) => (
              <div key={version.id} className="px-2 py-2 hover:bg-muted/50 rounded-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">v{version.version_number}</span>
                    {version.is_active && (
                      <Badge variant="default" className="text-xs px-1.5 py-0">
                        <Check className="h-3 w-3 mr-0.5" />
                        Active
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(version.created_at).toLocaleDateString()}
                  </span>
                </div>
                {version.version_name && (
                  <p className="text-xs text-muted-foreground mb-2 truncate">
                    {version.version_name}
                  </p>
                )}
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleViewVersion(version)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleEditVersion(version)}
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  {!version.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-green-600 hover:text-green-700"
                      onClick={() => handleActivateVersion(version)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Activate
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View Prompt Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              View Prompt - v{selectedVersion?.version_number}
            </DialogTitle>
            <DialogDescription>
              {selectedVersion?.version_name || 'System prompt for this version'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[50vh]">
            <div className="p-4 bg-muted/50 rounded-lg">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {selectedVersion?.system_prompt}
              </pre>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setViewDialogOpen(false);
              if (selectedVersion) handleEditVersion(selectedVersion);
            }}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Prompt Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Edit Prompt - v{selectedVersion?.version_number}
            </DialogTitle>
            <DialogDescription>
              Modify the system prompt for this version
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
              placeholder="Enter system prompt..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSavePrompt} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Prompt Engineer Tab Content
const PromptEngineerTab = ({ chatbot, isTraining, onRefresh, user }: any) => {
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
    <div className="space-y-4">
      {/* AI Generator Button - Only show for first-time setup */}
      {!loading && !hasPrompt && user && (
        <AIPromptGenerator
          chatbotId={chatbot.id}
          userId={user.id}
          onPromptGenerated={() => {
            onRefresh();
            checkIfHasPrompt();
          }}
          compact={true}
        />
      )}

      {/* Chat Interface with Version Dropdown in Header */}
      {user && (
        <PromptAgentChat
          chatbotId={chatbot.id}
          userId={user.id}
          onPromptUpdated={() => {
            onRefresh();
            checkIfHasPrompt();
          }}
          versionDropdown={
            <VersionDropdown
              chatbotId={chatbot.id}
              userId={user.id}
              onVersionChange={onRefresh}
            />
          }
        />
      )}
    </div>
  );
};

// Model Training Tab Content
const ModelTrainingTab = ({ chatbot, isTraining, onRefresh, user }: any) => {
  return (
    <div className="h-[calc(100vh-280px)] min-h-[400px]">
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
  );
};

// AI Studio tabs component
const AIStudioTabs = ({ chatbot, isTraining, onRefresh }: { chatbot: any; isTraining: boolean; onRefresh: () => void }) => {
  const [activeTab, setActiveTab] = useState('prompt');
  const { user } = useAuth();

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6">
        <TabsTrigger value="prompt" className="gap-2">
          <Wand2 className="h-4 w-4" />
          <span className="hidden sm:inline">Prompt Engineer</span>
          <span className="sm:hidden">Prompt</span>
        </TabsTrigger>
        <TabsTrigger value="test" className="gap-2">
          <TestTube className="h-4 w-4" />
          <span className="hidden sm:inline">Test Chat</span>
          <span className="sm:hidden">Test</span>
        </TabsTrigger>
        <TabsTrigger value="training" className="gap-2">
          <Brain className="h-4 w-4" />
          <span className="hidden sm:inline">Model Training</span>
          <span className="sm:hidden">Training</span>
        </TabsTrigger>
        <TabsTrigger value="settings" className="gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="prompt" className="mt-0">
        <PromptEngineerTab
          chatbot={chatbot}
          isTraining={isTraining}
          onRefresh={onRefresh}
          user={user}
        />
      </TabsContent>

      <TabsContent value="test" className="mt-0">
        <BusinessChatbotTest
          chatbotId={chatbot.id}
          chatbotName={chatbot.name}
        />
      </TabsContent>

      <TabsContent value="training" className="mt-0">
        <ModelTrainingTab
          chatbot={chatbot}
          isTraining={isTraining}
          onRefresh={onRefresh}
          user={user}
        />
      </TabsContent>

      <TabsContent value="settings" className="mt-0">
        <ChatbotSettingsModern
          chatbot={chatbot}
          onUpdate={onRefresh}
        />
      </TabsContent>
    </Tabs>
  );
};

const ChatbotAIStudio = () => {
  const [activeSection, setActiveSection] = useState('chatbot-ai-studio');
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
          <ChatbotPageLayout title="AI Studio">
            {(chatbot, isTraining, onRefresh) => (
              <AIStudioTabs
                chatbot={chatbot}
                isTraining={isTraining}
                onRefresh={onRefresh}
              />
            )}
          </ChatbotPageLayout>
        </div>
      </main>
    </div>
  );
};

export default ChatbotAIStudio;
