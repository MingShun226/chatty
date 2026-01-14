
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  MessageCircle,
  Sparkles,
  Settings,
  LogOut,
  Bot,
  Menu,
  X,
  CreditCard,
  Key,
  ShieldCheck,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  Image,
  Film,
  SettingsIcon,
  ShoppingBag,
  BookOpen,
  TestTube,
  Zap,
  Wand2,
  Tag,
  UserPlus
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
}

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    id: 'chatbot',
    label: 'WhatsApp Chatbot',
    icon: MessageCircle,
    children: [
      { id: 'chatbot-overview', label: 'Overview', icon: LayoutDashboard, path: '/chatbot/overview' },
      { id: 'chatbot-content', label: 'Content', icon: ShoppingBag, path: '/chatbot/content' },
      { id: 'chatbot-ai-studio', label: 'AI Studio', icon: Wand2, path: '/chatbot/ai-studio' },
      { id: 'chatbot-whatsapp', label: 'WhatsApp', icon: MessageCircle, path: '/chatbot/whatsapp' },
      { id: 'chatbot-contacts', label: 'Contacts', icon: UserPlus, path: '/chatbot/contacts' },
    ]
  },
  {
    id: 'advertising',
    label: 'Advertising',
    icon: Sparkles,
    children: [
      { id: 'images', label: 'Product Images', icon: Image, path: '/images-studio' },
      { id: 'videos', label: 'Promo Videos', icon: Film, path: '/video-studio' },
    ]
  },
  { id: 'api-keys', label: 'API Keys', icon: Key, path: '/api-keys' },
  { id: 'billing', label: 'Billing & Plans', icon: CreditCard, path: '/billing' },
];

const Sidebar = ({ activeSection, onSectionChange, onLogout }: SidebarProps) => {
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['chatbot', 'advertising']);
  const { isAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobile = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleNavigation = (item: any) => {
    setIsMobileOpen(false);

    if (item.path) {
      // Use React Router for all navigation
      navigate(item.path);
      // Also update section for backward compatibility
      onSectionChange(item.id);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-3 left-3 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMobile}
          className="bg-white shadow-lg"
        >
          {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={`
          ${isCollapsed ? 'w-16' : 'w-56'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border
          flex flex-col transition-all duration-300 z-50 cursor-pointer
        `}
        onClick={(e) => {
          // Only toggle if clicking on empty space (the sidebar container itself)
          if (e.target === e.currentTarget) {
            toggleCollapse();
          }
        }}
      >
        {/* Header */}
        <div
          className="p-4 border-b border-sidebar-border"
          onClick={(e) => {
            // Toggle if clicking on header empty space
            if (e.target === e.currentTarget) {
              toggleCollapse();
            }
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-sidebar-primary rounded-md flex items-center justify-center flex-shrink-0">
              <Bot className="w-3 h-3 text-sidebar-primary-foreground" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="text-sm font-bold text-sidebar-foreground truncate">Chatty</h1>
                <p className="text-xs text-sidebar-foreground/60 truncate">AI Business Chatbots</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 p-3"
          onClick={(e) => {
            // Toggle if clicking on nav empty space
            if (e.target === e.currentTarget || e.target.closest('.nav-empty-space')) {
              toggleCollapse();
            }
          }}
        >
          <div className="space-y-1">
            {navigationItems.map((item: any) => {
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedSections.includes(item.id);

              // For items with children, check if any child is active
              const isActive = hasChildren
                ? item.children.some((child: any) => location.pathname === child.path)
                : item.path === '/dashboard'
                  ? activeSection === item.id
                  : location.pathname === item.path;

              return (
                <div key={item.id}>
                  {/* Parent Item */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasChildren) {
                        toggleSection(item.id);
                      } else {
                        handleNavigation(item);
                      }
                    }}
                    className={`
                      nav-item w-full text-sm relative group
                      ${isActive ? 'nav-item-active' : ''}
                      ${isCollapsed ? 'justify-center px-2' : ''}
                    `}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {hasChildren && (
                          isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                        )}
                      </>
                    )}

                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded
                                    opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none
                                    whitespace-nowrap z-50 hidden md:block">
                        {item.label}
                      </div>
                    )}
                  </button>

                  {/* Child Items */}
                  {hasChildren && isExpanded && !isCollapsed && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child: any) => {
                        const ChildIcon = child.icon;
                        const isChildActive = location.pathname === child.path;

                        return (
                          <button
                            key={child.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNavigation(child);
                            }}
                            className={`
                              nav-item w-full text-sm relative group
                              ${isChildActive ? 'nav-item-active' : ''}
                            `}
                          >
                            <ChildIcon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div
          className="p-3 border-t border-sidebar-border space-y-1"
          onClick={(e) => {
            // Toggle if clicking on footer empty space
            if (e.target === e.currentTarget) {
              toggleCollapse();
            }
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent sidebar toggle
              navigate('/settings');
              setIsMobileOpen(false);
            }}
            className={`
              nav-item w-full text-sm relative group
              ${location.pathname === '/settings' ? 'nav-item-active' : ''}
              ${isCollapsed ? 'justify-center px-2' : ''}
            `}
            title={isCollapsed ? 'Settings' : undefined}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span className="truncate">Settings</span>}

            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded
                            opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none
                            whitespace-nowrap z-50 hidden md:block">
                Settings
              </div>
            )}
          </button>

          {/* Admin Panel Switch */}
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate('/admin');
                setIsMobileOpen(false);
              }}
              className={`
                nav-item w-full text-sm relative group
                ${location.pathname.startsWith('/admin') ? 'nav-item-active' : ''}
                ${isCollapsed ? 'justify-center px-2' : ''}
              `}
              title={isCollapsed ? 'Admin Panel' : undefined}
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && (
                <div className="flex items-center justify-between flex-1">
                  <span className="truncate">Admin Panel</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    <ArrowRightLeft className="h-2 w-2" />
                  </Badge>
                </div>
              )}

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded
                              opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none
                              whitespace-nowrap z-50 hidden md:block">
                  Switch to Admin Panel
                </div>
              )}
            </button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className={`
              w-full text-destructive hover:text-destructive hover:bg-destructive/10
              ${isCollapsed ? 'justify-center px-2' : 'justify-start'}
            `}
            onClick={(e) => {
              e.stopPropagation(); // Prevent sidebar toggle
              onLogout();
            }}
            title={isCollapsed ? 'Logout' : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span className="ml-2 truncate">Logout</span>}
          </Button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
