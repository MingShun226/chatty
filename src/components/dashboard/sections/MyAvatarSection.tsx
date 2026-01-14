
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, User, MessageCircle, Edit, Trash2, ArrowLeft, Globe, BookOpen, Shield, FileText, QrCode, Grid3X3, Heart, Share, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import AvatarAssignSection from '@/components/dashboard/sections/AvatarAssignSection';

interface Avatar {
  id: string;
  name: string;
  avatar_images: string[];
  primary_language: string;
  secondary_languages: string[];
  origin_country: string;
  age: number;
  gender: string;
  backstory: string;
  personality_traits: string[];
  hidden_rules: string;
  mbti_type: string;
  created_at: string;
}

interface KnowledgeFile {
  id: string;
  file_name: string;
  file_size: number;
  uploaded_at: string;
  content_type: string;
}

const MyAvatarSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [assigningAvatar, setAssigningAvatar] = useState<Avatar | null>(null);
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('media');
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    avatarId: string;
    avatarName: string;
  }>({
    open: false,
    avatarId: '',
    avatarName: ''
  });

  useEffect(() => {
    if (user) {
      fetchAvatars();
    }
  }, [user]);

  const fetchAvatars = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching avatars:', error);
        toast({
          title: "Error",
          description: "Failed to load your avatars.",
          variant: "destructive"
        });
      } else {
        setAvatars(data || []);
      }
    } catch (error) {
      console.error('Error fetching avatars:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKnowledgeFiles = async (avatarId: string) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('avatar_knowledge_files')
        .select('id, file_name, file_size, uploaded_at, content_type')
        .eq('avatar_id', avatarId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .eq('is_linked', true)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      setKnowledgeFiles(data || []);
    } catch (error: any) {
      console.error('Error fetching knowledge files:', error);
      toast({
        title: "Error",
        description: "Failed to load knowledge files.",
        variant: "destructive"
      });
    }
  };

  const handleCreateNewAvatar = () => {
    navigate('/create-avatar');
  };

  const handleViewAvatar = async (avatar: Avatar) => {
    setIsLoadingDetails(true);
    setSelectedAvatar(avatar);
    await fetchKnowledgeFiles(avatar.id);
    setIsLoadingDetails(false);
  };

  const handleBackToList = () => {
    setSelectedAvatar(null);
    setAssigningAvatar(null);
    setKnowledgeFiles([]);
  };

  const handleEditAvatar = (avatarId: string) => {
    navigate(`/create-avatar/${avatarId}`);
  };

  const handleChatWithAvatar = (avatarId: string) => {
    // Navigate to chatbot overview with pre-selected avatar
    navigate(`/chatbot/overview?avatar=${avatarId}`);
  };

  const handleAssignAvatar = (avatar: Avatar) => {
    setAssigningAvatar(avatar);
  };

  const openDeleteDialog = (avatarId: string, avatarName: string) => {
    setDeleteDialog({
      open: true,
      avatarId,
      avatarName
    });
  };

  const handleDeleteAvatar = async () => {
    try {
      // Use the soft delete function instead of direct delete
      const { error } = await supabase.rpc('soft_delete_avatar', {
        avatar_id_param: deleteDialog.avatarId,
        deletion_reason_param: 'User requested deletion via dashboard'
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Avatar Moved to Trash",
        description: `${deleteDialog.avatarName} has been moved to trash. It will be permanently deleted after 90 days.`,
      });

      // Refresh the avatars list
      fetchAvatars();
      
      // If the deleted avatar was currently selected or being assigned, go back to list
      if ((selectedAvatar && selectedAvatar.id === deleteDialog.avatarId) || 
          (assigningAvatar && assigningAvatar.id === deleteDialog.avatarId)) {
        handleBackToList();
      }
    } catch (error: any) {
      console.error('Error deleting avatar:', error);
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete avatar. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDeleteDialog({ open: false, avatarId: '', avatarName: '' });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6" />
            My Avatars
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your AI avatars and their configurations
          </p>
        </div>
        
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show avatar assign view
  if (assigningAvatar) {
    return (
      <AvatarAssignSection 
        avatar={assigningAvatar} 
        onBack={handleBackToList}
      />
    );
  }

  // Show avatar details view - CLEAN DESKTOP STYLE UI
  if (selectedAvatar) {
    return (
      <div className="max-w-5xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToList}
            className="p-2 hover:bg-muted/50 rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">{selectedAvatar.name}</h1>
        </div>

        {isLoadingDetails ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading avatar details...</p>
          </div>
        ) : (
          <>
            {/* Profile Header - Clean Desktop Style */}
            <div className="bg-background border border-border rounded-lg p-4 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                {/* Profile Avatar */}
                <div className="flex-shrink-0 mx-auto sm:mx-0">
                  <Avatar className="w-20 h-20 sm:w-24 sm:h-24 border-2 border-border">
                    <AvatarImage 
                      src={selectedAvatar.avatar_images?.[0]} 
                      alt={selectedAvatar.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-lg sm:text-xl font-semibold">
                      {selectedAvatar.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Profile Info */}
                <div className="flex-1 w-full text-center sm:text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
                    <h2 className="text-xl font-semibold">{selectedAvatar.name}</h2>
                    <Button 
                      onClick={() => handleEditAvatar(selectedAvatar.id)} 
                      variant="outline" 
                      size="sm"
                      className="px-3 sm:px-4 self-center sm:self-auto"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Avatar
                    </Button>
                  </div>

                  {/* Bio line */}
                  <p className="text-sm text-muted-foreground mb-3 break-words">
                    {selectedAvatar.age} years old | {selectedAvatar.gender} | {selectedAvatar.origin_country}
                  </p>

                  {/* Stats Row */}
                  <div className="flex flex-wrap gap-4 sm:gap-8 mb-4">
                    <div className="flex items-center gap-2">
                      <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{selectedAvatar.avatar_images?.length || 0}</span>
                      <span className="text-sm text-muted-foreground">Posts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">124</span>
                      <span className="text-sm text-muted-foreground">Followers</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      className="px-6 sm:px-8" 
                      onClick={() => handleChatWithAvatar(selectedAvatar.id)}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Chat
                    </Button>
                    <Button variant="outline" className="px-4 sm:px-6">
                      <Plus className="h-4 w-4 mr-2" />
                      Follow
                    </Button>
                    <Button variant="outline" className="px-4 sm:px-6">
                      <Share className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
                <TabsTrigger value="media" className="flex items-center gap-2 py-3">
                  <Grid3X3 className="h-4 w-4" />
                  Posts
                </TabsTrigger>
                <TabsTrigger value="about" className="flex items-center gap-2 py-3">
                  <User className="h-4 w-4" />
                  About
                </TabsTrigger>
              </TabsList>

              {/* Posts Tab - Clean Grid Layout */}
              <TabsContent value="media" className="mt-0">
                {selectedAvatar.avatar_images && selectedAvatar.avatar_images.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-6">
                      {selectedAvatar.avatar_images.map((image: string, index: number) => (
                        <div key={index} className="aspect-square relative group cursor-pointer overflow-hidden rounded-lg bg-muted">
                          <img
                            src={image}
                            alt={`${selectedAvatar.name} ${index + 1}`}
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <div className="bg-white/90 rounded-full p-2">
                                <Heart className="h-5 w-5 text-gray-700" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Load more button */}
                    <div className="text-center">
                      <Button variant="outline" className="px-8 py-2">
                        Load more
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 bg-muted/20 rounded-lg">
                    <Grid3X3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No posts yet</h3>
                    <p className="text-muted-foreground mb-4">When you share photos, they'll appear on your profile.</p>
                    <Button 
                      onClick={() => handleEditAvatar(selectedAvatar.id)}
                      variant="outline"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Add Photos
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* About Tab - Clean Layout */}
              <TabsContent value="about" className="mt-0">
                <div className="space-y-8">
                  {/* About Me Section */}
                  {selectedAvatar.backstory && (
                    <div>
                      <h3 className="text-lg font-medium mb-4">About me</h3>
                      <div className="bg-muted/20 rounded-lg p-6">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedAvatar.backstory}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Two Column Layout for Traits and Details */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                    {/* Left Column - Personality & Languages */}
                    <div className="space-y-6">
                      {/* Personality Traits */}
                      {selectedAvatar.personality_traits && selectedAvatar.personality_traits.length > 0 && (
                        <div>
                          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Personality
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {selectedAvatar.personality_traits.map((trait: string, index: number) => (
                              <span 
                                key={index} 
                                className="px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer"
                              >
                                {trait}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Languages */}
                      <div>
                        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                          <Globe className="h-5 w-5" />
                          Languages
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <span className="px-4 py-2 bg-secondary/80 text-secondary-foreground rounded-full text-sm font-medium mr-2">
                              {selectedAvatar.primary_language}
                            </span>
                            <span className="text-xs text-muted-foreground">Primary</span>
                          </div>
                          {selectedAvatar.secondary_languages && selectedAvatar.secondary_languages.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {selectedAvatar.secondary_languages.map((lang: string, index: number) => (
                                <span 
                                  key={index} 
                                  className="px-3 py-1 bg-muted border rounded-full text-sm"
                                >
                                  {lang}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Details & Files */}
                    <div className="space-y-6">
                      {/* Basic Information */}
                      <div>
                        <h3 className="text-lg font-medium mb-4">Basic Information</h3>
                        <div className="bg-muted/20 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Age:</span>
                            <span className="text-sm font-medium">{selectedAvatar.age} years old</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Gender:</span>
                            <span className="text-sm font-medium capitalize">{selectedAvatar.gender}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Origin:</span>
                            <span className="text-sm font-medium">{selectedAvatar.origin_country}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Created:</span>
                            <span className="text-sm font-medium">
                              {new Date(selectedAvatar.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {selectedAvatar.mbti_type && (
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">MBTI:</span>
                              <Badge variant="outline">{selectedAvatar.mbti_type}</Badge>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Knowledge Base */}
                      {knowledgeFiles && knowledgeFiles.length > 0 && (
                        <div>
                          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Knowledge Base
                          </h3>
                          <div className="space-y-2">
                            {knowledgeFiles.map((file: KnowledgeFile) => (
                              <div key={file.id} className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                                <div className="bg-primary/10 p-2 rounded">
                                  <FileText className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{file.file_name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs px-2 py-1 bg-background rounded border">
                                      {file.content_type === 'application/pdf' ? 'PDF' : 'FILE'}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatFileSize(file.file_size)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hidden Rules */}
                      {selectedAvatar.hidden_rules && (
                        <div>
                          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Special Instructions
                          </h3>
                          <div className="bg-muted/20 rounded-lg p-4">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {selectedAvatar.hidden_rules}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    );
  }

  // Show avatars list view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6" />
            My Avatars
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your AI avatars and their configurations
          </p>
        </div>
        <Button onClick={handleCreateNewAvatar} className="btn-hero">
          <Plus className="h-4 w-4 mr-2" />
          Create New Avatar
        </Button>
      </div>

      {/* Avatars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {avatars.length === 0 ? (
          <div className="col-span-full">
            <Card className="card-modern text-center py-12">
              <CardContent>
                <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <CardTitle className="mb-2">No Avatars Yet</CardTitle>
                <CardDescription className="mb-4">
                  Create your first AI avatar to get started with personalized AI interactions.
                </CardDescription>
                <Button onClick={handleCreateNewAvatar} className="btn-hero">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Avatar
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          avatars.map((avatar) => (
            <Card key={avatar.id} className="card-modern hover:shadow-lg transition-shadow group">
              <CardHeader className="pb-3">
                <div className="aspect-square rounded-lg overflow-hidden mb-3 bg-muted">
                  {avatar.avatar_images && avatar.avatar_images.length > 0 ? (
                    <img
                      src={avatar.avatar_images[0]}
                      alt={avatar.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardTitle className="text-lg truncate">{avatar.name}</CardTitle>
                <div className="space-y-2">
                  <Badge variant="outline" className="text-xs">
                    {avatar.primary_language}
                  </Badge>
                  {avatar.secondary_languages && avatar.secondary_languages.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      +{avatar.secondary_languages.length} more languages
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewAvatar(avatar)}
                    className="flex-1"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAssignAvatar(avatar)}
                    className="flex-1"
                  >
                    <QrCode className="h-3 w-3 mr-1" />
                    Assign
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleChatWithAvatar(avatar.id)}
                    className="flex-1"
                  >
                    <MessageCircle className="h-3 w-3 mr-1" />
                    Chat
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteDialog(avatar.id, avatar.name)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        onConfirm={handleDeleteAvatar}
        title="Delete Avatar"
        description="Are you sure you want to delete"
        itemName={deleteDialog.avatarName}
      />
    </div>
  );
};

export default MyAvatarSection;
