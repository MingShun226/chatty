import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlatformSettings {
  platform_name: string;
  platform_description: string;
  logo_url: string;
  favicon_url: string;
  support_email: string;
  support_phone: string;
  support_whatsapp: string;
}

interface PlatformSettingsContextType {
  settings: PlatformSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: PlatformSettings = {
  platform_name: 'Chatty',
  platform_description: 'AI-powered chatbot platform',
  logo_url: '',
  favicon_url: '',
  support_email: '',
  support_phone: '',
  support_whatsapp: '',
};

const PlatformSettingsContext = createContext<PlatformSettingsContextType>({
  settings: defaultSettings,
  loading: true,
  refreshSettings: async () => {},
});

export const usePlatformSettings = () => useContext(PlatformSettingsContext);

interface PlatformSettingsProviderProps {
  children: ReactNode;
}

export const PlatformSettingsProvider = ({ children }: PlatformSettingsProviderProps) => {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'general')
        .maybeSingle();

      if (data?.setting_value) {
        setSettings({ ...defaultSettings, ...data.setting_value });
      }
    } catch (error) {
      console.error('Error fetching platform settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();

    // Update favicon when settings change
    const updateFavicon = () => {
      if (settings.favicon_url) {
        const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
        if (favicon) {
          favicon.href = settings.favicon_url;
        } else {
          const newFavicon = document.createElement('link');
          newFavicon.rel = 'icon';
          newFavicon.href = settings.favicon_url;
          document.head.appendChild(newFavicon);
        }
      }
    };

    updateFavicon();
  }, []);

  // Update document title and favicon when settings change
  useEffect(() => {
    if (settings.favicon_url) {
      const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (favicon) {
        favicon.href = settings.favicon_url;
      } else {
        const newFavicon = document.createElement('link');
        newFavicon.rel = 'icon';
        newFavicon.href = settings.favicon_url;
        document.head.appendChild(newFavicon);
      }
    }
  }, [settings.favicon_url]);

  const refreshSettings = async () => {
    setLoading(true);
    await fetchSettings();
  };

  return (
    <PlatformSettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </PlatformSettingsContext.Provider>
  );
};
