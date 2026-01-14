import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '@/components/dashboard/Sidebar';
import ImagesSection from '@/components/dashboard/sections/ImagesSection';
import { FeatureGate } from '@/components/FeatureGate';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';

const ImagesStudio = () => {
  const [activeSection, setActiveSection] = useState('images');
  const { signOut } = useAuth();
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSectionChange = (section: string) => {
    if (section === 'dashboard') {
      navigate('/dashboard');
    } else {
      setActiveSection(section);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onLogout={handleLogout}
      />

      <main className={`${isCollapsed ? 'ml-16' : 'ml-56'} overflow-auto transition-all duration-300`}>
        <div className="p-6">
          <div className="max-w-6xl mx-auto">
            <FeatureGate featureKey="advertising.images_studio">
              <ImagesSection />
            </FeatureGate>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ImagesStudio;