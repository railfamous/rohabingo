"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, ElementType } from 'react';
import { getDashboardStats, type DashboardStats } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Inbox,
  FileQuestion,
  Workflow,
  MessageSquareQuote,
  Megaphone,
  Radio,
  Users,
  LucideIcon
} from 'lucide-react';

import { CSSProperties } from 'react';

// Navigation item type
type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  showCount?: string;
  permission?: string;
};

// Navigation items for sidebar
const navItems: NavItem[] = [
  // Main dashboard and user items
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Users', href: '/dashboard/users', icon: Users, showCount: 'active' },

  // Primary communication & flow items
  { name: 'Inbox', href: '/dashboard/inbox', icon: Inbox },
  { name: 'Support Tickets', href: '/dashboard/user-requests', icon: FileQuestion, showCount: 'pending' },
  { name: 'Flows', href: '/dashboard/flows', icon: Workflow },

  // Settings entry
  { name: 'Welcome Messages', href: '/dashboard/settings', icon: MessageSquareQuote },
  { name: 'Broadcast', href: '/dashboard/broadcast', icon: Megaphone },
  { name: 'Group/Channel', href: '/dashboard/moderation', icon: Radio },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const { hasPermission, isSuperAdmin, logout } = useAuth();

  // Draggable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState<number>(240); // Default width in pixels, reduced from 400
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  // Load saved sidebar width from localStorage
  useEffect(() => {
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
      const width = parseInt(savedWidth);
      if (width >= 200 && width <= 400) { // Bounds check
        setSidebarWidth(width);
      }
    }
  }, []);

  // Save sidebar width to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarWidth', sidebarWidth.toString());
  }, [sidebarWidth]);

  // Mouse move handler for resizing
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 400) { // Min: 200px, Max: 400px
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  // Mouse up handler to stop resizing
  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);

  // Add/remove event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Start resizing
  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  // Scrollbar custom styling
  const scrollbarStyles: CSSProperties = {
    '--scrollbar-track': '#2d3748',
    '--scrollbar-thumb': '#4a5568',
    '--scrollbar-thumb-hover': '#3182ce',
  } as CSSProperties;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const dashboardStats = await getDashboardStats();
        console.log('Dashboard stats fetched:', dashboardStats); // Debug log
        setStats(dashboardStats);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    };

    fetchStats();

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    return () => clearInterval(interval);
  }, []);

  const getCountForItem = (href: string, countType: string): number | null => {
    if (!stats) return null;

    switch (href) {

      case '/dashboard/users':
        return countType === 'active' ? stats.users?.active || 0 : null;
      default:
        return null;
    }
  };

  const getBadgeColor = (countType: string): string => {
    switch (countType) {
      case 'pending':
        return 'bg-red-500/20 text-red-300 border border-red-500/30';
      case 'active':
        return 'bg-green-500/20 text-green-300 border border-green-500/30';
      case 'total':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      case 'approved':
        return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border border-gray-500/30';
    }
  };

  return (
    <aside
      ref={sidebarRef}
      className="fixed inset-y-0 left-0 bg-gray-800 p-4 hidden md:block overflow-hidden select-none antialiased"
      style={{ width: `${sidebarWidth}px` }}
    >
      <div className="flex flex-col h-full" style={scrollbarStyles}>
        <div className="mb-8 pl-2">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" /></svg>
            </span>
            Dashbot
          </h1>
          <p className="!text-white/50 text-xs ml-10 mt-1 font-medium">Admin Control Center</p>
        </div>

        <nav className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <ul className="space-y-1 ">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const count = item.showCount ? getCountForItem(item.href, item.showCount) : null;
              const Icon = item.icon;

              // Skip items that require permissions the user doesn't have
              if (item.permission && !hasPermission(item.permission) && !isSuperAdmin) {
                return null;
              }

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center !text-white/70 justify-between px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 group ${isActive
                      ? 'bg-blue-600 text-white shadow-md font-medium'
                      : 'text-white/70 hover:bg-white/10 hover:text-white font-medium'
                      }`}
                  >
                    <div className="flex items-center">
                      <Icon className={`mr-3 w-5 h-5 ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white transition-colors'}`} />
                      <span>
                        {item.name}
                      </span>
                    </div>

                    {/* Count Badge */}
                    {count !== null && count > 0 && (
                      <span className={`${isActive ? 'bg-white/20 text-white' : item.showCount ? getBadgeColor(item.showCount) : 'bg-gray-700 text-gray-400'} text-xs font-semibold px-2 py-0.5 rounded-full min-w-[20px] text-center ml-2 border-0`}>
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

      </div>

      {/* Resize Handle */}
      <div
        ref={resizeHandleRef}
        className="absolute top-0 right-0 w-1 h-full bg-transparent hover:bg-blue-500 cursor-col-resize group transition-colors duration-200"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute top-0 right-0 w-1 h-full bg-gray-600 group-hover:bg-blue-500 transition-colors duration-200" />
        {/* Visual indicator for draggable area */}
        <div className="absolute top-1/2 -translate-y-1/2 right-0 w-3 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-0.5 h-6 bg-white rounded-full opacity-60" />
        </div>
      </div>
    </aside>
  );
}