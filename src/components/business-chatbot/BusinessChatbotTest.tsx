import { useState, useRef, useEffect, ReactNode, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Bot, User, RefreshCw, TestTube, Package, Tag, FileText, Sparkles, History, ChevronDown, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PromptVersion {
  id: string;
  version_number: number;
  version_name: string | null;
  is_active: boolean;
}

// Helper function to render message content with images
function renderMessageWithImages(content: string): ReactNode[] {
  const elements: ReactNode[] = [];
  let keyIndex = 0;

  // Combined pattern to find all image references:
  // 1. [IMAGE:content] format - we'll parse URL:caption manually
  // 2. Markdown images ![caption](url)
  // 3. Direct image URLs
  const combinedPattern = /\[IMAGE:([^\]]+)\]|!\[([^\]]*)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s<>"']*)?)/gi;

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

    if (match[1]) {
      // [IMAGE:content] format - parse URL and caption
      // Format is URL:caption, where URL contains :// but caption doesn't
      const imageContent = match[1];
      // Find the last colon that's NOT part of http:// or https://
      const schemeMatch = imageContent.match(/^(https?:\/\/)/);
      if (schemeMatch) {
        const afterScheme = imageContent.slice(schemeMatch[1].length);
        const colonIndex = afterScheme.indexOf(':');
        if (colonIndex !== -1) {
          imageUrl = schemeMatch[1] + afterScheme.slice(0, colonIndex);
          caption = afterScheme.slice(colonIndex + 1);
        } else {
          imageUrl = imageContent;
          caption = '';
        }
      } else {
        // No scheme, just use the whole thing as URL
        imageUrl = imageContent;
        caption = '';
      }
    } else if (match[2] !== undefined && match[3]) {
      // ![caption](url) format
      imageUrl = match[3];
      caption = match[2];
    } else if (match[4]) {
      // Direct URL
      imageUrl = match[4];
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
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('active');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputMessage, adjustTextareaHeight]);

  // Load context information and versions
  useEffect(() => {
    loadContextInfo();
    loadVersions();
  }, [chatbotId]);

  const loadVersions = async () => {
    try {
      const { data, error } = await supabase
        .from('avatar_prompt_versions')
        .select('id, version_number, version_name, is_active')
        .eq('avatar_id', chatbotId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('Error loading versions:', error);
    }
  };

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
          model: 'gpt-4o-mini',
          // Pass specific version ID if not using active
          ...(selectedVersionId !== 'active' && { prompt_version_id: selectedVersionId })
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();

      // DEBUG: Log raw response
      console.log('Raw AI response:', data.message);

      // ============================================
      // COMPREHENSIVE IMAGE EXTRACTION & REMOVAL
      // Extract all image formats, dedupe by URL, keep only ONE per unique URL
      // ============================================

      // Helper to extract URL from different formats
      const extractUrl = (imageStr: string): string => {
        // [IMAGE:url:caption] format
        const imageTagMatch = imageStr.match(/\[IMAGE:(https?:\/\/[^:\]]+)/i);
        if (imageTagMatch) return imageTagMatch[1];

        // ![caption](url) format
        const markdownMatch = imageStr.match(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/i);
        if (markdownMatch) return markdownMatch[1];

        // Direct URL
        if (imageStr.startsWith('http')) return imageStr;

        return imageStr;
      };

      // Pattern 1: [IMAGE:url:caption] format
      const imageTagPattern = /\[IMAGE:[^\]]+\]/gi;
      // Pattern 2: Markdown images ![caption](url)
      const markdownImagePattern = /!\[[^\]]*\]\([^)]+\)/gi;
      // Pattern 3: Direct image URLs
      const directUrlPattern = /https?:\/\/[^\s<>"'\])+]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s<>"'\])]*)?/gi;

      // Extract all images
      const imageTagMatches = data.message.match(imageTagPattern) || [];
      const markdownMatches = data.message.match(markdownImagePattern) || [];
      const directUrlMatches = data.message.match(directUrlPattern) || [];

      // Dedupe by URL - prefer [IMAGE:...] format as it has caption
      const urlToImageMap = new Map<string, string>();

      // Add direct URLs first (lowest priority)
      directUrlMatches.forEach((img: string) => {
        const url = extractUrl(img);
        if (!urlToImageMap.has(url)) {
          urlToImageMap.set(url, img);
        }
      });

      // Add markdown images (medium priority)
      markdownMatches.forEach((img: string) => {
        const url = extractUrl(img);
        urlToImageMap.set(url, img); // Override direct URL
      });

      // Add [IMAGE:...] tags (highest priority - has caption)
      imageTagMatches.forEach((img: string) => {
        const url = extractUrl(img);
        urlToImageMap.set(url, img); // Override all others
      });

      // Get unique images (one per URL, preferring [IMAGE:...] format)
      const uniqueImages = Array.from(urlToImageMap.values());

      console.log('All extracted:', { imageTagMatches, markdownMatches, directUrlMatches });
      console.log('Unique images (deduped by URL):', uniqueImages);

      // Remove ALL image formats from the text
      let messageWithoutImages = data.message;
      messageWithoutImages = messageWithoutImages.replace(imageTagPattern, ' ');
      messageWithoutImages = messageWithoutImages.replace(markdownImagePattern, ' ');
      messageWithoutImages = messageWithoutImages.replace(directUrlPattern, ' ');

      // Clean up: remove extra whitespace, normalize || separators
      messageWithoutImages = messageWithoutImages
        .replace(/\s+/g, ' ')           // Multiple spaces to single space
        .replace(/\s*\|\|\s*/g, '||')   // Clean up around ||
        .replace(/^\|\||\|\|$/g, '')    // Remove leading/trailing ||
        .trim();

      console.log('Message without images:', messageWithoutImages);

      // Split by || for multiple message bubbles
      const messageParts = messageWithoutImages
        .split('||')
        .map((part: string) => part.trim())
        .filter((part: string) => part.length > 0);

      console.log('Message parts:', messageParts);
      console.log('Number of parts:', messageParts.length);

      // Process messages - images ONLY go on the LAST message
      if (messageParts.length > 1) {
        for (let i = 0; i < messageParts.length; i++) {
          const isLastPart = i === messageParts.length - 1;

          // ONLY add images to the very last message part
          const content = (isLastPart && uniqueImages.length > 0)
            ? messageParts[i] + '\n\n' + uniqueImages.join('\n')
            : messageParts[i];

          const assistantMessage: Message = {
            role: 'assistant',
            content,
            timestamp: new Date()
          };

          if (i === 0) {
            setMessages(prev => [...prev, assistantMessage]);
          } else {
            await new Promise(resolve => setTimeout(resolve, 800));
            setMessages(prev => [...prev, assistantMessage]);
          }
        }
      } else if (messageParts.length === 1) {
        // Single message - append images at the end
        const finalContent = uniqueImages.length > 0
          ? messageParts[0] + '\n\n' + uniqueImages.join('\n')
          : messageParts[0];

        const assistantMessage: Message = {
          role: 'assistant',
          content: finalContent,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // No text, only images
        const assistantMessage: Message = {
          role: 'assistant',
          content: uniqueImages.join('\n'),
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      }

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Suggested questions based on context (limit to 3)
  const suggestedQuestions = [
    contextInfo.products > 0 ? "What products do you have?" : null,
    contextInfo.promotions > 0 ? "Any promotions available?" : null,
    "Tell me about your business",
  ].filter(Boolean).slice(0, 3);

  return (
    <Card className="flex flex-col h-[calc(100vh-260px)] min-h-[500px]">
      {/* Header */}
      <CardHeader className="pb-3 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TestTube className="h-5 w-5 text-blue-600" />
              Test Your Chatbot
            </CardTitle>
            <CardDescription className="mt-1">
              Simulate customer conversations to test responses
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Version Selector */}
            {versions.length > 0 && (
              <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                <SelectTrigger className="w-[180px] h-9">
                  <History className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-green-600" />
                      <span>Active Version</span>
                    </div>
                  </SelectItem>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <div className="flex items-center gap-2">
                        {v.is_active && <Check className="h-3 w-3 text-green-600" />}
                        <span>v{v.version_number}{v.version_name ? `: ${v.version_name}` : ''}</span>
                        {v.is_active && <span className="text-xs text-muted-foreground">(active)</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleReset} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        {/* Context Stats */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${contextInfo.hasSystemPrompt ? 'bg-green-500' : 'bg-gray-300'}`} />
            <Sparkles className="h-3 w-3" />
            <span>Prompt</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${contextInfo.products > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
            <Package className="h-3 w-3" />
            <span>{contextInfo.products}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${contextInfo.promotions > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
            <Tag className="h-3 w-3" />
            <span>{contextInfo.promotions}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${contextInfo.knowledgeFiles > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
            <FileText className="h-3 w-3" />
            <span>{contextInfo.knowledgeFiles}</span>
          </div>
        </div>
      </CardHeader>

      {/* Chat Messages */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
              <Bot className="h-10 w-10 text-blue-600" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">Ready to test!</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Send a message to see how your chatbot responds to customer queries
              </p>
            </div>
            {suggestedQuestions.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium">Quick starters:</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {suggestedQuestions.map((question, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs"
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
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="text-sm space-y-2">
                      {renderMessageWithImages(msg.content)}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                  <p className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-blue-200' : 'text-muted-foreground'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </CardContent>

      {/* Input Area */}
      <div className="border-t p-4 shrink-0 bg-muted/30">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            disabled={loading}
            className="flex-1 min-h-[44px] max-h-[120px] resize-none overflow-y-auto focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
            rows={1}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || loading}
            size="icon"
            className="shrink-0 h-11 w-11 rounded-full"
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
  );
}
