import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Tag,
  History,
  Settings,
  Send,
  Clock,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  MessageSquare,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Filter,
  Search
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ContactProfile,
  FollowupTag,
  FollowupSettings,
  FollowupHistoryItem,
  FollowupStats,
  getContacts,
  getTags,
  getSettings,
  upsertSettings,
  getHistory,
  getStats,
  createTag,
  updateTag,
  deleteTag,
  updateContact,
  initializeDefaultTags,
  sendFollowUpByTag,
  sendFollowUpToContacts,
  formatTimeAgo,
  getSentimentColor,
  DEFAULT_TAG_COLORS
} from '@/services/followupService';

interface Avatar {
  id: string;
  name: string;
}

interface WhatsAppSession {
  session_id: string;
  status: string;
}

const FollowUpsSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // State
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('');
  const [activeSession, setActiveSession] = useState<WhatsAppSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Data state
  const [contacts, setContacts] = useState<ContactProfile[]>([]);
  const [tags, setTags] = useState<FollowupTag[]>([]);
  const [settings, setSettings] = useState<FollowupSettings | null>(null);
  const [history, setHistory] = useState<FollowupHistoryItem[]>([]);
  const [stats, setStats] = useState<FollowupStats | null>(null);

  // Filters
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected contacts for bulk actions
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  // Dialogs
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<FollowupTag | null>(null);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Contact detail dialog
  const [selectedContact, setSelectedContact] = useState<ContactProfile | null>(null);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContactName, setEditingContactName] = useState('');
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Tag form state
  const [tagForm, setTagForm] = useState({
    tag_name: '',
    description: '',
    color: '#6b7280',
    auto_followup: false,
    followup_delay_hours: 24,
    followup_template: ''
  });

  // Load avatars on mount
  useEffect(() => {
    if (user) {
      loadAvatars();
    }
  }, [user]);

  // Load data when avatar changes
  useEffect(() => {
    if (selectedAvatarId) {
      loadData();
    }
  }, [selectedAvatarId]);

  const loadAvatars = async () => {
    try {
      const { data, error } = await supabase
        .from('avatars')
        .select('id, name')
        .eq('user_id', user?.id)
        .is('deleted_at', null) // Exclude soft-deleted chatbots
        .order('name');

      if (error) throw error;
      setAvatars(data || []);

      if (data && data.length > 0) {
        // Check if there's a previously selected chatbot in localStorage
        const savedChatbotId = localStorage.getItem('chatbot_selected_id');

        // Use saved chatbot if it exists and is in the list, otherwise use first chatbot
        if (savedChatbotId && data.some(a => a.id === savedChatbotId)) {
          setSelectedAvatarId(savedChatbotId);
        } else {
          setSelectedAvatarId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading avatars:', error);
    }
  };

  const loadData = async () => {
    if (!selectedAvatarId) return;

    setIsLoading(true);
    try {
      // Try to load session (table may not exist yet)
      let sessionData = null;
      try {
        const { data, error } = await supabase
          .from('whatsapp_web_sessions')
          .select('session_id, status')
          .eq('chatbot_id', selectedAvatarId)
          .eq('status', 'connected')
          .maybeSingle(); // Use maybeSingle() to avoid 406 error when no rows found

        if (!error && data) {
          sessionData = data;
        }
      } catch {
        // Table might not exist, continue without session
        console.log('WhatsApp sessions table not available');
      }

      setActiveSession(sessionData);

      // Load all data in parallel (with error handling for tables that may not exist)
      const [contactsResult, tagsResult, settingsResult, historyResult, statsResult] = await Promise.allSettled([
        getContacts(selectedAvatarId, { limit: 100 }),
        getTags(selectedAvatarId),
        getSettings(selectedAvatarId),
        getHistory(selectedAvatarId, { limit: 50 }),
        getStats(selectedAvatarId)
      ]);

      // Extract data from settled promises, defaulting to empty/null if failed
      const contactsData = contactsResult.status === 'fulfilled' ? contactsResult.value : [];
      const tagsData = tagsResult.status === 'fulfilled' ? tagsResult.value : [];
      const settingsData = settingsResult.status === 'fulfilled' ? settingsResult.value : null;
      const historyData = historyResult.status === 'fulfilled' ? historyResult.value : [];
      const statsData = statsResult.status === 'fulfilled' ? statsResult.value : null;

      setContacts(contactsData);
      setTags(tagsData);
      setSettings(settingsData);
      setHistory(historyData);
      setStats(statsData);

      // Initialize default tags if none exist (only if tables are available)
      if (tagsData.length === 0 && user && tagsResult.status === 'fulfilled') {
        try {
          await initializeDefaultTags(selectedAvatarId, user.id);
          const newTags = await getTags(selectedAvatarId);
          setTags(newTags);
        } catch {
          console.log('Could not initialize tags - tables may not exist');
        }
      }

      // Show warning if tables don't exist
      if (contactsResult.status === 'rejected' || tagsResult.status === 'rejected') {
        toast({
          title: 'Setup Required',
          description: 'Follow-up tables not found. Please run the database migration.',
          variant: 'default'
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load follow-up data. Tables may need to be created.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesTag = selectedTagFilter === 'all' || contact.tags.includes(selectedTagFilter);
    const matchesSearch = searchQuery === '' ||
      contact.phone_number.includes(searchQuery) ||
      contact.contact_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTag && matchesSearch;
  });

  // Handle settings change
  const handleSettingsChange = async (key: keyof FollowupSettings, value: unknown) => {
    if (!selectedAvatarId || !user) return;

    try {
      const newSettings = await upsertSettings(selectedAvatarId, user.id, {
        ...settings,
        [key]: value
      });
      setSettings(newSettings);
      toast({ title: 'Settings saved' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive'
      });
    }
  };

  // Handle tag create/update
  const handleSaveTag = async () => {
    if (!selectedAvatarId || !user || !tagForm.tag_name) return;

    try {
      if (editingTag) {
        await updateTag(editingTag.id, tagForm);
        toast({ title: 'Tag updated' });
      } else {
        await createTag(selectedAvatarId, user.id, tagForm);
        toast({ title: 'Tag created' });
      }

      const newTags = await getTags(selectedAvatarId);
      setTags(newTags);
      setIsTagDialogOpen(false);
      resetTagForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save tag',
        variant: 'destructive'
      });
    }
  };

  // Handle tag delete
  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Are you sure you want to delete this tag?')) return;

    try {
      await deleteTag(tagId);
      const newTags = await getTags(selectedAvatarId);
      setTags(newTags);
      toast({ title: 'Tag deleted' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete tag',
        variant: 'destructive'
      });
    }
  };

  // Reset tag form
  const resetTagForm = () => {
    setTagForm({
      tag_name: '',
      description: '',
      color: '#6b7280',
      auto_followup: false,
      followup_delay_hours: 24,
      followup_template: ''
    });
    setEditingTag(null);
  };

  // Open edit tag dialog
  const openEditTag = (tag: FollowupTag) => {
    setEditingTag(tag);
    setTagForm({
      tag_name: tag.tag_name,
      description: tag.description || '',
      color: tag.color,
      auto_followup: tag.auto_followup,
      followup_delay_hours: tag.followup_delay_hours,
      followup_template: tag.followup_template || ''
    });
    setIsTagDialogOpen(true);
  };

  // Handle send follow-up
  const handleSendFollowUp = async () => {
    if (!activeSession || !selectedAvatarId) {
      toast({
        title: 'Error',
        description: 'No active WhatsApp session',
        variant: 'destructive'
      });
      return;
    }

    setIsSending(true);
    try {
      let result;
      if (selectedContacts.size > 0) {
        result = await sendFollowUpToContacts(
          selectedAvatarId,
          activeSession.session_id,
          Array.from(selectedContacts),
          customMessage || undefined,
          user?.id
        );
      } else if (selectedTagFilter !== 'all') {
        result = await sendFollowUpByTag(
          selectedAvatarId,
          activeSession.session_id,
          selectedTagFilter,
          customMessage || undefined,
          user?.id
        );
      } else {
        toast({
          title: 'Error',
          description: 'Please select contacts or filter by tag',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Follow-ups sent',
        description: `Sent: ${result.sent}, Failed: ${result.failed}`
      });

      setIsSendDialogOpen(false);
      setCustomMessage('');
      setSelectedContacts(new Set());
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send follow-ups',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  // Toggle contact selection
  const toggleContactSelection = (contactId: string) => {
    const newSelection = new Set(selectedContacts);
    if (newSelection.has(contactId)) {
      newSelection.delete(contactId);
    } else {
      newSelection.add(contactId);
    }
    setSelectedContacts(newSelection);
  };

  // Select all filtered contacts
  const selectAllContacts = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  // Open contact detail dialog
  const openContactDetail = (contact: ContactProfile) => {
    setSelectedContact(contact);
    setEditingContactName(contact.contact_name || '');
    setIsContactDialogOpen(true);
  };

  // Save contact name
  const handleSaveContactName = async () => {
    if (!selectedContact) return;

    setIsSavingContact(true);
    try {
      await updateContact(selectedContact.id, { contact_name: editingContactName || null });

      // Update local state
      setContacts(contacts.map(c =>
        c.id === selectedContact.id
          ? { ...c, contact_name: editingContactName || null }
          : c
      ));
      setSelectedContact({ ...selectedContact, contact_name: editingContactName || null });

      toast({ title: 'Contact name saved' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save contact name',
        variant: 'destructive'
      });
    } finally {
      setIsSavingContact(false);
    }
  };

  if (!user) {
    return <div className="p-4">Please log in to access follow-ups.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Follow-Ups</h2>
          <p className="text-muted-foreground">
            AI-powered contact tagging and automatic follow-up system
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Select value={selectedAvatarId} onValueChange={(value) => {
            setSelectedAvatarId(value);
            localStorage.setItem('chatbot_selected_id', value);
          }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select chatbot" />
            </SelectTrigger>
            <SelectContent>
              {avatars.map(avatar => (
                <SelectItem key={avatar.id} value={avatar.id}>
                  {avatar.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Contacts</p>
                  <p className="text-2xl font-bold">{stats.totalContacts}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Follow-ups</p>
                  <p className="text-2xl font-bold">{stats.pendingFollowups}</p>
                </div>
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sent (24h)</p>
                  <p className="text-2xl font-bold">{stats.sentLast24h}</p>
                </div>
                <Send className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Tags</p>
                  <p className="text-2xl font-bold">{tags.length}</p>
                </div>
                <Tag className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Session Status */}
      {!activeSession && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No active WhatsApp session. Connect WhatsApp in the chatbot settings to send follow-ups.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="contacts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Tags
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Contacts</CardTitle>
                  <CardDescription>
                    AI-tagged contacts from conversation history
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-[200px]"
                    />
                  </div>

                  <Select value={selectedTagFilter} onValueChange={setSelectedTagFilter}>
                    <SelectTrigger className="w-[150px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filter by tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tags</SelectItem>
                      {tags.map(tag => (
                        <SelectItem key={tag.id} value={tag.tag_name}>
                          {tag.tag_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(selectedContacts.size > 0 || selectedTagFilter !== 'all') && activeSession && (
                    <Button onClick={() => setIsSendDialogOpen(true)}>
                      <Send className="w-4 h-4 mr-2" />
                      Send Follow-up ({selectedContacts.size || filteredContacts.length})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No contacts found. Contacts will appear here after conversations with your chatbot.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <input
                          type="checkbox"
                          checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                          onChange={selectAllContacts}
                          className="w-4 h-4"
                        />
                      </TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Sentiment</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>Last Message</TableHead>
                      <TableHead>Follow-up Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map(contact => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedContacts.has(contact.id)}
                            onChange={() => toggleContactSelection(contact.id)}
                            className="w-4 h-4"
                          />
                        </TableCell>
                        <TableCell>
                          <div
                            className="cursor-pointer hover:bg-muted/50 rounded p-1 -m-1"
                            onClick={() => openContactDetail(contact)}
                          >
                            <div className="font-medium flex items-center gap-1">
                              {contact.contact_name || 'Unknown'}
                              <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                            </div>
                            <div className="text-sm text-muted-foreground">{contact.phone_number}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {contact.tags.map(tagName => {
                              const tagConfig = tags.find(t => t.tag_name === tagName);
                              return (
                                <Badge
                                  key={tagName}
                                  variant="outline"
                                  style={{
                                    borderColor: tagConfig?.color || DEFAULT_TAG_COLORS[tagName] || '#6b7280',
                                    color: tagConfig?.color || DEFAULT_TAG_COLORS[tagName] || '#6b7280'
                                  }}
                                >
                                  {tagName}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getSentimentColor(contact.ai_sentiment)}>
                            {contact.ai_sentiment || 'unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p
                            className="text-sm truncate cursor-pointer hover:text-primary"
                            onClick={() => openContactDetail(contact)}
                            title="Click to view full summary"
                          >
                            {contact.ai_summary || '-'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatTimeAgo(contact.last_message_at)}</div>
                        </TableCell>
                        <TableCell>
                          {contact.followup_due_at ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-600">
                              <Clock className="w-3 h-3 mr-1" />
                              Due {formatTimeAgo(contact.followup_due_at)}
                            </Badge>
                          ) : contact.last_followup_at ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Sent {formatTimeAgo(contact.last_followup_at)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tags Tab */}
        <TabsContent value="tags">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tag Management</CardTitle>
                  <CardDescription>
                    Configure AI tags and auto-followup rules
                  </CardDescription>
                </div>
                <Button onClick={() => { resetTagForm(); setIsTagDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tag
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Auto Follow-up</TableHead>
                    <TableHead>Delay</TableHead>
                    <TableHead>Contacts</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map(tag => {
                    const contactCount = stats?.byTag.find(t => t.tag_name === tag.tag_name)?.contact_count || 0;
                    return (
                      <TableRow key={tag.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="font-medium">{tag.tag_name}</span>
                            {tag.is_system && (
                              <Badge variant="secondary" className="text-xs">System</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="text-sm truncate">{tag.description || '-'}</p>
                        </TableCell>
                        <TableCell>
                          {tag.auto_followup ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Enabled
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500">
                              Disabled
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {tag.auto_followup ? `${tag.followup_delay_hours}h` : '-'}
                        </TableCell>
                        <TableCell>{contactCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditTag(tag)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            {!tag.is_system && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTag(tag.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Follow-up History</CardTitle>
              <CardDescription>
                Record of all sent follow-ups
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No follow-ups sent yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Response</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">
                            {item.contact?.contact_name || item.contact?.phone_number || 'Unknown'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.trigger_type === 'auto' ? 'secondary' : 'outline'}>
                            {item.trigger_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.trigger_tag || '-'}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <p className="text-sm truncate">{item.message_sent}</p>
                        </TableCell>
                        <TableCell>{formatTimeAgo(item.sent_at)}</TableCell>
                        <TableCell>
                          {item.response_received ? (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Replied
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">Pending</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Follow-up Settings</CardTitle>
              <CardDescription>
                Configure automatic tagging and follow-up behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Tagging</Label>
                  <p className="text-sm text-muted-foreground">
                    AI automatically analyzes conversations and assigns tags
                  </p>
                </div>
                <Switch
                  checked={settings?.auto_tagging_enabled ?? true}
                  onCheckedChange={(checked) => handleSettingsChange('auto_tagging_enabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Follow-ups</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically send follow-ups based on tag rules
                  </p>
                </div>
                <Switch
                  checked={settings?.auto_followup_enabled ?? true}
                  onCheckedChange={(checked) => handleSettingsChange('auto_followup_enabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Business Hours Only</Label>
                  <p className="text-sm text-muted-foreground">
                    Only send follow-ups during business hours
                  </p>
                </div>
                <Switch
                  checked={settings?.business_hours_only ?? true}
                  onCheckedChange={(checked) => handleSettingsChange('business_hours_only', checked)}
                />
              </div>

              {settings?.business_hours_only && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Hour</Label>
                    <Select
                      value={String(settings?.start_hour ?? 9)}
                      onValueChange={(v) => handleSettingsChange('start_hour', parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {i.toString().padStart(2, '0')}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>End Hour</Label>
                    <Select
                      value={String(settings?.end_hour ?? 21)}
                      onValueChange={(v) => handleSettingsChange('end_hour', parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {i.toString().padStart(2, '0')}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Max Follow-ups Per Contact</Label>
                <p className="text-sm text-muted-foreground">
                  Maximum number of auto follow-ups before requiring manual intervention
                </p>
                <Select
                  value={String(settings?.max_followups_per_contact ?? 3)}
                  onValueChange={(v) => handleSettingsChange('max_followups_per_contact', parseInt(v))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tag Dialog */}
      <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
            <DialogDescription>
              Configure tag properties and auto-followup rules
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tag Name</Label>
              <Input
                value={tagForm.tag_name}
                onChange={(e) => setTagForm({ ...tagForm, tag_name: e.target.value })}
                placeholder="e.g., vip_customer"
                disabled={editingTag?.is_system}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={tagForm.description}
                onChange={(e) => setTagForm({ ...tagForm, description: e.target.value })}
                placeholder="Brief description..."
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tagForm.color}
                  onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  value={tagForm.color}
                  onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                  className="w-[100px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Auto Follow-up</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically send follow-up for this tag
                </p>
              </div>
              <Switch
                checked={tagForm.auto_followup}
                onCheckedChange={(checked) => setTagForm({ ...tagForm, auto_followup: checked })}
              />
            </div>

            {tagForm.auto_followup && (
              <>
                <div className="space-y-2">
                  <Label>Delay (hours)</Label>
                  <Input
                    type="number"
                    value={tagForm.followup_delay_hours}
                    onChange={(e) => setTagForm({ ...tagForm, followup_delay_hours: parseInt(e.target.value) || 24 })}
                    min={1}
                    max={168}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Follow-up Template (optional)</Label>
                  <Textarea
                    value={tagForm.followup_template}
                    onChange={(e) => setTagForm({ ...tagForm, followup_template: e.target.value })}
                    placeholder="Leave empty for AI-generated message..."
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTagDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTag} disabled={!tagForm.tag_name}>
              {editingTag ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Follow-up Dialog */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Follow-up</DialogTitle>
            <DialogDescription>
              {selectedContacts.size > 0
                ? `Send to ${selectedContacts.size} selected contact(s)`
                : `Send to all contacts with tag "${selectedTagFilter}" (${filteredContacts.length})`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Custom Message (optional)</Label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Leave empty to use AI-generated contextual message..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                If left empty, AI will generate a personalized message based on each contact's conversation history.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendFollowUp} disabled={isSending}>
              {isSending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Follow-ups
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Detail Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
            <DialogDescription>
              View and edit contact information
            </DialogDescription>
          </DialogHeader>

          {selectedContact && (
            <div className="space-y-4">
              {/* Editable Contact Name */}
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingContactName}
                    onChange={(e) => setEditingContactName(e.target.value)}
                    placeholder="Enter contact name..."
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSaveContactName}
                    disabled={isSavingContact || editingContactName === (selectedContact.contact_name || '')}
                    size="sm"
                  >
                    {isSavingContact ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      'Save'
                    )}
                  </Button>
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <div className="text-sm bg-muted px-3 py-2 rounded">
                  {selectedContact.phone_number}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1">
                  {selectedContact.tags.length > 0 ? (
                    selectedContact.tags.map(tagName => {
                      const tagConfig = tags.find(t => t.tag_name === tagName);
                      return (
                        <Badge
                          key={tagName}
                          variant="outline"
                          style={{
                            borderColor: tagConfig?.color || DEFAULT_TAG_COLORS[tagName] || '#6b7280',
                            color: tagConfig?.color || DEFAULT_TAG_COLORS[tagName] || '#6b7280'
                          }}
                        >
                          {tagName}
                        </Badge>
                      );
                    })
                  ) : (
                    <span className="text-sm text-muted-foreground">No tags</span>
                  )}
                </div>
              </div>

              {/* Sentiment */}
              <div className="space-y-2">
                <Label>Sentiment</Label>
                <Badge className={getSentimentColor(selectedContact.ai_sentiment)}>
                  {selectedContact.ai_sentiment || 'unknown'}
                </Badge>
              </div>

              {/* Full Summary */}
              <div className="space-y-2">
                <Label>AI Summary</Label>
                <div className="text-sm bg-muted px-3 py-2 rounded whitespace-pre-wrap">
                  {selectedContact.ai_summary || 'No summary available'}
                </div>
              </div>

              {/* Message Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Messages</Label>
                  <div className="text-sm font-medium">{selectedContact.message_count || 0}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Follow-ups Sent</Label>
                  <div className="text-sm font-medium">{selectedContact.followup_count || 0}</div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Last Message</Label>
                  <div>{formatTimeAgo(selectedContact.last_message_at)}</div>
                </div>
                {selectedContact.followup_due_at && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Follow-up Due</Label>
                    <div className="text-amber-600">{formatTimeAgo(selectedContact.followup_due_at)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContactDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FollowUpsSection;
