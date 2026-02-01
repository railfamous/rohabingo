'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { uploadFile } from '@/lib/api';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Search, Send, Paperclip, Loader2, Image as ImageIcon, FileText, CheckCheck, MoreVertical, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

type Conversation = {
  id: number;
  user_id: number | null;
  telegram_chat_id: number;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};

type ConversationMessage = {
  id: number;
  conversation_id: number;
  direction: 'inbound' | 'outbound' | string;
  telegram_message_id: number | null;
  telegram_reply_to_message_id: number | null;
  sender_telegram_user_id: number | null;
  type: string;
  text: string | null;
  file_id: string | null;
  file_unique_id: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  media_duration: number | null;
  payload: any;
  created_at: string;
};

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const sendingRef = useRef(false);
  const sendQueueRef = useRef<Array<{
    conversationId: number;
    text: string;
    hasMedia: boolean;
    mediaType: string;
    url: string;
    mediaFileName: string;
    replyToId?: number | null;
    sig: string;
    optimisticId: number;
  }>>([]);
  const lastSendRef = useRef<{ sig: string; at: number } | null>(null);
  const cooldownUntilRef = useRef<number>(0);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [mediaType, setMediaType] = useState<string>('');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaFileName, setMediaFileName] = useState<string>('');
  const [replyTo, setReplyTo] = useState<ConversationMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const selectedConversation = useMemo(
    () => conversations.find(c => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  const filteredConversations = useMemo(() => {
    if (!searchTerm) return conversations;
    const lower = searchTerm.toLowerCase();
    return conversations.filter(c =>
      (c.username && c.username.toLowerCase().includes(lower)) ||
      (c.first_name && c.first_name.toLowerCase().includes(lower)) ||
      (c.last_name && c.last_name.toLowerCase().includes(lower)) ||
      String(c.telegram_chat_id).includes(lower)
    );
  }, [conversations, searchTerm]);

  const loadConversations = async () => {
    try {
      const res = await api.get('/admin/inbox/conversations?limit=100');
      setConversations(res.data.conversations || []);
    } catch {
      // silent fail
    }
  };

  const loadMessages = async (conversationId: number, opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/admin/inbox/conversations/${conversationId}/messages?limit=500`);
      const incoming: ConversationMessage[] = res.data.messages || [];

      // Update unread count locally for this conversation
      setConversations(prev => prev.map(c =>
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      ));

      setMessages((prev) => {
        const prevSame = prev.filter((m) => m.conversation_id === conversationId);
        const byId = new Map<any, ConversationMessage>();
        for (const m of prevSame) byId.set(m.id, m);
        for (const m of incoming) byId.set(m.id, m);
        return Array.from(byId.values()).sort((a, b) => {
          const ta = Date.parse(a.created_at || '') || 0;
          const tb = Date.parse(b.created_at || '') || 0;
          if (ta !== tb) return ta - tb;
          return (a.id || 0) - (b.id || 0);
        });
      });
    } catch {
      toast.error('Failed to load messages');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
    const t = setInterval(loadConversations, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setMessages([]);
    loadMessages(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(() => {
      loadMessages(selectedId, { silent: true });
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, selectedId]);

  const handleUpload = async (file: File) => {
    try {
      const up = await uploadFile(file, 'inbox');
      setMediaUrl(up.url);
      setMediaFileName(file.name || '');

      if (file.type.startsWith('image/')) setMediaType('photo');
      else if (file.type.startsWith('video/')) setMediaType('video');
      else if (file.type.startsWith('audio/')) setMediaType('audio');
      else setMediaType('document');

      toast.success('File attached');
    } catch {
      toast.error('Upload failed');
    }
  };

  const processSendQueue = async () => {
    if (sendingRef.current) return;
    if (!sendQueueRef.current.length) return;

    sendingRef.current = true;
    setSending(true);

    while (sendQueueRef.current.length) {
      const job = sendQueueRef.current.shift();
      if (!job) continue;

      try {
        const idempotencyKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        await api.post(`/admin/inbox/conversations/${job.conversationId}/reply`, {
          text: job.text ? job.text : undefined,
          media_type: job.hasMedia ? job.mediaType : undefined,
          media_url: job.hasMedia ? job.url : undefined,
          parse_mode: 'HTML',
          reply_to_message_id: job.replyToId,
          idempotency_key: idempotencyKey,
        });

        lastSendRef.current = { sig: job.sig, at: Date.now() };
        cooldownUntilRef.current = Date.now() + 300;

        // Refresh conversations to update last message preview
        void loadConversations();

        // Fix duplicate messages:
        // 1. Fetch real messages (if active)
        if (selectedIdRef.current === job.conversationId) {
          await loadMessages(job.conversationId, { silent: true });
        }
        // 2. Remove optimistic message
        setMessages((prev) => prev.filter((m) => m.id !== job.optimisticId));

      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== job.optimisticId));
        toast.error('Failed to send message');
      }
    }

    setSending(false);
    sendingRef.current = false;
  };

  const sendReply = async (e?: MouseEvent<HTMLButtonElement> | React.FormEvent) => {
    e?.preventDefault();
    if (!selectedConversation) return;

    // Reduced cooldown (0.5s) to prevent accidental double-clicks but allow fast chatting
    if (Date.now() < cooldownUntilRef.current) return;

    const text = replyText.trim();
    const url = mediaUrl.trim();
    const hasMedia = !!url;
    if (!text && !hasMedia) return;

    const sig = `${selectedConversation.id}::${text}::${hasMedia ? `${mediaType}:${url}` : ''}`;
    const last = lastSendRef.current;

    // Duplicate check: only block if exact same content sent < 1s ago
    if (last && last.sig === sig && Date.now() - last.at < 1000) return;

    const optimisticId = -Date.now();
    const nowIso = new Date().toISOString();

    setMessages((prev) => [...prev, {
      id: optimisticId,
      conversation_id: selectedConversation.id,
      direction: 'outbound',
      telegram_message_id: null,
      telegram_reply_to_message_id: replyTo ? replyTo.telegram_message_id : null,
      sender_telegram_user_id: null,
      type: hasMedia ? mediaType || 'media' : 'text',
      text: text || null,
      file_id: null,
      file_unique_id: null,
      file_name: hasMedia ? (mediaFileName || null) : null,
      mime_type: null,
      file_size: null,
      media_duration: null,
      payload: hasMedia ? { media_type: mediaType, media_url: url } : null,
      created_at: nowIso,
    }]);

    sendQueueRef.current.push({
      conversationId: selectedConversation.id,
      text,
      hasMedia,
      mediaType,
      url,
      mediaFileName,
      replyToId: replyTo ? replyTo.telegram_message_id : undefined,
      sig,
      optimisticId,
    });

    // Reset input immediately
    setReplyText('');
    setMediaType('');
    setMediaUrl('');
    setMediaFileName('');
    setReplyTo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Focus management is automatic since input has autoFocus but let's be safe
    // Note: In React, state updates might cause loss of focus if component re-renders fully.

    void processSendQueue();
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden bg-gray-50/50 m-4 rounded-xl border shadow-sm">
      {/* Sidebar List */}
      <div className="w-80 border-r bg-white flex flex-col">
        <div className="p-4 border-b space-y-3">
          <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search conversations..."
              className="pl-9 bg-gray-50 border-gray-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {filteredConversations.map((c) => {
              const name = c.username
                ? `@${c.username}`
                : [c.first_name, c.last_name].filter(Boolean).join(' ') || `User ${c.telegram_chat_id}`;
              const initials = (name.slice(0, 2)).toUpperCase();

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`flex items-start gap-3 p-4 text-left transition-colors border-b border-dashed border-gray-100 last:border-0 hover:bg-gray-50/80
                    ${selectedId === c.id ? 'bg-blue-50/50 hover:bg-blue-50' : ''}`}
                >
                  <Avatar className="h-10 w-10 border relative">
                    {c.photo_url && <AvatarImage src={c.photo_url} alt={name} />}
                    <AvatarFallback className="text-xs bg-blue-100 text-blue-700">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium text-sm truncate ${selectedId === c.id ? 'text-blue-900' : 'text-gray-900'}`}>
                        {name}
                      </span>
                      <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                        {c.last_message_at ? format(new Date(c.last_message_at), 'MMM d') : ''}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className={`text-xs truncate max-w-[180px] ${selectedId === c.id ? 'text-blue-600/80' : 'text-gray-500'}`}>
                        {c.last_message_preview || 'No messages'}
                      </p>
                      {c.unread_count > 0 && (
                        <span className="bg-red-500 text-white text-[10px] h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full font-bold shadow-sm">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredConversations.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">
                No conversations found.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50/30">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border">
                  {selectedConversation.photo_url && <AvatarImage src={selectedConversation.photo_url} alt={selectedConversation.username || 'User'} />}
                  <AvatarFallback className="bg-purple-100 text-purple-700">
                    {selectedConversation.username?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    {selectedConversation.username ? `@${selectedConversation.username}` : `User ${selectedConversation.telegram_chat_id}`}
                  </h2>
                  <div className="text-xs text-green-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Active
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-gray-400">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              <div className="space-y-4 max-w-3xl mx-auto pb-4">
                {loading && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                )}

                {messages.length === 0 && !loading && (
                  <div className="text-center py-10 text-sm text-gray-400">
                    No messages in this conversation yet.
                  </div>
                )}

                {messages.map((m) => {
                  const isOutbound = m.direction === 'outbound';
                  return (
                    <div key={m.id} className="group relative">
                      <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                        <div className="flex items-end gap-2 max-w-[85%]">
                          {/* Reply Button (visible on hover) */}
                          <button
                            onClick={() => setReplyTo(m)}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-gray-200 text-gray-400
                              ${isOutbound ? 'order-first mr-1' : 'order-last ml-1'}`}
                            title="Reply"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-reply"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
                          </button>

                          <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm border
                            ${isOutbound
                              ? 'bg-blue-600 text-white border-blue-600 rounded-br-none'
                              : 'bg-white text-gray-800 border-gray-200 rounded-bl-none'
                            }
                          `}>
                            {/* Reply Context in Message Bubble */}
                            {m.telegram_reply_to_message_id && (
                              <div className={`mb-2 pl-2 border-l-2 text-xs opacity-75 ${isOutbound ? 'border-white/50' : 'border-blue-500'}`}>
                                <div className="font-semibold">Replying...</div>
                              </div>
                            )}

                            {m.text && <div className="leading-relaxed whitespace-pre-wrap break-words">{m.text}</div>}

                            {(m.file_id || m.file_name || m.payload?.media_url) && (
                              <div className={`mt-2 p-2 rounded bg-black/10 flex items-center gap-2 text-xs font-medium`}>
                                {m.type === 'photo' ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                <span className="truncate max-w-[150px]">
                                  {m.file_name || m.file_unique_id || 'Attachment'}
                                </span>
                              </div>
                            )}

                            <div className={`text-[10px] mt-1 text-right opacity-70 flex items-center justify-end gap-1`}>
                              {format(new Date(m.created_at), 'h:mm a')}
                              {isOutbound && <CheckCheck className="w-3 h-3" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Composer */}
            <div className="p-4 bg-white border-t">
              <div className="max-w-3xl mx-auto">
                {/* Reply Banner */}
                {replyTo && (
                  <div className="mb-2 flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg border-l-4 border-blue-500 animate-in slide-in-from-bottom-2">
                    <div className="flex flex-col text-sm">
                      <span className="font-semibold text-blue-600">Replying to {replyTo.direction === 'outbound' ? 'You' : (selectedConversation.first_name || 'User')}</span>
                      <span className="text-gray-500 truncate max-w-md">{replyTo.text || '[Attachment]'}</span>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-200 rounded-full">
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                )}

                {mediaUrl && (
                  <div className="mb-2 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md text-xs font-medium border border-blue-100 animate-in slide-in-from-bottom-2">
                    <Paperclip className="w-3 h-3" />
                    {mediaFileName || 'Attachment'}
                    <button onClick={() => { setMediaUrl(''); setMediaFileName(''); }} className="ml-1 hover:bg-blue-100 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => { e.preventDefault(); sendReply(); }}
                >
                  <div className="flex-1 relative">
                    <Input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your message..."
                      className="pr-10 py-6"
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-gray-400 hover:text-gray-600"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(f);
                      }}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={(!replyText && !mediaUrl)}
                    className="h-12 w-12 rounded-xl shrink-0"
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <Send className="w-8 h-8 text-gray-300" />
            </div>
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
