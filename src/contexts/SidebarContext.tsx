import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  expandedSections: string[];
  toggleSection: (sectionId: string) => void;
  setExpandedSections: (sections: string[]) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// Get initial expanded sections from localStorage or default
const getInitialExpandedSections = (): string[] => {
  try {
    const stored = localStorage.getItem('sidebar-expanded-sections');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    // Ignore errors
  }
  return ['chatbot']; // Default: only chatbot expanded
};

export const SidebarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSectionsState] = useState<string[]>(getInitialExpandedSections);

  const setExpandedSections = useCallback((sections: string[]) => {
    setExpandedSectionsState(sections);
    try {
      localStorage.setItem('sidebar-expanded-sections', JSON.stringify(sections));
    } catch (e) {
      // Ignore errors
    }
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSectionsState(prev => {
      const newSections = prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId];
      try {
        localStorage.setItem('sidebar-expanded-sections', JSON.stringify(newSections));
      } catch (e) {
        // Ignore errors
      }
      return newSections;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{
      isCollapsed,
      setIsCollapsed,
      expandedSections,
      toggleSection,
      setExpandedSections
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};