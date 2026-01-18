import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Bot, User, RefreshCw, Wand2, Copy, Check, Sparkles, Database, Package, Tag, FileText, Save, FolderOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

  // AI Generate states
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerateDialogOpen, setAiGenerateDialogOpen] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [savingGenerated, setSavingGenerated] = useState(false);
  const [dataStats, setDataStats] = useState({ products: 0, promotions: 0, knowledge: 0, categories: 0 });

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

  // AI Analyze & Generate function - Comprehensive prompt generation
  const handleAiGenerate = async () => {
    try {
      setAiGenerating(true);

      // Get session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Fetch all chatbot data comprehensively
      const [chatbotRes, productsRes, promotionsRes, knowledgeRes] = await Promise.all([
        supabase.from('avatars').select('*').eq('id', chatbotId).eq('user_id', userId).single(),
        supabase.from('chatbot_products').select('product_name, description, category, price, in_stock, sku, stock_quantity').eq('chatbot_id', chatbotId).limit(100),
        supabase.from('chatbot_promotions').select('title, description, discount_type, discount_value, promo_code, start_date, end_date').eq('chatbot_id', chatbotId).eq('is_active', true),
        supabase.from('avatar_knowledge_files').select('file_name, original_name').eq('avatar_id', chatbotId).eq('processing_status', 'processed')
      ]);

      const chatbot = chatbotRes.data;
      const products = productsRes.data || [];
      const promotions = promotionsRes.data || [];
      const knowledge = knowledgeRes.data || [];

      // Get unique categories with product counts
      const categoryMap = new Map<string, { count: number; samples: string[] }>();
      products.forEach(p => {
        const cat = p.category || 'Uncategorized';
        if (!categoryMap.has(cat)) {
          categoryMap.set(cat, { count: 0, samples: [] });
        }
        const catData = categoryMap.get(cat)!;
        catData.count++;
        if (catData.samples.length < 3) {
          catData.samples.push(p.product_name);
        }
      });

      // Update data stats with category count
      setDataStats({
        products: products.length,
        promotions: promotions.length,
        knowledge: knowledge.length,
        categories: categoryMap.size
      });

      // Build comprehensive categories summary
      const categoriesList = Array.from(categoryMap.entries())
        .map(([cat, data]) => `- ${cat} (${data.count} items): e.g. ${data.samples.join(', ')}`)
        .join('\n');

      // Build products with details
      const productDetails = products.slice(0, 30).map(p =>
        `• ${p.product_name}${p.sku ? ` [${p.sku}]` : ''} - RM${p.price || 0} - ${p.in_stock ? 'In Stock' : 'Out of Stock'}${p.category ? ` | Category: ${p.category}` : ''}`
      ).join('\n');

      // Build promotions details
      const promotionDetails = promotions.map(p =>
        `• ${p.title}: ${p.discount_type === 'percentage' ? `${p.discount_value}% OFF` : `RM${p.discount_value} OFF`}${p.promo_code ? ` | Code: ${p.promo_code}` : ' | No code needed'}`
      ).join('\n') || 'No active promotions';

      // Knowledge base summary
      const knowledgeDetails = knowledge.map(k =>
        `• ${k.original_name || k.file_name}`
      ).join('\n') || 'No knowledge base documents';

      // Build the comprehensive AI prompt
      const aiPrompt = `You are an expert prompt engineer. Generate a COMPLETE, PRODUCTION-READY system prompt for a WhatsApp business chatbot.

═══════════════════════════════════════════════════════════════════════════════
BUSINESS INFORMATION (Use this data to create the prompt)
═══════════════════════════════════════════════════════════════════════════════

CHATBOT NAME: ${chatbot?.name || 'Assistant'}
COMPANY NAME: ${chatbot?.company_name || 'Our Store'}
INDUSTRY: ${chatbot?.industry || 'Retail'}
BUSINESS CONTEXT: ${chatbot?.business_context || 'A friendly store helping customers'}
SUPPORTED LANGUAGES: ${(chatbot?.supported_languages || ['en', 'zh', 'ms']).join(', ')}
DEFAULT LANGUAGE: ${chatbot?.default_language || 'en'}

RESPONSE GUIDELINES FROM OWNER:
${chatbot?.response_guidelines?.length > 0 ? chatbot.response_guidelines.map((g: string, i: number) => `${i + 1}. ${g}`).join('\n') : '- Be helpful and friendly\n- Answer questions accurately'}

COMPLIANCE RULES:
${chatbot?.compliance_rules?.length > 0 ? chatbot.compliance_rules.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n') : '- Be professional\n- Never share false information'}

═══════════════════════════════════════════════════════════════════════════════
PRODUCT CATEGORIES (${categoryMap.size} categories, ${products.length} total products)
═══════════════════════════════════════════════════════════════════════════════
${categoriesList || 'No products configured yet'}

═══════════════════════════════════════════════════════════════════════════════
SAMPLE PRODUCTS
═══════════════════════════════════════════════════════════════════════════════
${productDetails || 'No products'}

═══════════════════════════════════════════════════════════════════════════════
ACTIVE PROMOTIONS
═══════════════════════════════════════════════════════════════════════════════
${promotionDetails}

═══════════════════════════════════════════════════════════════════════════════
KNOWLEDGE BASE DOCUMENTS
═══════════════════════════════════════════════════════════════════════════════
${knowledgeDetails}

═══════════════════════════════════════════════════════════════════════════════
CRITICAL REQUIREMENTS FOR THE GENERATED PROMPT
═══════════════════════════════════════════════════════════════════════════════

**MUST INCLUDE ALL OF THESE:**

1️⃣ SELF-INTRODUCTION SECTION
   - The chatbot MUST introduce itself with its name (${chatbot?.name || 'Assistant'})
   - MUST introduce the company (${chatbot?.company_name || 'Our Store'})
   - Include a warm greeting template

2️⃣ CATEGORIES & PRODUCTS SECTION
   - List ALL ${categoryMap.size} categories the store sells
   - The chatbot should be able to tell customers what categories are available
   - Include sample products from each category

3️⃣ MESSAGE SPLITTING WITH || (⚠️ HIGH PRIORITY ⚠️)
   - EVERY response example MUST use || to split messages
   - This creates natural chat flow on WhatsApp
   - Example: "Hi there! || I'm ${chatbot?.name || 'here'} from ${chatbot?.company_name || 'our store'} || How can I help you today?"
   - DO NOT write long paragraphs - split them with ||

4️⃣ SAMPLE QUESTIONS TO ASK CUSTOMERS
   - Include examples of probing questions to understand customer needs
   - Like: "What are you looking for today?" || "Any specific brand preference?"
   - For products: "What's your budget range?" || "Is this for yourself or as a gift?"

5️⃣ HUMANIZED RESPONSES (Like a sales consultant, NOT a robot)
   - Sound like a real person chatting on WhatsApp
   - Use casual, warm language
   - NO corporate speak
   - Include personality and friendliness

6️⃣ MULTIPLE RESPONSE EXAMPLES (At least 8-10 different scenarios)
   - Greeting/Welcome
   - Product inquiry
   - Price inquiry
   - Promotion/discount inquiry
   - Out of stock handling
   - Category browsing
   - Checkout/order help
   - Complaint/issue handling
   - Farewell/thank you
   - Unknown question handling

7️⃣ LANGUAGE MATCHING
   - Reply in the SAME language customer uses
   - English → English, 中文 → 中文, BM → BM
   - Include examples in multiple languages

8️⃣ TOOL USAGE INSTRUCTIONS
   - The chatbot has access to: search_products, get_products_by_category, get_active_promotions
   - Include instructions on when to use each tool
   - Always use tools to get accurate info, never make up data

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════════

Generate a COMPLETE system prompt that is 1500-2500 words. Structure it like this:

---START OF PROMPT---
You are [NAME], the friendly assistant of [COMPANY]...

## YOUR IDENTITY
[Self-introduction section]

## WHAT WE SELL
[Categories and products section]

## LANGUAGE RULES
[Language matching rules]

## MESSAGE STYLE (⚠️ IMPORTANT)
[Message splitting with || rules and examples]

## AVAILABLE TOOLS
[Tool usage instructions]

## SAMPLE QUESTIONS TO ASK
[Probing questions section]

## RESPONSE EXAMPLES
[At least 8-10 scenario examples with || splitting]

## COMPLIANCE
[Rules to follow]
---END OF PROMPT---

IMPORTANT: Return ONLY the system prompt. No explanations, no markdown code blocks, no "Here is the prompt:" text. Just the raw prompt content.`;

      // Call chat-completions edge function (API key handled server-side)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `You are an expert prompt engineer who creates COMPREHENSIVE, PRODUCTION-READY system prompts for WhatsApp business chatbots.

Your prompts are known for:
- Being complete and ready to use immediately
- Including detailed response examples with || message splitting
- Having warm, human-like personality
- Covering all common customer scenarios
- Never being generic or template-like

You always generate prompts that are 1500-2500 words with multiple sections and many examples.`
              },
              { role: 'user', content: aiPrompt }
            ],
            temperature: 0.8,
            max_tokens: 6000
          })
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to generate prompt');
      }

      const data = await response.json();
      const generated = data.choices[0]?.message?.content || '';

      setGeneratedPrompt(generated);
      setAiGenerateDialogOpen(true);

      toast({
        title: "Comprehensive Prompt Generated!",
        description: `Analyzed ${products.length} products across ${categoryMap.size} categories, ${promotions.length} promotions, ${knowledge.length} knowledge files`
      });
    } catch (error: any) {
      console.error('Error generating prompt:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate prompt",
        variant: "destructive"
      });
    } finally {
      setAiGenerating(false);
    }
  };

  // Save generated prompt as new version
  const handleSaveGeneratedPrompt = async () => {
    try {
      setSavingGenerated(true);

      // Get current highest version number
      const { data: versions } = await supabase
        .from('avatar_prompt_versions')
        .select('version_number')
        .eq('avatar_id', chatbotId)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersionNumber = (versions && versions.length > 0) ? versions[0].version_number + 1 : 1;

      // Deactivate all existing versions
      await supabase
        .from('avatar_prompt_versions')
        .update({ is_active: false })
        .eq('avatar_id', chatbotId)
        .eq('user_id', userId);

      // Create new version
      const { error: insertError } = await supabase
        .from('avatar_prompt_versions')
        .insert({
          avatar_id: chatbotId,
          user_id: userId,
          version_number: nextVersionNumber,
          version_name: `AI Generated v${nextVersionNumber}`,
          system_prompt: generatedPrompt,
          is_active: true
        });

      if (insertError) throw insertError;

      toast({
        title: "Prompt Saved!",
        description: `Created version ${nextVersionNumber} and set as active`
      });

      setAiGenerateDialogOpen(false);
      setCurrentPrompt(generatedPrompt);
      onPromptUpdated?.();
    } catch (error: any) {
      console.error('Error saving prompt:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save prompt",
        variant: "destructive"
      });
    } finally {
      setSavingGenerated(false);
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
            <div className="flex items-center gap-2 flex-wrap">
              {versionDropdown}
              <Button
                onClick={handleAiGenerate}
                variant="default"
                size="sm"
                disabled={aiGenerating}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {aiGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Generate
                  </>
                )}
              </Button>
              <Button onClick={handleCopyPrompt} variant="outline" size="sm" disabled={!currentPrompt}>
                {copiedPrompt ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedPrompt ? 'Copied!' : 'Copy'}
              </Button>
              <Button onClick={handleSavePrompt} size="sm" disabled={!currentPrompt}>
                Save
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

      {/* AI Generate Dialog */}
      <Dialog open={aiGenerateDialogOpen} onOpenChange={setAiGenerateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI Generated Prompt
            </DialogTitle>
            <DialogDescription>
              Generated based on your chatbot's data. Review and edit before saving.
            </DialogDescription>
          </DialogHeader>

          {/* Data Stats */}
          <div className="flex flex-wrap gap-3 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-blue-600" />
              <span><strong>{dataStats.products}</strong> Products</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FolderOpen className="h-4 w-4 text-purple-600" />
              <span><strong>{dataStats.categories}</strong> Categories</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Tag className="h-4 w-4 text-green-600" />
              <span><strong>{dataStats.promotions}</strong> Promotions</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-orange-600" />
              <span><strong>{dataStats.knowledge}</strong> Knowledge Files</span>
            </div>
          </div>

          {/* Info about what was generated */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>What's included in this prompt:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Self-introduction with chatbot name and company</li>
              <li>All {dataStats.categories} product categories listed</li>
              <li>Message splitting with || for WhatsApp</li>
              <li>8-10 response examples for different scenarios</li>
              <li>Humanized, consultant-style language</li>
              <li>Multi-language support (EN/CN/BM)</li>
            </ul>
          </div>

          {/* Generated Prompt */}
          <div className="space-y-2">
            <Textarea
              value={generatedPrompt}
              onChange={(e) => setGeneratedPrompt(e.target.value)}
              rows={18}
              className="font-mono text-sm"
              placeholder="Generated prompt will appear here..."
            />
            <p className="text-xs text-muted-foreground">
              You can edit the prompt before saving
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAiGenerateDialogOpen(false)} disabled={savingGenerated}>
              Cancel
            </Button>
            <Button onClick={handleSaveGeneratedPrompt} disabled={savingGenerated || !generatedPrompt}>
              {savingGenerated ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save as New Version
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
