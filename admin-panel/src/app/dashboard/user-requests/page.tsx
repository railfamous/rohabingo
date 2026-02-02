'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, RefreshCw, Send, Circle, CheckCircle2, Clock3, Search, Filter, Mail, User, Activity } from 'lucide-react';
import api, { UserRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

function humanizeSource(source?: string) {
  const s = String(source || '').toLowerCase();
  if (s === 'callback_query') return 'Button Click';
  if (s === 'message') return 'Message';
  if (s === 'command') return 'Command';
  if (s === 'menu') return 'Menu';
  if (s === 'flow') return 'Flow';
  return source || 'Unknown';
}

function humanizeAction(action?: string, payload?: any) {
  if (payload && typeof payload === 'object') {
    const slug = payload.slug ? String(payload.slug) : '';
    const nodeKey = payload.nodeKey ? String(payload.nodeKey) : '';
    const nodeText = payload.nodeText ? String(payload.nodeText) : '';
    const label = payload.label ? String(payload.label) : '';
    const optionKey = payload.optionKey ? String(payload.optionKey) : '';

    if (slug && (nodeText || nodeKey) && (label || optionKey)) {
      const choice = label || optionKey;
      const q = nodeText || nodeKey;
      return `Flow: ${slug} / ${q} → ${choice}`;
    }
  }

  const a = String(action || '').trim();
  if (!a) return '—';
  if (a.startsWith('flowmulti:')) return 'Flow (multi-choice)';
  if (a.startsWith('flow:')) return 'Flow (choice)';
  if (a.startsWith('onb:')) return 'Onboarding';
  if (a.startsWith('topic:')) return 'Topic';
  if (a.startsWith('country:')) return 'Country';
  if (a.startsWith('lang:')) return 'Language';
  return a;
}

export default function UserRequestsPage() {
  const [statusFilter, setStatusFilter] = useState<'open' | 'in_progress' | 'closed' | 'all'>('open');
  const [items, setItems] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UserRequest | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const getStatusConfig = (status: 'open' | 'in_progress' | 'closed') => {
    switch (status) {
      case 'open':
        return { label: 'Open', className: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100', icon: Circle };
      case 'in_progress':
        return { label: 'In Progress', className: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100', icon: Clock3 };
      case 'closed':
        return { label: 'Closed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100', icon: CheckCircle2 };
      default:
        return { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100', icon: Circle };
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/admin/user-requests', { params });
      setItems(res.data.requests || []);
      // Maintain selection even if it disappears from the list (e.g. status change)
      setSelected(prev => {
        if (!prev) return null;
        const found = (res.data.requests || []).find((r: UserRequest) => r.id === prev.id);
        return found || prev;
      });
    } catch (e) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter(i =>
      (i.first_name && i.first_name.toLowerCase().includes(lower)) ||
      (i.username && i.username.toLowerCase().includes(lower)) ||
      (i.message && i.message.toLowerCase().includes(lower)) ||
      String(i.id).includes(lower)
    );
  }, [items, searchTerm]);

  const updateStatus = async (id: number, status: 'open' | 'in_progress' | 'closed') => {
    try {
      // Optimistic update for selected item
      if (selected && selected.id === id) {
        setSelected({ ...selected, status });
      }

      await api.patch(`/admin/user-requests/${id}/status`, { status });
      toast.success(`Status updated to ${status}`);
      await fetchData();
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const sendReply = async () => {
    if (!selected) return;
    try {
      setSending(true);
      await api.post(`/admin/user-requests/${selected.id}/reply`, { message: reply });
      setReply('');
      toast.success('Reply sent successfully');
      await fetchData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 p-4 overflow-hidden bg-gray-50/50">
      {/* Left Column: List */}
      <Card className="w-1/3 flex flex-col h-full overflow-hidden border-gray-200 shadow-sm">
        <div className="p-4 border-b space-y-4 bg-white/50">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Support Tickets
            </h2>
            <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading} className="h-8 w-8">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search..."
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v: any) => setStatusFilter(v)}
            >
              <SelectTrigger className="w-[130px] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1 bg-white">
          <div className="flex flex-col p-2 gap-1">
            {filteredItems.length === 0 && !loading && (
              <div className="text-center py-10 text-gray-400 text-sm">
                No requests found.
              </div>
            )}

            {filteredItems.map(item => {
              const status = getStatusConfig(item.status);
              const StatusIcon = status.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={`flex flex-col gap-2 p-3 text-left rounded-lg transition-all border
                    ${selected?.id === item.id
                      ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200'
                      : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-100'}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Avatar className="h-6 w-6 border">
                        {item.photo_url && <AvatarImage src={item.photo_url} />}
                        <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">
                          {(item.first_name?.[0] || item.username?.[0] || 'U').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm truncate text-gray-900">
                        {item.first_name || item.username || `User ${item.telegram_chat_id}`}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="text-xs text-gray-600 line-clamp-2 pl-8">
                    {item.message || 'No content'}
                  </div>

                  <div className="flex items-center gap-2 pl-8 mt-1">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border ${status.className}`}>
                      {status.label}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal bg-gray-100 text-gray-600">
                      {humanizeSource(item.source)}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </Card>

      {/* Right Column: Details */}
      <Card className="flex-1 flex flex-col h-full border-gray-200 shadow-sm overflow-hidden bg-white/50">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-medium text-gray-500">Select a ticket to view details</p>
            <p className="text-xs max-w-xs text-center">
              Support tickets are created when users message the bot directly or use the "Contact Support" feature. Use this page to reply manually.
            </p>
          </div>
        ) : (
          <>
            <div className="p-6 border-b bg-white flex items-start justify-between shrink-0">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12 border shadow-sm">
                  {selected.photo_url && <AvatarImage src={selected.photo_url} />}
                  <AvatarFallback className="text-lg bg-blue-100 text-blue-700">
                    {(selected.first_name?.[0] || selected.username?.[0] || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {selected.first_name || selected.username || 'User'}
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                    <User className="h-3 w-3" />
                    <span>User ID: {selected.user_id}</span>
                    <Separator orientation="vertical" className="h-3" />
                    <Mail className="h-3 w-3" />
                    <span>Chat ID: {selected.telegram_chat_id}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Select
                      value={selected.status}
                      onValueChange={(v: any) => updateStatus(selected.id, v)}
                    >
                      <SelectTrigger className={`h-7 text-xs border-0 ring-1 ring-inset w-auto gap-2 px-2 shadow-none font-medium
                        ${getStatusConfig(selected.status).className}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="text-right text-xs text-gray-500 space-y-1">
                <div className="font-mono">#{selected.id}</div>
                <div>{new Date(selected.created_at).toLocaleString()}</div>
              </div>
            </div>

            <ScrollArea className="flex-1 bg-[#0e1621]">
              <div className="p-6 space-y-6">

                {/* Ticket Info (System Message) */}
                <div className="flex justify-center">
                  <div className="bg-[#182533] text-gray-400 text-xs px-4 py-2 rounded-full border border-gray-800 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="font-semibold text-gray-500 uppercase tracking-wider">Channel:</span>
                      <span className="text-gray-300">{humanizeSource(selected.source)}</span>
                    </span>
                    <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                    <span className="flex items-center gap-1">
                      <span className="font-semibold text-gray-500 uppercase tracking-wider">Activity:</span>
                      <span className="text-gray-300">{humanizeAction(selected.action_key, selected.payload)}</span>
                    </span>
                  </div>
                </div>

                {/* User Message (Left) */}
                <div className="flex items-end gap-3 justify-start">
                  <Avatar className="h-8 w-8 border border-gray-700 shadow-sm shrink-0 mb-1">
                    {selected.photo_url && <AvatarImage src={selected.photo_url} />}
                    <AvatarFallback className="text-xs bg-blue-600 text-white">
                      {(selected.first_name?.[0] || selected.username?.[0] || 'U').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-1 max-w-[80%]">
                    <span className="text-xs text-gray-500 ml-1">{selected.first_name || 'User'}</span>
                    <div className="bg-[#182533] p-3 rounded-2xl rounded-bl-none border border-gray-800 text-white text-sm whitespace-pre-wrap leading-relaxed shadow-sm">
                      {selected.message}
                    </div>
                    <span className="text-[10px] text-gray-600 ml-1">
                      {new Date(selected.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Admin Reply (Right) */}
                {selected.admin_reply && (
                  <div className="flex items-end gap-3 justify-end">
                    <div className="flex flex-col gap-1 items-end max-w-[80%]">
                      <span className="text-xs text-gray-500 mr-1">Support Agent</span>
                      <div className="bg-[#2b5278] p-3 rounded-2xl rounded-br-none text-white text-sm whitespace-pre-wrap leading-relaxed shadow-sm">
                        {selected.admin_reply}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 mr-1">
                        <CheckCircle2 className="w-3 h-3 text-blue-500" />
                        <span>Sent {selected.replied_at ? new Date(selected.replied_at).toLocaleString() : ''}</span>
                      </div>
                    </div>
                    <Avatar className="h-8 w-8 border border-gray-700 shadow-sm shrink-0 mb-1">
                      <AvatarFallback className="bg-green-600 text-white">A</AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-4 bg-white border-t">
              <div className="flex items-end gap-2 bg-gray-50 border rounded-2xl p-2 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <Textarea
                  placeholder="Type your reply..."
                  className="min-h-[44px] max-h-[120px] bg-transparent border-0 focus-visible:ring-0 resize-none py-2.5 text-sm"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                />
                <Button
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  size="icon"
                  className="h-9 w-9 mb-1 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>

              <div className="flex justify-between items-center mt-2 px-1">
                <p className="text-[10px] text-gray-400">
                  Press Enter to send • Shift+Enter for new line
                </p>
                <div className="flex gap-2">
                  {selected.status !== 'closed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateStatus(selected.id, 'closed')}
                      className="text-xs h-6 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      Close Ticket
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
