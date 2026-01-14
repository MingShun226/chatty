import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CachedContact {
  id: string;
  chatbot_id: string;
  phone_number: string;
  contact_name: string | null;
  tags: string[];
  primary_tag: string | null;
  ai_sentiment: string | null;
  ai_summary: string | null;
  ai_analysis: any;
  last_message_at: string | null;
  followup_due_at: string | null;
  followup_count: number;
  message_count: number;
  ai_paused: boolean;
  ai_paused_at: string | null;
  ai_paused_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface ContactsCacheContextType {
  contacts: Record<string, CachedContact[]>; // keyed by chatbot_id
  isLoading: Record<string, boolean>;
  lastFetched: Record<string, number>;
  fetchContacts: (chatbotId: string, force?: boolean) => Promise<CachedContact[]>;
  invalidateCache: (chatbotId: string) => void;
  prefetchContacts: (chatbotId: string) => void;
}

const ContactsCacheContext = createContext<ContactsCacheContextType | null>(null);

const CACHE_TTL = 60 * 1000; // 1 minute cache TTL
const PREFETCH_INTERVAL = 60 * 1000; // Prefetch every 1 minute

export const ContactsCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Record<string, CachedContact[]>>({});
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [lastFetched, setLastFetched] = useState<Record<string, number>>({});
  const prefetchIntervalRef = useRef<Record<string, NodeJS.Timeout>>({});
  const activeChatbotRef = useRef<string | null>(null);

  const fetchContacts = useCallback(async (chatbotId: string, force = false): Promise<CachedContact[]> => {
    const now = Date.now();
    const lastFetch = lastFetched[chatbotId] || 0;

    // Return cached data if still fresh and not forced
    if (!force && contacts[chatbotId] && now - lastFetch < CACHE_TTL) {
      return contacts[chatbotId];
    }

    // If already loading, wait for existing request
    if (isLoading[chatbotId]) {
      // Wait a bit and return existing data
      await new Promise(resolve => setTimeout(resolve, 100));
      return contacts[chatbotId] || [];
    }

    setIsLoading(prev => ({ ...prev, [chatbotId]: true }));

    try {
      const { data, error } = await supabase
        .from('contact_profiles')
        .select('*')
        .eq('chatbot_id', chatbotId)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      const fetchedContacts = (data || []) as CachedContact[];

      setContacts(prev => ({ ...prev, [chatbotId]: fetchedContacts }));
      setLastFetched(prev => ({ ...prev, [chatbotId]: Date.now() }));

      return fetchedContacts;
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return contacts[chatbotId] || [];
    } finally {
      setIsLoading(prev => ({ ...prev, [chatbotId]: false }));
    }
  }, [contacts, lastFetched, isLoading]);

  const invalidateCache = useCallback((chatbotId: string) => {
    setLastFetched(prev => ({ ...prev, [chatbotId]: 0 }));
  }, []);

  const prefetchContacts = useCallback((chatbotId: string) => {
    activeChatbotRef.current = chatbotId;

    // Clear existing interval for this chatbot
    if (prefetchIntervalRef.current[chatbotId]) {
      clearInterval(prefetchIntervalRef.current[chatbotId]);
    }

    // Initial fetch
    fetchContacts(chatbotId);

    // Set up periodic prefetch
    prefetchIntervalRef.current[chatbotId] = setInterval(() => {
      if (activeChatbotRef.current === chatbotId) {
        fetchContacts(chatbotId, true); // Force refresh
      }
    }, PREFETCH_INTERVAL);
  }, [fetchContacts]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(prefetchIntervalRef.current).forEach(interval => {
        clearInterval(interval);
      });
    };
  }, []);

  // Clear cache when user changes
  useEffect(() => {
    if (!user) {
      setContacts({});
      setLastFetched({});
      Object.values(prefetchIntervalRef.current).forEach(interval => {
        clearInterval(interval);
      });
      prefetchIntervalRef.current = {};
    }
  }, [user]);

  return (
    <ContactsCacheContext.Provider
      value={{
        contacts,
        isLoading,
        lastFetched,
        fetchContacts,
        invalidateCache,
        prefetchContacts
      }}
    >
      {children}
    </ContactsCacheContext.Provider>
  );
};

export const useContactsCache = () => {
  const context = useContext(ContactsCacheContext);
  if (!context) {
    throw new Error('useContactsCache must be used within a ContactsCacheProvider');
  }
  return context;
};

export default ContactsCacheContext;
