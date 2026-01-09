import { useState, useRef, useEffect, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Bot, User, RefreshCw, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Helper function to render message content with images
function renderMessageWithImages(content: string): ReactNode[] {
  const elements: ReactNode[] = [];
  let keyIndex = 0;

  // Combined pattern to find all image references:
  // - [IMAGE:url:caption] format
  // - Markdown images ![caption](url)
  // - Direct image URLs
  const combinedPattern = /\[IMAGE:(https?:\/\/[^\]]+):([^\]]*)\]|!\[([^\]]*)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/gi;

  let lastIndex = 0;
  let match;

  while ((match = combinedPattern.exec(content)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) {
        elements.push(
          <p key={`text-${keyIndex++}`} className="whitespace-pre-wrap">
            {textBefore}
          </p>
        );
      }
    }

    let imageUrl = '';
    let caption = '';

    if (match[1] && match[2] !== undefined) {
      // [IMAGE:url:caption] format
      imageUrl = match[1];
      caption = match[2];
    } else if (match[3] !== undefined && match[4]) {
      // ![caption](url) format
      imageUrl = match[4];
      caption = match[3];
    } else if (match[5]) {
      // Direct URL
      imageUrl = match[5];
      caption = 'Image';
    }

    if (imageUrl) {
      elements.push(
        <div key={`img-${keyIndex++}`} className="my-2">
          <img
            src={imageUrl}
            alt={caption || 'Image'}
            className="max-w-full rounded-lg shadow-md max-h-64 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {caption && (
            <p className="text-xs text-gray-500 mt-1 italic">{caption}</p>
          )}
        </div>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex).trim();
    if (remainingText) {
      elements.push(
        <p key={`text-${keyIndex++}`} className="whitespace-pre-wrap">
          {remainingText}
        </p>
      );
    }
  }

  // If no images were found, just return the content as-is
  if (elements.length === 0) {
    elements.push(
      <p key="text-only" className="whitespace-pre-wrap">
        {content}
      </p>
    );
  }

  return elements;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface BusinessChatbotTestProps {
  chatbotId: string;
  chatbotName: string;
}

export function BusinessChatbotTest({ chatbotId, chatbotName }: BusinessChatbotTestProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextInfo, setContextInfo] = useState({
    products: 0,
    promotions: 0,
    knowledgeFiles: 0,
    hasSystemPrompt: false
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load context information
  useEffect(() => {
    loadContextInfo();
  }, [chatbotId]);

  const loadContextInfo = async () => {
    try {
      // Get products count
      const { count: productsCount } = await supabase
        .from('chatbot_products')
        .select('*', { count: 'exact', head: true })
        .eq('chatbot_id', chatbotId);

      // Get active promotions count
      const now = new Date().toISOString();
      const { count: promotionsCount } = await supabase
        .from('chatbot_promotions')
        .select('*', { count: 'exact', head: true })
        .eq('chatbot_id', chatbotId)
        .eq('is_active', true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`);

      // Get knowledge files count
      const { count: filesCount } = await supabase
        .from('avatar_knowledge_files')
        .select('*', { count: 'exact', head: true })
        .eq('avatar_id', chatbotId)
        .eq('is_linked', true);

      // Check for active system prompt
      const { data: promptVersion } = await supabase
        .from('avatar_prompt_versions')
        .select('id')
        .eq('avatar_id', chatbotId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      setContextInfo({
        products: productsCount || 0,
        promotions: promotionsCount || 0,
        knowledgeFiles: filesCount || 0,
        hasSystemPrompt: !!promptVersion
      });
    } catch (error) {
      console.error('Error loading context info:', error);
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

    const userMessage: Message = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      // Get session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Call avatar-chat edge function (same as n8n would use)
      const response = await fetch(`${supabaseUrl}/functions/v1/avatar-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-api-key': 'test-mode' // Special key for test mode
        },
        body: JSON.stringify({
          avatar_id: chatbotId,
          message: inputMessage,
          conversation_history: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          model: 'gpt-4o-mini'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Show metadata if available
      if (data.metadata) {
        console.log('Response metadata:', data.metadata);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to get response from chatbot",
        variant: "destructive"
      });

      // Add error message
      const errorMessage: Message = {
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
    setMessages([]);
    toast({
      title: "Chat Reset",
      description: "Conversation cleared"
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Suggested questions based on context
  const suggestedQuestions = [
    contextInfo.products > 0 ? "What products do you have?" : null,
    contextInfo.promotions > 0 ? "Do you have any promotions?" : null,
    contextInfo.products > 0 ? "Show me products under RM 1000" : null,
    contextInfo.knowledgeFiles > 0 ? "What are your store policies?" : null,
    "Tell me about your business",
    contextInfo.promotions > 0 ? "What discounts are available?" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Context Info Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Test Chat - {chatbotName}
            </CardTitle>
            <Button onClick={handleReset} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant={contextInfo.hasSystemPrompt ? "default" : "secondary"}>
              {contextInfo.hasSystemPrompt ? '✓' : '○'} System Prompt
            </Badge>
            <Badge variant={contextInfo.products > 0 ? "default" : "secondary"}>
              {contextInfo.products} Products
            </Badge>
            <Badge variant={contextInfo.promotions > 0 ? "default" : "secondary"}>
              {contextInfo.promotions} Promotions
            </Badge>
            <Badge variant={contextInfo.knowledgeFiles > 0 ? "default" : "secondary"}>
              {contextInfo.knowledgeFiles} Knowledge Files
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            This test uses the same API endpoint as n8n (WhatsApp integration)
          </p>
        </CardContent>
      </Card>

      {/* Chat Messages */}
      <Card className="h-[500px] flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <Bot className="h-16 w-16 text-gray-300" />
              <div>
                <p className="text-lg font-semibold text-gray-600">Start a conversation</p>
                <p className="text-sm text-muted-foreground">
                  Test your chatbot with products and knowledge base
                </p>
              </div>
              {suggestedQuestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Try asking:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestedQuestions.map((question, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        onClick={() => setInputMessage(question!)}
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="text-sm space-y-2">
                        {renderMessageWithImages(msg.content)}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
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
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-lg p-3">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </CardContent>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || loading}
              size="icon"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
