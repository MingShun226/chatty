import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  BarChart3,
  FileText,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Settings,
  UserCog,
  Workflow,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminLayout = () => {
  const location = useLocation();
  const { adminUser } = useAdminAuth();
  const { user, signOut } = useAuth();
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const { settings: platformSettings } = usePlatformSettings();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobile = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const isSuperAdmin = adminUser?.role === 'super_admin';

  const navigation = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
      permission: null, // Always accessible
    },
    {
      name: 'Users',
      href: '/admin/users',
      icon: Users,
      permission: 'users',
    },
    {
      name: 'Tiers',
      href: '/admin/tiers',
      icon: CreditCard,
      permission: 'tiers',
    },
    {
      name: 'Statistics',
      href: '/admin/statistics',
      icon: BarChart3,
      permission: 'financial',
    },
    {
      name: 'Audit Logs',
      href: '/admin/audit-logs',
      icon: FileText,
      permission: 'settings',
    },
    {
      name: 'Workflows',
      href: '/admin/workflows',
      icon: Workflow,
      permission: 'settings',
    },
    {
      name: 'Fine-Tuning',
      href: '/admin/fine-tuning',
      icon: Sparkles,
      permission: 'settings',
    },
    // Super admin only
    ...(isSuperAdmin ? [{
      name: 'Admin Management',
      href: '/admin/admins',
      icon: UserCog,
      permission: null,
    }] : []),
  ];

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
      <aside
        className={cn(
          isCollapsed ? 'w-16' : 'w-56',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          'fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border',
          'flex flex-col transition-all duration-300 z-50 cursor-pointer'
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            toggleCollapse();
          }
        }}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div
            className="p-4 border-b border-sidebar-border"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                toggleCollapse();
              }
            }}
          >
            <div className="flex items-center gap-2">
              {platformSettings.logo_url ? (
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <img src={platformSettings.logo_url} alt="Logo" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-6 h-6 bg-sidebar-primary rounded-md flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-3 h-3 text-sidebar-primary-foreground" />
                </div>
              )}
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <h1 className="text-sm font-bold text-sidebar-foreground truncate">{platformSettings.platform_name} Admin</h1>
                  <p className="text-xs text-sidebar-foreground/60 truncate">Platform Management</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav
            className="flex-1 p-3"
            onClick={(e) => {
              if (e.target === e.currentTarget || e.target.closest('.nav-empty-space')) {
                toggleCollapse();
              }
            }}
          >
            <div className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMobileOpen(false);
                    }}
                    className={cn(
                      'nav-item w-full text-sm relative group',
                      isActive ? 'nav-item-active' : '',
                      isCollapsed ? 'justify-center px-2' : ''
                    )}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}

                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded
                                    opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none
                                    whitespace-nowrap z-50 hidden md:block">
                        {item.name}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div
            className="p-3 border-t border-sidebar-border space-y-1"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                toggleCollapse();
              }
            }}
          >
            {/* Settings */}
            <Link
              to="/admin/settings"
              onClick={(e) => {
                e.stopPropagation();
                setIsMobileOpen(false);
              }}
              className={cn(
                'nav-item w-full text-sm relative group',
                location.pathname === '/admin/settings' ? 'nav-item-active' : '',
                isCollapsed ? 'justify-center px-2' : ''
              )}
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
            </Link>

            {/* Logout */}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'w-full text-destructive hover:text-destructive hover:bg-destructive/10',
                isCollapsed ? 'justify-center px-2' : 'justify-start'
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
              title={isCollapsed ? 'Logout' : undefined}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span className="ml-2 truncate">Logout</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          isCollapsed ? 'md:pl-16' : 'md:pl-56'
        )}
      >
        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </>
  );
};
