import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bot, ChevronDown, Plus, Check, Crown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface Avatar {
  id: string;
  name: string;
}

interface PlanInfo {
  currentCount: number;
  maxAllowed: number;
  canCreate: boolean;
}

interface SimpleAvatarSelectorProps {
  selectedAvatarId: string | null;
  onSelectAvatar: (avatarId: string) => void;
  onAddNew?: () => void;
  planInfo?: PlanInfo;
}

export const SimpleAvatarSelector: React.FC<SimpleAvatarSelectorProps> = ({
  selectedAvatarId,
  onSelectAvatar,
  onAddNew,
  planInfo
}) => {
  const { user } = useAuth();

  // Fetch user's avatars
  const { data: avatars = [], isLoading } = useQuery({
    queryKey: ['simple-avatars', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('avatars')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('status', 'active') // Only show active chatbots (matches RLS policy)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const selectedAvatar = avatars.find((avatar: Avatar) => avatar.id === selectedAvatarId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Bot className="h-4 w-4" />
          <span className="max-w-[150px] truncate">
            {selectedAvatar ? selectedAvatar.name : 'Select Chatbot'}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {isLoading ? (
          <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
        ) : avatars.length === 0 ? (
          <DropdownMenuItem disabled className="text-muted-foreground">
            No chatbots yet
          </DropdownMenuItem>
        ) : (
          avatars.map((avatar: Avatar) => (
            <DropdownMenuItem
              key={avatar.id}
              onClick={() => onSelectAvatar(avatar.id)}
              className="gap-2"
            >
              <Bot className="h-4 w-4" />
              <span className="flex-1 truncate">{avatar.name}</span>
              {avatar.id === selectedAvatarId && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))
        )}

        {onAddNew && (
          <>
            <DropdownMenuSeparator />
            {planInfo && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {planInfo.maxAllowed === -1
                  ? `${planInfo.currentCount} chatbots`
                  : `${planInfo.currentCount}/${planInfo.maxAllowed} chatbots`}
              </div>
            )}
            <DropdownMenuItem
              onClick={onAddNew}
              className="gap-2"
            >
              {planInfo && !planInfo.canCreate ? (
                <>
                  <Crown className="h-4 w-4 text-amber-500" />
                  <span>Upgrade to Add More</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>New Chatbot</span>
                </>
              )}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
