import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Save, CheckCircle2, User, BookOpen, Shield, Database, Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useBackNavigation } from '@/hooks/useBackNavigation';
import { UnsavedChangesDialog } from '@/components/ui/unsaved-changes-dialog';
import { TrainingService } from '@/services/trainingService';

// Import step components
import { AvatarDetailStep } from '@/components/avatar-creation/AvatarDetailStep';
import { AvatarPersonaStep } from '@/components/avatar-creation/AvatarPersonaStep';
import { BackstoryStep } from '@/components/avatar-creation/BackstoryStep';
import { HiddenRulesStep } from '@/components/avatar-creation/HiddenRulesStep';
import { KnowledgeBaseStep } from '@/components/avatar-creation/KnowledgeBaseStep';

const steps = [
  { id: 'detail', title: 'Avatar Detail', icon: User, description: 'Basic information and images' },
  { id: 'persona', title: 'Personality', icon: User, description: 'Traits and characteristics' },
  { id: 'backstory', title: 'Backstory', icon: BookOpen, description: 'History and background' },
  { id: 'rules', title: 'Hidden Rules', icon: Shield, description: 'Internal guidelines' },
  { id: 'knowledge', title: 'Knowledge Base', icon: Database, description: 'Upload documents' }
];

export default function CreateAvatar() {
  const navigate = useNavigate();
  const { id: avatarId } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { goBack } = useBackNavigation();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [formData, setFormData] = useState({
    // Avatar Detail
    name: '',
    originCountry: 'Malaysia',
    age: '',
    gender: '',
    primaryLanguage: '',
    secondaryLanguages: [],
    avatarImages: [],
    
    // Personality
    personalityTraits: [],
    mbtiType: '',
    
    // Backstory
    backstory: '',
    
    // Hidden Rules
    hiddenRules: '',
    
    // Knowledge Base
    knowledgeFiles: []
  });

  // Check if user has made any changes
  const hasAnyData = () => {
    return formData.name.trim() !== '' ||
           formData.age.trim() !== '' ||
           formData.gender.trim() !== '' ||
           formData.primaryLanguage.trim() !== '' ||
           formData.secondaryLanguages.length > 0 ||
           formData.avatarImages.length > 0 ||
           formData.personalityTraits.length > 0 ||
           formData.mbtiType.trim() !== '' ||
           formData.backstory.trim() !== '' ||
           formData.hiddenRules.trim() !== '' ||
           formData.knowledgeFiles.length > 0;
  };

  // Update unsaved changes status when form data changes
  useEffect(() => {
    if (!avatarId) { // Only track changes for new avatars
      setHasUnsavedChanges(hasAnyData());
    }
  }, [formData, avatarId]);

  // Use unsaved changes protection
  const { confirmNavigation, showDialog, handleConfirm, handleCancel, message } = useUnsavedChanges({
    hasUnsavedChanges,
    message: "You have unsaved changes in your avatar creation. If you leave now, all your progress will be lost. Are you sure you want to continue?"
  });

  // Load existing avatar data if editing
  useEffect(() => {
    if (avatarId && user) {
      loadAvatarData();
    }
  }, [avatarId, user]);

  const loadAvatarData = async () => {
    if (!avatarId || !user) return;
    
    setIsLoading(true);
    try {
      const { data: avatar, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('id', avatarId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading avatar:', error);
        toast({
          title: "Error",
          description: "Failed to load avatar data.",
          variant: "destructive"
        });
        return;
      }

      if (avatar) {
        setFormData({
          name: avatar.name || '',
          originCountry: avatar.origin_country || 'Malaysia',
          age: avatar.age?.toString() || '',
          gender: avatar.gender || '',
          primaryLanguage: avatar.primary_language || '',
          secondaryLanguages: avatar.secondary_languages || [],
          avatarImages: avatar.avatar_images || [],
          personalityTraits: avatar.personality_traits || [],
          mbtiType: avatar.mbti_type || '',
          backstory: avatar.backstory || '',
          hiddenRules: avatar.hidden_rules || '',
          knowledgeFiles: [] // This will be loaded by KnowledgeBaseStep
        });
        // Don't track changes for existing avatars initially
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateCurrentStep = () => {
    const step = steps[currentStep];
    
    switch (step.id) {
      case 'detail':
        return formData.name && formData.age && formData.gender && formData.primaryLanguage;
      case 'persona':
        return formData.personalityTraits.length > 0;
      case 'backstory':
        return formData.backstory.trim().length > 0;
      case 'rules':
        return true; // Optional step
      case 'knowledge':
        return true; // Optional step
      default:
        return false;
    }
  };

  const saveToDatabase = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to save your avatar.",
        variant: "destructive"
      });
      return false;
    }

    setIsSaving(true);
    try {
      const avatarData = {
        user_id: user.id,
        name: formData.name,
        origin_country: formData.originCountry,
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender,
        primary_language: formData.primaryLanguage,
        secondary_languages: formData.secondaryLanguages,
        avatar_images: formData.avatarImages,
        personality_traits: formData.personalityTraits,
        mbti_type: formData.mbtiType,
        backstory: formData.backstory,
        hidden_rules: formData.hiddenRules
      };

      let savedAvatarId = avatarId;

      if (avatarId) {
        // Update existing avatar
        const { error: updateError } = await supabase
          .from('avatars')
          .update(avatarData)
          .eq('id', avatarId)
          .eq('user_id', user.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new avatar
        const { data: newAvatar, error: insertError } = await supabase
          .from('avatars')
          .insert(avatarData)
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        savedAvatarId = newAvatar.id;

        // Generate initial system prompt from avatar profile
        try {
          const systemPrompt = TrainingService.generateBaseSystemPrompt(newAvatar);

          // Update avatar with generated system prompt
          const { error: promptUpdateError } = await supabase
            .from('avatars')
            .update({ system_prompt: systemPrompt })
            .eq('id', newAvatar.id);

          if (promptUpdateError) {
            console.error('Failed to save initial system prompt:', promptUpdateError);
          } else {
            console.log('Generated initial system prompt for avatar:', newAvatar.name);
          }

          // Create version 1 with the original prompt
          if (user) {
            try {
              await TrainingService.createPromptVersion({
                avatar_id: newAvatar.id,
                user_id: user.id,
                training_data_id: null, // No training data for original version
                version_number: 1,
                version_name: 'Original Avatar Profile',
                description: 'Initial version generated from avatar profile details',
                system_prompt: systemPrompt,
                personality_traits: newAvatar.personality_traits || [],
                behavior_rules: [], // Will be populated by training
                response_style: {
                  formality: 'casual',
                  emoji_usage: 'minimal',
                  response_length: 'adaptive',
                  tone: 'friendly'
                },
                is_active: true, // Make this the active version
                is_published: false,
                usage_count: 0,
                rating: null,
                feedback_notes: null,
                parent_version_id: null, // Base version
                changes_from_parent: null,
                inheritance_type: 'full',
                base_version_id: null
              });
              console.log('Created version 1 for avatar:', newAvatar.name);
            } catch (versionError) {
              console.error('Failed to create version 1.0:', versionError);
            }
          }
        } catch (error) {
          console.error('Error generating system prompt:', error);
        }

        // Save knowledge files for new avatar
        if (formData.knowledgeFiles.length > 0) {
          const filesWithTempId = formData.knowledgeFiles.filter((file: any) => 
            file.id.startsWith('temp-') && file.file
          );

          for (const file of filesWithTempId) {
            const fileName = `${user.id}/${savedAvatarId}/${Date.now()}-${file.file.name}`;
            
            const { data: storageData, error: storageError } = await supabase.storage
              .from('knowledge-base')
              .upload(fileName, file.file);

            if (storageError) {
              console.error('Storage upload error:', storageError);
              continue;
            }

            const { error: dbError } = await supabase
              .from('avatar_knowledge_files')
              .insert({
                avatar_id: savedAvatarId,
                user_id: user.id,
                file_name: file.file.name,
                file_path: storageData.path,
                file_size: file.file.size,
                content_type: file.file.type || 'application/pdf',
                is_linked: true
              });

            if (dbError) {
              console.error('Database insert error:', dbError);
            }
          }
        }
      }

      toast({
        title: avatarId ? "Avatar Updated" : "Avatar Created",
        description: avatarId ? "Your avatar has been updated successfully!" : "Your avatar has been created successfully!",
      });

      // Clear unsaved changes after successful save
      setHasUnsavedChanges(false);

      return savedAvatarId;
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save avatar. Please try again.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) {
      toast({
        title: "Incomplete Step",
        description: "Please fill in all required fields before proceeding.",
        variant: "destructive"
      });
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    const savedAvatarId = await saveToDatabase();
    if (savedAvatarId) {
      navigate('/my-avatars');
    }
  };

  const handleFinish = async () => {
    setIsCreating(true);
    const savedAvatarId = await saveToDatabase();
    if (savedAvatarId) {
      setTimeout(() => {
        setIsCreating(false);
        navigate('/my-avatars');
      }, 2000);
    } else {
      setIsCreating(false);
    }
  };

  const handleBackClick = () => {
    confirmNavigation(() => {
      goBack();
    });
  };

  const renderCurrentStep = () => {
    const step = steps[currentStep];
    const commonProps = {
      data: formData,
      onUpdate: updateFormData,
      avatarId
    };

    switch (step.id) {
      case 'detail':
        return <AvatarDetailStep {...commonProps} />;
      case 'persona':
        return <AvatarPersonaStep {...commonProps} />;
      case 'backstory':
        return <BackstoryStep {...commonProps} />;
      case 'rules':
        return <HiddenRulesStep {...commonProps} />;
      case 'knowledge':
        return <KnowledgeBaseStep {...commonProps} />;
      default:
        return null;
    }
  };

  const progress = currentStep === 0 ? 0 : currentStep === steps.length - 1 ? 100 : (currentStep / (steps.length - 1)) * 100;
  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isValid = validateCurrentStep();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading avatar data...</p>
        </div>
      </div>
    );
  }

  // Show creating state
  if (isCreating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
              <div>
                <h3 className="text-xl font-semibold">Creating Avatar...</h3>
                <p className="text-muted-foreground mt-2">
                  Please wait while we set up your avatar
                </p>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '75%' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackClick}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">
                {avatarId ? 'Edit Avatar' : 'Create New Avatar'}
              </h1>
              <p className="text-muted-foreground text-sm md:text-base">
                {avatarId ? 'Update your avatar details' : 'Build your AI avatar step by step'}
              </p>
            </div>
          </div>

          {/* Progress */}
          <Card className="mb-6">
            <CardContent className="p-4 md:p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    Step {currentStep + 1} of {steps.length}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(progress)}% Complete
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
                
                {/* Step indicators - responsive */}
                <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
                  {steps.map((step, index) => {
                    const StepIcon = step.icon;
                    const isActive = index === currentStep;
                    const isCompleted = index < currentStep;
                    
                    return (
                      <div
                        key={step.id}
                        className={`flex flex-col items-center space-y-1 min-w-0 flex-1 ${
                          isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
                        }`}
                      >
                        <div className={`p-2 rounded-full border-2 ${
                          isActive ? 'border-primary bg-primary/10' : 
                          isCompleted ? 'border-green-600 bg-green-50' : 'border-muted'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" />
                          ) : (
                            <StepIcon className="h-4 w-4 md:h-5 md:w-5" />
                          )}
                        </div>
                        <span className="text-xs font-medium text-center hidden sm:block truncate w-full">
                          {step.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Step Header */}
          <div className="text-center mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
              {currentStepData.title}
            </h2>
            <p className="text-muted-foreground text-sm md:text-base">
              {currentStepData.description}
            </p>
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-6">
          {renderCurrentStep()}
        </div>

        {/* Navigation */}
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-between">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="w-full sm:w-auto"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={!isValid || isSaving}
                  className="w-full sm:w-auto"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Draft'}
                </Button>

                {isLastStep ? (
                  <Button
                    onClick={handleFinish}
                    disabled={!isValid || isSaving || isCreating}
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {avatarId ? 'Update Avatar' : 'Create Avatar'}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={!isValid}
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                  >
                    Next Step
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={showDialog}
        onOpenChange={(open) => !open && handleCancel()}
        onConfirm={handleConfirm}
        message={message}
      />
    </div>
  );
}
