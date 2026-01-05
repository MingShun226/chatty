import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, Eye, Save, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BusinessPromptService } from '@/services/businessPromptService';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AIPromptGeneratorProps {
  chatbotId: string;
  userId: string;
  onPromptGenerated?: (prompt: string) => void;
  compact?: boolean; // New prop for compact mode
}

export function AIPromptGenerator({ chatbotId, userId, onPromptGenerated, compact = false }: AIPromptGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleGeneratePrompt = async () => {
    try {
      setGenerating(true);

      // Generate comprehensive system prompt using AI
      const prompt = await BusinessPromptService.generateBusinessSystemPrompt(
        chatbotId,
        userId
      );

      setGeneratedPrompt(prompt);
      setPreviewOpen(true);

      toast({
        title: "System Prompt Generated",
        description: "AI has created an optimized system prompt based on your chatbot configuration"
      });
    } catch (error: any) {
      console.error('Error generating prompt:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate system prompt",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveAsVersion = async () => {
    try {
      setSaving(true);

      // Get current chatbot details
      const { data: chatbot } = await supabase
        .from('avatars')
        .select('*')
        .eq('id', chatbotId)
        .single();

      if (!chatbot) {
        throw new Error('Chatbot not found');
      }

      // Get current highest version number
      const { data: versions } = await supabase
        .from('avatar_prompt_versions')
        .select('version_number')
        .eq('avatar_id', chatbotId)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersionNumber = (versions && versions.length > 0)
        ? versions[0].version_number + 1
        : 1;

      // Deactivate all existing versions
      await supabase
        .from('avatar_prompt_versions')
        .update({ is_active: false })
        .eq('avatar_id', chatbotId)
        .eq('user_id', userId);

      // Create new version with generated prompt
      const { error: insertError } = await supabase
        .from('avatar_prompt_versions')
        .insert({
          avatar_id: chatbotId,
          user_id: userId,
          version_number: nextVersionNumber,
          version_name: `AI Generated v${nextVersionNumber}`,
          system_prompt: generatedPrompt,
          personality_traits: chatbot.personality_traits || [],
          behavior_rules: [],
          compliance_rules: chatbot.compliance_rules || [],
          response_guidelines: chatbot.response_guidelines || [],
          is_active: true
        });

      if (insertError) throw insertError;

      toast({
        title: "System Prompt Saved",
        description: `Created version ${nextVersionNumber} and set as active`
      });

      setPreviewOpen(false);

      // Callback to parent component
      if (onPromptGenerated) {
        onPromptGenerated(generatedPrompt);
      }
    } catch (error: any) {
      console.error('Error saving prompt version:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save system prompt",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Compact mode - just a button on the right side
  if (compact) {
    return (
      <>
        <Card className="w-auto">
          <CardContent className="p-4">
            <Button
              onClick={handleGeneratePrompt}
              disabled={generating}
              size="lg"
              className="whitespace-nowrap"
            >
              {generating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate based on existing data
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              First-time setup
            </p>
          </CardContent>
        </Card>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Generated System Prompt
              </DialogTitle>
              <DialogDescription>
                Review and edit the AI-generated prompt. Click "Save as Version" to use it.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 border">
                <Textarea
                  value={generatedPrompt}
                  onChange={(e) => setGeneratedPrompt(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  You can edit the prompt before saving
                </p>
              </div>

              {/* Save button next to the prompt */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveAsVersion}
                  disabled={saving}
                  size="lg"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save this as version
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  <strong>💡 Tip:</strong> This prompt is optimized based on your business context, products, and knowledge base.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPreviewOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Full mode - original card layout
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI System Prompt Generator (GPT-4o)
          </CardTitle>
          <CardDescription>
            Generate a humanized Malaysian salesman-style system prompt using GPT-4o. Your chatbot will sound like a real, friendly shop owner - not a robot!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              GPT-4o will analyze your business and create a warm, persuasive Malaysian salesman-style prompt:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Business context and company information</li>
                <li>Compliance rules and response guidelines</li>
                <li>Product catalog ({chatbotId ? 'loaded' : 'not loaded'})</li>
                <li>Knowledge base documents</li>
                <li>Malaysian chat style (老板, boss, lah, lor, ah, ||)</li>
                <li>Persuasion techniques (urgency, social proof, upselling)</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleGeneratePrompt}
            disabled={generating}
            size="lg"
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating System Prompt...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Generate System Prompt with AI
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Creates a humanized Malaysian salesman-style prompt - your chatbot will chat like a real, friendly shop owner on WhatsApp!
          </p>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Generated Malaysian Salesman Prompt
            </DialogTitle>
            <DialogDescription>
              Review this GPT-4o generated prompt. Your chatbot will sound like a warm, persuasive Malaysian shop owner!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 border">
              <Textarea
                value={generatedPrompt}
                onChange={(e) => setGeneratedPrompt(e.target.value)}
                rows={20}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                You can edit the prompt before saving
              </p>
            </div>

            {/* Save button next to the prompt */}
            <div className="flex justify-end">
              <Button
                onClick={handleSaveAsVersion}
                disabled={saving}
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save this as version
                  </>
                )}
              </Button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                <strong>💡 Tip:</strong> This Malaysian salesman-style prompt will make your WhatsApp chatbot sound warm and persuasive, like a real shop owner chatting with customers (老板, lah, lor, ||).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
