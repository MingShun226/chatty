import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  ArrowLeft, 
  Grid3X3, 
  User, 
  Globe, 
  FileText, 
  BookOpen, 
  Shield, 
  Edit, 
  Heart,
  MessageCircle,
  Share,
  MoreHorizontal
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBackNavigation } from '@/hooks/useBackNavigation';

interface AvatarData {
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
  created_at: string;
  status?: string;
}

interface KnowledgeFile {
  id: string;
  file_name: string;
  file_size: number;
  uploaded_at: string;
  content_type: string;
}

const AvatarDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { goBack } = useBackNavigation();
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('media');

  useEffect(() => {
    console.log('AvatarDetail: Component loaded with Instagram-style UI');
    console.log('AvatarDetail: Avatar ID from params:', id);
    console.log('AvatarDetail: User authenticated:', !!user);

    if (id) {
      fetchAvatar();
      if (user) {
        fetchKnowledgeFiles();
      }
    }
  }, [user, id]);

  // Set up real-time updates for avatar changes
  useEffect(() => {
    if (!id || !user) return;

    const channel = supabase
      .channel('avatar-detail-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'avatars',
          filter: `id=eq.${id}`
        },
        (payload) => {
          console.log('Avatar updated:', payload);
          if (payload.new) {
            fetchAvatar();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'avatar_knowledge_files',
          filter: `avatar_id=eq.${id}`
        },
        (payload) => {
          console.log('Knowledge files updated:', payload);
          fetchKnowledgeFiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  const fetchAvatar = async () => {
    if (!id) return;

    console.log('🔥 AvatarDetail: Loading NEW Instagram-Style UI v2.0 for avatar:', id);
    try {
      // First try to get user's own avatar (only if user is authenticated)
      let { data, error } = null;

      if (user?.id) {
        const result = await supabase
          .from('avatars')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        data = result.data;
        error = result.error;
      }

      // If not found and user is authenticated, try to get marketplace avatar
      if (!data && user) {
        const { data: marketplaceData, error: marketplaceError } = await supabase
          .from('avatars')
          .select('*')
          .eq('id', id)
          .eq('is_public', true)
          .eq('status', 'active')
          .maybeSingle();

        data = marketplaceData;
        error = marketplaceError;
      }

      // If user is not authenticated, try to get marketplace avatar
      if (!data && !user) {
        const { data: marketplaceData, error: marketplaceError } = await supabase
          .from('avatars')
          .select('*')
          .eq('id', id)
          .eq('is_public', true)
          .eq('status', 'active')
          .maybeSingle();

        data = marketplaceData;
        error = marketplaceError;
      }

      if (error) {
        if (error.code === 'PGRST116') {
          toast({
            title: "Avatar Not Found",
            description: "The avatar you're looking for doesn't exist or you don't have permission to view it.",
            variant: "destructive"
          });
          navigate('/my-avatars');
          return;
        }
        throw error;
      }

      // Transform the data to match our Avatar interface
      const avatarData: AvatarData = {
        id: data.id,
        name: data.name,
        avatar_images: data.avatar_images || [],
        primary_language: data.primary_language,
        secondary_languages: data.secondary_languages || [],
        origin_country: data.origin_country,
        age: data.age,
        gender: data.gender,
        backstory: data.backstory || '',
        personality_traits: data.personality_traits || [],
        hidden_rules: data.hidden_rules || '',
        created_at: data.created_at,
        status: data.status
      };

      setAvatar(avatarData);
    } catch (error: any) {
      console.error('Error fetching avatar:', error);
      toast({
        title: "Error",
        description: "Failed to load avatar details.",
        variant: "destructive"
      });
      navigate('/my-avatars');
    }
  };

  const fetchKnowledgeFiles = async () => {
    if (!user || !id) return;
    
    try {
      const { data, error } = await supabase
        .from('avatar_knowledge_files')
        .select('id, file_name, file_size, uploaded_at, content_type')
        .eq('avatar_id', id)
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditAvatar = () => {
    navigate(`/create-avatar/${id}`);
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
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              <div className="h-64 bg-muted rounded-lg"></div>
              <div className="h-32 bg-muted rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!avatar) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Avatar Not Found</h1>
            <Button onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  console.log('AvatarDetail: Component rendering, activeTab:', activeTab);
  
  console.log('🎨 Rendering Instagram-Style Avatar Detail UI');
  
  return (
    <div className="min-h-screen bg-background">
      {/* Very visible indicator that new UI is loaded */}
      <div className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-center py-2 text-sm font-medium">
        🎉 NEW INSTAGRAM-STYLE UI LOADED! 🎉
      </div>
      
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 mb-8 border-b border-border pb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            className="p-2 hover:bg-muted/50 rounded-full"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold">{avatar.name}</h1>
          <div className="ml-auto">
            <span className="text-xs bg-green-500 text-white px-3 py-1 rounded-full font-medium">
              INSTAGRAM UI ✨
            </span>
          </div>
        </div>

        {/* Instagram-Style Profile Header */}
        <div className="mb-10">
          <div className="flex items-start gap-8 mb-8">
            {/* Large Profile Avatar with Instagram-style border */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="w-40 h-40 p-1 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 rounded-full">
                  <Avatar className="w-full h-full border-4 border-background">
                    <AvatarImage 
                      src={avatar.avatar_images?.[0]} 
                      alt={avatar.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-primary/20 to-secondary/20">
                      {avatar.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </div>

            {/* Profile Info Section */}
            <div className="flex-1 min-w-0 pt-4">
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <h2 className="text-3xl font-light tracking-wide">{avatar.name}</h2>
                <Button 
                  onClick={handleEditAvatar} 
                  variant="outline" 
                  size="sm" 
                  className="px-6 font-semibold border-2 hover:bg-primary hover:text-primary-foreground transition-all"
                >
                  Edit Profile
                </Button>
                <Button variant="outline" size="sm" className="p-2">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </div>

              {/* Instagram-style Stats Row */}
              <div className="flex gap-10 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{avatar.avatar_images?.length || 0}</div>
                  <div className="text-sm text-muted-foreground font-medium tracking-wide">posts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{knowledgeFiles.length}</div>
                  <div className="text-sm text-muted-foreground font-medium tracking-wide">files</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{avatar.personality_traits?.length || 0}</div>
                  <div className="text-sm text-muted-foreground font-medium tracking-wide">traits</div>
                </div>
              </div>

              {/* Bio Section with Instagram styling */}
              <div className="space-y-3 max-w-lg">
                <div className="font-bold text-base">
                  {avatar.age} • {avatar.gender} • {avatar.origin_country}
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-primary">🌐 {avatar.primary_language}</span>
                  {avatar.secondary_languages && avatar.secondary_languages.length > 0 && (
                    <span className="text-muted-foreground ml-2">
                      +{avatar.secondary_languages.length} more languages
                    </span>
                  )}
                </div>
                {avatar.backstory && (
                  <div className="text-sm leading-relaxed">
                    {avatar.backstory.length > 120 
                      ? `${avatar.backstory.slice(0, 120)}...` 
                      : avatar.backstory
                    }
                  </div>
                )}
                {avatar.personality_traits && avatar.personality_traits.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {avatar.personality_traits.slice(0, 4).map((trait: string, index: number) => (
                      <span key={index} className="text-xs px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                        #{trait.toLowerCase().replace(/\s+/g, '')}
                      </span>
                    ))}
                    {avatar.personality_traits.length > 4 && (
                      <span className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
                        +{avatar.personality_traits.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons - Instagram Style */}
          <div className="flex gap-3">
            <Button 
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2.5 rounded-lg" 
              onClick={() => navigate(`/chatbot/overview?avatar=${avatar.id}`)}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              Message
            </Button>
            <Button className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2.5 rounded-lg">
              <Share className="h-5 w-5 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="media" className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" />
              Media
            </TabsTrigger>
            <TabsTrigger value="about" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              About
            </TabsTrigger>
          </TabsList>

          {/* Media Tab */}
          <TabsContent value="media" className="mt-0">
            {avatar.avatar_images && avatar.avatar_images.length > 0 ? (
              <div className="grid grid-cols-3 gap-px md:gap-1">
                {avatar.avatar_images.map((image: string, index: number) => (
                  <div key={index} className="aspect-square relative group cursor-pointer overflow-hidden bg-muted">
                    <img
                      src={image}
                      alt={`${avatar.name} ${index + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 flex gap-6 text-white">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Heart className="h-5 w-5" />
                          <span>Like</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <MessageCircle className="h-5 w-5" />
                          <span>View</span>
                        </div>
                      </div>
                    </div>
                    {/* Media type indicator for videos */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/50 rounded-full p-1">
                        <Grid3X3 className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Add placeholder items to maintain grid structure */}
                {avatar.avatar_images.length % 3 !== 0 && (
                  Array.from({ length: 3 - (avatar.avatar_images.length % 3) }).map((_, index) => (
                    <div key={`placeholder-${index}`} className="aspect-square bg-transparent"></div>
                  ))
                )}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-4">
                  <Grid3X3 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-medium mb-2">No posts yet</h3>
                <p className="text-muted-foreground mb-4">When you share photos, they'll appear on your profile.</p>
                <Button 
                  variant="outline" 
                  onClick={handleEditAvatar}
                  className="hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Add Photos
                </Button>
              </div>
            )}
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="mt-0">
            <div className="space-y-6">
              {/* About Section */}
              {avatar.backstory && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      About
                    </h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {avatar.backstory}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Languages */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Languages
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Primary</p>
                      <Badge variant="default">{avatar.primary_language}</Badge>
                    </div>
                    {avatar.secondary_languages && avatar.secondary_languages.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Secondary</p>
                        <div className="flex flex-wrap gap-2">
                          {avatar.secondary_languages.map((lang: string, index: number) => (
                            <Badge key={index} variant="outline">{lang}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Personality Traits */}
              {avatar.personality_traits && avatar.personality_traits.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Personality
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {avatar.personality_traits.map((trait: string, index: number) => (
                        <Badge key={index} variant="secondary">{trait}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Knowledge Base */}
              {knowledgeFiles && knowledgeFiles.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Knowledge Base ({knowledgeFiles.length} files)
                    </h3>
                    <div className="space-y-2">
                      {knowledgeFiles.map((file: KnowledgeFile) => (
                        <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg">
                          <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.file_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {file.content_type === 'application/pdf' ? 'PDF' : 'FILE'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatFileSize(file.file_size)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(file.uploaded_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Hidden Rules */}
              {avatar.hidden_rules && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Hidden Rules & Instructions
                    </h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {avatar.hidden_rules}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Basic Info */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-3">Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Age</p>
                      <p className="font-medium">{avatar.age} years old</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Gender</p>
                      <p className="font-medium capitalize">{avatar.gender}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Origin</p>
                      <p className="font-medium">{avatar.origin_country}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium">
                        {new Date(avatar.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AvatarDetail;