'use client';

import { useEffect, useState } from 'react';
import { getDashboardSummary, DashboardSummary, getTopUsers, TopUser, getRecentActivities, RecentActivity } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Users, MessageSquare, HelpCircle, Workflow, Megaphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [topUsersLoading, setTopUsersLoading] = useState(true);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchAll = () => {
      getDashboardSummary().then(data => {
        setSummary(data);
        setLoading(false);
      }).catch(() => setLoading(false));
      getTopUsers(5).then(users => {
        setTopUsers(users);
        setTopUsersLoading(false);
      }).catch(() => setTopUsersLoading(false));
      getRecentActivities(5).then(data => {
        setActivities(data.activities);
        setActivitiesLoading(false);
      }).catch(() => setActivitiesLoading(false));
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
      bg: 'bg-blue-100',
      href: '/dashboard/users'
    },
    {
      label: 'Unread Messages',
      value: summary?.unreadMessages ?? '-',
      icon: MessageSquare,
      color: 'text-green-600',
      bg: 'bg-green-100',
      href: '/dashboard/inbox'
    },
    {
      label: 'Open Requests',
      value: summary?.openRequests ?? '-',
      icon: HelpCircle,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
      href: '/dashboard/user-requests'
    },
    {
      label: 'Active Flows',
      value: summary?.activeFlows ?? '-',
      icon: Workflow,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
      href: '/dashboard/flows'
    },
    {
      label: 'Active Channels',
      value: summary?.activeChannels ?? '-',
      icon: Megaphone,
      color: 'text-pink-600',
      bg: 'bg-pink-100',
      href: '/dashboard/channels'
    }
  ];

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-2">Overview of your bot's performance and activity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Link key={i} href={stat.href} className="block transition-transform hover:scale-[1.02]">
              <Card className="border-none shadow-sm hover:shadow-md transition-all h-full">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                    <h3 className="text-2xl font-bold mt-2 text-gray-900">
                      {loading ? '...' : stat.value}
                    </h3>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bg}`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {activitiesLoading ? (
                <div className="py-8 text-center text-gray-400">Loading activities...</div>
              ) : activities.length > 0 ? (
                activities.map((item, idx) => (
                  <div key={idx} className="py-4 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                        {(item.first_name?.[0] || item.username?.[0] || 'U').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">
                          {item.first_name} {item.last_name}
                          {item.username && <span className="text-gray-400 font-normal ml-1">@{item.username}</span>}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-gray-400">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Users */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top Users</CardTitle>
            <Link href="/dashboard/users" className="text-sm text-blue-600 hover:underline">View All</Link>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-left">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium text-right">Tasks</th>
                    <th className="pb-3 font-medium text-right">Referrals</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topUsersLoading ? (
                    <tr><td colSpan={3} className="py-8 text-center text-gray-400">Loading users...</td></tr>
                  ) : topUsers.length > 0 ? (
                    topUsers.map((user) => (
                      <tr key={user.id} className="group">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                              {(user.first_name?.[0] || 'U').toUpperCase()}
                            </div>
                            <div className="font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-right text-gray-600">{user.completed_tasks_count}</td>
                        <td className="py-3 text-right text-gray-600">{user.referral_count}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={3} className="py-8 text-center text-gray-400">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 