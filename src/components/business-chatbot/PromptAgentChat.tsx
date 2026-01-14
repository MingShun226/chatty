import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Bot, User, RefreshCw, Wand2, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PromptAgentService, PromptAgentMessage } from '@/services/promptAgentService';

interface PromptAgentChatProps {
  chatbotId: string;
  userId: string;
  onPromptUpdated?: () => void;
  versionDropdown?: ReactNode;
}

export function PromptAgentChat({ chatbotId, userId, onPromptUpdated, versionDropdown }: PromptAgentChatProps) {
  const [messages, setMessages] = useState<Array<PromptAgentMessage & { timestamp: Date }>>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [chatbotContext, setChatbotContext] = useState<any>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 150); // Max 150px (~5 lines)
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    loadChatbotData();
  }, [chatbotId]);

  const loadChatbotData = async () => {
    try {
      // Get chatbot details
      const { data: chatbot } = await supabase
        .from('avatars')
        .select('*')
        .eq('id', chatbotId)
        .eq('user_id', userId)
        .single();

      if (!chatbot) return;

      setChatbotContext({
        name: chatbot.name,
        company_name: chatbot.company_name,
        industry: chatbot.industry,
        business_context: chatbot.business_context,
        compliance_rules: chatbot.compliance_rules,
        response_guidelines: chatbot.response_guidelines
      });

      // Get active prompt version
      const { data: activePrompt } = await supabase
        .from('avatar_prompt_versions')
        .select('system_prompt')
        .eq('avatar_id', chatbotId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activePrompt) {
        setCurrentPrompt(activePrompt.system_prompt);
      }

      // Add welcome message
      setMessages([{
        role: 'assistant',
        content: `Hello! 👋 I'm your Prompt Engineering Agent. I'm here to help you refine and optimize your chatbot's system prompt.\n\n${activePrompt ? "I've loaded your current prompt." : "I notice you don't have a prompt yet."}\n\n**What would you like to do?**\n- Make the tone more friendly/professional\n- Add specific behaviors or responses\n- Adjust persuasion techniques\n- Change how products are presented\n- Or just tell me what you'd like to improve!`,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error loading chatbot data:', error);
      toast({
        title: "Error",
        description: "Failed to load chatbot information",
        variant: "destructive"
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage: PromptAgentMessage & { timestamp: Date } = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      // Get conversation history (exclude welcome message and timestamps)
      const conversationHistory: PromptAgentMessage[] = messages
        .slice(1) // Skip welcome message
        .map(({ role, content }) => ({ role, content }));

      // Chat with agent
      const agentResponse = await PromptAgentService.chatWithAgent(
        userId,
        currentPrompt,
        inputMessage,
        conversationHistory,
        chatbotContext
      );

      const assistantMessage: PromptAgentMessage & { timestamp: Date } = {
        role: 'assistant',
        content: agentResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Check if agent provided an updated prompt
      const promptMatch = agentResponse.match(/```\s*\n([\s\S]*?)\n```/);
      if (promptMatch && promptMatch[1]) {
        const extractedPrompt = promptMatch[1].trim();
        // Only update if it looks like a system prompt (contains "You are")
        if (extractedPrompt.includes('You are')) {
          setCurrentPrompt(extractedPrompt);
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to get response from Prompt Agent",
        variant: "destructive"
      });

      const errorMessage: PromptAgentMessage & { timestamp: Date } = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}. Please try again or check your API settings.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([{
      role: 'assistant',
      content: `Chat reset! What would you like to work on with your chatbot prompt?`,
      timestamp: new Date()
    }]);
    loadChatbotData();
    toast({
      title: "Chat Reset",
      description: "Conversation cleared"
    });
  };

  const handleCopyPrompt = async () => {
    if (!currentPrompt) return;

    try {
      await navigator.clipboard.writeText(currentPrompt);
      setCopiedPrompt(true);
      toast({
        title: "Copied!",
        description: "Current prompt copied to clipboard"
      });
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy prompt",
        variant: "destructive"
      });
    }
  };

  const handleSavePrompt = async () => {
    if (!currentPrompt) {
      toast({
        title: "No Prompt",
        description: "There's no prompt to save yet",
        variant: "destructive"
      });
      return;
    }

    try {
      // Get current highest version number
      const { data: versions } = await supabase
        .from('avatar_prompt_versions')
        .select('version_number')
        .eq('avatar_id', chatbotId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      // Parse version number properly - handle both string and number formats
      let nextVersionNumber = 1;
      if (versions && versions.length > 0) {
        const currentVersion = versions[0].version_number;
        // Handle string formats like 'v1.0', 'v1', '1', or numeric 1
        if (typeof currentVersion === 'string') {
          const parsed = parseInt(currentVersion.replace(/[^0-9]/g, ''), 10);
          nextVersionNumber = isNaN(parsed) ? 1 : parsed + 1;
        } else if (typeof currentVersion === 'number') {
          nextVersionNumber = Math.floor(currentVersion) + 1;
        }
      }

      // Deactivate all existing versions
      await supabase
        .from('avatar_prompt_versions')
        .update({ is_active: false })
        .eq('avatar_id', chatbotId)
        .eq('user_id', userId);

      // Create new version with integer version number
      const { error: insertError } = await supabase
        .from('avatar_prompt_versions')
        .insert({
          avatar_id: chatbotId,
          user_id: userId,
          version_number: nextVersionNumber,
          version_name: `Agent Refined v${nextVersionNumber}`,
          system_prompt: currentPrompt,
          personality_traits: chatbotContext?.personality_traits || [],
          behavior_rules: [],
          compliance_rules: chatbotContext?.compliance_rules || [],
          response_guidelines: chatbotContext?.response_guidelines || [],
          is_active: true
        });

      if (insertError) throw insertError;

      toast({
        title: "Prompt Saved!",
        description: `Created v${nextVersionNumber} and set as active`
      });

      if (onPromptUpdated) {
        onPromptUpdated();
      }
    } catch (error: any) {
      console.error('Error saving prompt:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save prompt",
        variant: "destructive"
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Adjust height when input changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [inputMessage, adjustTextareaHeight]);

  const suggestedQuestions = [
    "Make it sound more casual and friendly",
    "Add more urgency when showing products",
    "Make upselling more natural"
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wand2 className="h-5 w-5 text-purple-600" />
                Prompt Engineering Agent
              </CardTitle>
              <CardDescription className="mt-1">
                Chat with AI to refine your chatbot's system prompt - no technical knowledge needed!
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {versionDropdown}
              <Button onClick={handleCopyPrompt} variant="outline" size="sm" disabled={!currentPrompt}>
                {copiedPrompt ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedPrompt ? 'Copied!' : 'Copy Prompt'}
              </Button>
              <Button onClick={handleSavePrompt} size="sm" disabled={!currentPrompt}>
                Save as Version
              </Button>
              <Button onClick={handleReset} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">
              <Wand2 className="h-3 w-3 mr-1" />
              GPT-4o Powered
            </Badge>
            <Badge variant={currentPrompt ? "default" : "secondary"}>
              {currentPrompt ? 'Prompt Loaded' : 'No Prompt Yet'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Tell the agent what you want to change, and it will help you refine your prompt professionally
          </p>
        </CardContent>
      </Card>

      {/* Chat Messages */}
      <Card className="h-[calc(100vh-420px)] min-h-[400px] flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Wand2 className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="prose prose-sm max-w-none">
                  {msg.role === 'assistant' ? (
                    <div
                      className="text-sm whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: msg.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/```([\s\S]*?)```/g, '<pre class="bg-white p-2 rounded border mt-2 mb-2 overflow-x-auto"><code>$1</code></pre>')
                          .replace(/`(.*?)`/g, '<code class="bg-white px-1 rounded">$1</code>')
                          .replace(/^- (.*?)$/gm, '• $1')
                      }}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-5 w-5 text-gray-600" />
                  </div>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <Wand2 className="h-5 w-5 text-purple-600" />
                </div>
              </div>
              <div className="bg-gray-100 rounded-lg p-3">
                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
              </div>
            </div>
          )}
          {messages.length === 1 && (
            <div className="space-y-2 mt-4">
              <p className="text-xs text-muted-foreground text-center">Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestedQuestions.map((question, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => setInputMessage(question)}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell me what you'd like to change about your prompt... (Shift+Enter for new line)"
              disabled={loading}
              className="flex-1 min-h-[44px] max-h-[150px] resize-none overflow-y-auto focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
              rows={1}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || loading}
              size="icon"
              className="shrink-0 h-11 w-11"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </Card>
    </div>
  );
}
