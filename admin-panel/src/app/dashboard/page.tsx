'use client';

import { useEffect, useState } from 'react';
import { getDashboardSummary, DashboardSummary } from '@/lib/api';
import Link from 'next/link';
import { Users, MessageSquare, Workflow, Megaphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchAll = () => {
      getDashboardSummary().then(data => {
        setSummary(data);
        setLoading(false);
      }).catch(() => setLoading(false));
    };

    fetchAll();
    interval = setInterval(fetchAll, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const stats = [
    {
      label: 'Total Users',
      value: summary?.totalUsers ?? '-',
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50/50',
      border: 'border-blue-100',
      href: '/dashboard/users'
    },
    {
      label: 'Unread Messages',
      value: summary?.unreadMessages ?? '-',
      icon: MessageSquare,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50/50',
      border: 'border-emerald-100',
      href: '/dashboard/inbox'
    },

    {
      label: 'Active Flows',
      value: summary?.activeFlows ?? '-',
      icon: Workflow,
      color: 'text-violet-600',
      bg: 'bg-violet-50/50',
      border: 'border-violet-100',
      href: '/dashboard/flows'
    },
    {
      label: 'Active Channels',
      value: summary?.activeChannels ?? '-',
      icon: Megaphone,
      color: 'text-rose-600',
      bg: 'bg-rose-50/50',
      border: 'border-rose-100',
      href: '/dashboard/channels'
    }
  ];

  const quickActions = [
    { label: 'Broadcast Message', href: '/dashboard/broadcast', icon: Megaphone, color: 'text-white', bg: 'bg-gradient-to-r from-blue-600 to-indigo-600' },
    { label: 'Manage Users', href: '/dashboard/users', icon: Users, color: 'text-gray-700', bg: 'bg-white border border-gray-200 hover:bg-gray-50' },
    { label: 'View Inbox', href: '/dashboard/inbox', icon: MessageSquare, color: 'text-gray-700', bg: 'bg-white border border-gray-200 hover:bg-gray-50' },
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">Overview of your bot's performance and activity.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/broadcast" className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-gray-900 text-white hover:bg-gray-900/90 h-10 py-2 px-4 shadow-sm">
            <Megaphone className="mr-2 h-4 w-4" />
            New Broadcast
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Link key={i} href={stat.href} className="block group">
              <Card className={`border shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 h-full ${stat.border}`}>
                <CardContent className="p-5 flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                      {loading ? (
                        <span className="inline-block w-8 h-8 bg-gray-100 animate-pulse rounded" />
                      ) : stat.value}
                    </h3>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} transition-colors group-hover:scale-110 duration-200`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions & Status */}
        <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border shadow-sm border-gray-200">
            <CardHeader className="border-b border-gray-100 bg-gray-50/30 px-5 py-4">
              <CardTitle className="text-base font-semibold text-gray-900">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid gap-3">
                {quickActions.map((action, i) => (
                  <Link
                    key={i}
                    href={action.href}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${action.bg} ${action.color} group hover:shadow-md hover:-translate-y-0.5 border border-transparent`}
                  >
                    <div className={`p-2 rounded-lg ${action.color === 'text-white' ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-white'}`}>
                      <action.icon className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-sm">{action.label}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="rounded-xl bg-gradient-to-br from-indigo-900 to-blue-900 p-6 text-white shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-700"></div>
            <div className="absolute bottom-0 left-0 -ml-4 -mb-4 w-20 h-20 bg-blue-500/20 rounded-full blur-xl group-hover:bg-blue-500/30 transition-all duration-700"></div>

            <h3 className="text-lg font-bold mb-2 relative z-10">Bot Status</h3>
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-medium text-emerald-100">System Online</span>
            </div>
            <p className="text-indigo-100 text-sm mb-4 relative z-10">
              Your bot is currently active and processing messages normally.
            </p>
            <Link
              href="/dashboard/settings"
              className="inline-block text-xs bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-1.5 transition-colors text-white font-medium relative z-10"
            >
              welcome messages
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 