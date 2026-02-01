'use client';

import { useEffect, useState } from 'react';
import { getDashboardSummary, DashboardSummary, getTopUsers, TopUser, getUserRequests, UserRequest } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Users, MessageSquare, HelpCircle, Workflow, Megaphone, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [topUsersLoading, setTopUsersLoading] = useState(true);
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

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

      getUserRequests({ status: 'open', limit: 5 }).then(data => {
        setRequests((data.requests || []).slice(0, 5));
        setRequestsLoading(false);
      }).catch(() => setRequestsLoading(false));
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
        {/* Recent Open Requests */}
        <Card className="border-none shadow-sm h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-gray-800">Recent Requests</CardTitle>
            <Link href="/dashboard/user-requests" className="text-blue-600 hover:text-blue-700 flex items-center text-sm font-medium">
              View All <ArrowRight className="ml-1 w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-4">
              {requestsLoading ? (
                <div className="py-8 text-center text-gray-400">Loading requests...</div>
              ) : requests.length > 0 ? (
                requests.map((req) => (
                  <div key={req.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                    <Avatar className="w-10 h-10 border border-gray-200">
                      <AvatarImage src={req.photo_url || undefined} />
                      <AvatarFallback className="bg-orange-100 text-orange-600 font-bold">
                        {(req.first_name?.[0] || req.username?.[0] || 'U').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {req.first_name} {req.last_name}
                        </p>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap bg-gray-100 px-2 py-0.5 rounded-full">
                          {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 leading-snug">
                        {req.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{req.source}</span>
                        {req.payload && (
                          <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-1 rounded">
                            {JSON.stringify(req.payload).slice(0, 20)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                  <HelpCircle className="w-8 h-8 opacity-20 mb-2" />
                  <p>No open requests</p>
                </div>
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