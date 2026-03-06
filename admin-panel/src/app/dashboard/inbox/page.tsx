'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { uploadFile, getUserFlowAnswers, type FlowSession } from '@/lib/api';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Search, Send, Paperclip, Loader2, Image as ImageIcon, FileText, CheckCheck, MoreVertical, X, ChevronRight, MessageSquare } from 'lucide-react';
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
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');



  // Flow Answers State
  const [flowSessions, setFlowSessions] = useState<FlowSession[]>([]);
  const [loadingFlows, setLoadingFlows] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
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
    const conversationId = selectedId;
    if (conversationId) {
      loadMessages(conversationId, { silent: true });
    }
  }, [selectedId]);

  // Load flow answers when conversation changes
  useEffect(() => {
    if (selectedConversation?.user_id) {
      setLoadingFlows(true);
      getUserFlowAnswers(selectedConversation.user_id)
        .then(data => setFlowSessions(data.sessions || []))
        .catch(() => setFlowSessions([]))
        .finally(() => setLoadingFlows(false));
    } else {
      setFlowSessions([]);
    }
  }, [selectedConversation?.user_id]);

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

  /* Scroll handling */
  const prevMetricsRef = useRef({ selectedId: null as number | null, length: 0 });

  useEffect(() => {
    if (!scrollAreaRef.current) return;

    const { selectedId: prevId, length: prevLen } = prevMetricsRef.current;

    // Determine scenario
    const isNewSelection = selectedId !== prevId;
    // Messages loaded (length changed from 0 or small to N, and we just selected)
    // Actually, simply: if selection changed, we want to jump. 
    // BUT messages might not be loaded yet (messages=[] initially).
    // so we wait for messages to populate.

    const isMessagesLoaded = messages.length > 0 && (isNewSelection || messages.length !== prevLen);

    if (isMessagesLoaded) {
      // 1. If it's a new selection (or first load of messages for this selection), handle positioning
      // We rely on "isNewSelection" or "We haven't positioned yet".
      // Let's use a simple heuristic: If we are at the top (scrollTop=0) or we just selected.

      if (isNewSelection || prevLen === 0) {
        const unread = selectedConversation?.unread_count || 0;

        let targetElement: Element | null = null;

        if (unread > 0 && messages.length >= unread) {
          const firstUnreadIndex = messages.length - unread;
          // Try to find by index
          const container = scrollAreaRef.current.firstElementChild;
          if (container && container.children[firstUnreadIndex]) {
            targetElement = container.children[firstUnreadIndex];
          }
        }

        if (targetElement) {
          targetElement.scrollIntoView({ block: 'center', behavior: 'auto' });
        } else {
          // Default to bottom
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      }
      // 2. New message arriving in existing active chat
      else if (messages.length > prevLen && !highlightedId && prevLen > 0) {
        const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;

        if (isNearBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }
    }

    prevMetricsRef.current = { selectedId, length: messages.length };
  }, [messages, selectedId, highlightedId, selectedConversation]);

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

  const scrollToMessage = (telegramId: number) => {
    const el = document.getElementById(`msg-${telegramId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(telegramId);
      setTimeout(() => setHighlightedId(null), 3000);
    } else {
      toast.error('Message not found (might be too old)');
    }
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
              const displayName = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown User';
              const username = c.username ? `@${c.username}` : '';
              const userId = `ID: ${c.telegram_chat_id}`;
              const initials = (displayName.slice(0, 2)).toUpperCase();

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`flex items-start gap-3 p-3 text-left transition-all border-b border-gray-100 last:border-0 hover:bg-gray-50
                    ${selectedId === c.id ? 'bg-blue-50/60 border-l-4 border-l-blue-500 pl-[11px]' : 'pl-4 border-l-4 border-l-transparent'}`}
                >
                  <Avatar className="h-10 w-10 border shrink-0">
                    {c.photo_url && <AvatarImage src={c.photo_url} alt={displayName} />}
                    <AvatarFallback className="text-xs bg-gray-100 text-gray-600 font-medium">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`font-semibold text-sm truncate ${selectedId === c.id ? 'text-gray-900' : 'text-gray-800'}`}>
                        {displayName}
                      </span>
                      <span className="text-[10px] text-gray-400 shrink-0 ml-1">
                        {c.last_message_at ? format(new Date(c.last_message_at), 'HH:mm') : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1">
                      {username && <span className="font-mono text-blue-600/80">{username}</span>}
                      {username && <span className="text-gray-300">•</span>}
                      <span className="font-mono text-gray-400">{userId}</span>
                    </div>

                    <div className="flex justify-between items-end gap-2">
                      <p className={`text-xs truncate ${selectedId === c.id ? 'text-gray-600' : 'text-gray-500'}`}>
                        {c.last_message_preview || 'No messages'}
                      </p>
                      {c.unread_count > 0 && (
                        <span className="bg-green-500 text-white text-[10px] h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full font-bold shadow-sm shrink-0">
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
      <div className="flex-1 flex flex-col bg-[#efe7dd] relative">
        {/* Background Pattern Overlay (Optional, simple dot/noise for texture) */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }} />

        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="h-16 border-b bg-gray-50/95 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60 flex items-center justify-between px-4 shrink-0 z-10 sticky top-0">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border cursor-pointer hover:opacity-90 transition-opacity">
                  {selectedConversation.photo_url && <AvatarImage src={selectedConversation.photo_url} alt={selectedConversation.username || 'User'} />}
                  <AvatarFallback className="bg-gray-200 text-gray-500 font-semibold">
                    {selectedConversation.username?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    {[selectedConversation.first_name, selectedConversation.last_name].filter(Boolean).join(' ') || 'Unknown User'}
                    {selectedConversation.username && <span className="text-gray-500 font-normal">(@{selectedConversation.username})</span>}
                  </h2>
                  <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <span className="bg-blue-100 text-blue-700 font-mono px-1 rounded">ID: {selectedConversation.telegram_chat_id}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-green-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Online
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Actions */}
                <Button variant="ghost" size="icon" className="text-gray-500 hover:bg-gray-100">
                  <Search className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-gray-500 hover:bg-gray-100">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4 min-h-0 z-0">
              <div className="space-y-2 max-w-4xl mx-auto pb-4">
                {loading && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                )}

                {messages.length === 0 && !loading && (
                  <div className="text-center py-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
                      <span className="text-2xl">👋</span>
                    </div>
                    <p className="text-sm text-gray-500 bg-white/80 px-4 py-1 rounded-full inline-block shadow-sm">
                      No messages yet. Say hello!
                    </p>
                  </div>
                )}

                {messages.map((m) => {
                  const isOutbound = m.direction === 'outbound';
                  return (
                    <div
                      key={m.id}
                      id={m.telegram_message_id ? `msg-${m.telegram_message_id}` : undefined}
                      className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} group mb-1 items-end gap-2`}
                    >
                      {isOutbound && (
                        <button
                          onClick={() => setReplyTo(m)}
                          className="mb-2 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-full hover:bg-gray-200 text-gray-400"
                          title="Reply"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
                        </button>
                      )}

                      <div className={`relative max-w-[85%] lg:max-w-[70%] min-w-[120px] shadow-sm transition-all duration-300
                        ${highlightedId === m.telegram_message_id ? 'ring-4 ring-blue-400/50 bg-blue-50 z-10 scale-105 shadow-lg' : ''}
                        ${isOutbound
                          ? 'bg-[#d9fdd3] rounded-l-lg rounded-tr-none rounded-br-lg'
                          : 'bg-white rounded-r-lg rounded-tl-none rounded-bl-lg'
                        } p-1.5 pb-1`
                      }>
                        {/* Tail Trick (Optional SVG or CSS border hack, keeping simple rounded for now) */}

                        <div className="px-2 pt-1 pb-4 text-[14.2px] text-gray-900 leading-snug whitespace-pre-wrap break-words">
                          {/* Reply Context */}
                          {m.telegram_reply_to_message_id && (
                            <div
                              onClick={() => m.telegram_reply_to_message_id && scrollToMessage(m.telegram_reply_to_message_id)}
                              className={`mb-1 pl-2 border-l-4 rounded bg-black/5 text-xs py-1.5 cursor-pointer hover:bg-black/10 transition-colors
                                ${isOutbound ? 'border-green-500' : 'border-blue-500'}`}
                            >
                              <div className="font-semibold text-blue-600/80 mb-0.5">Reply</div>
                              <div className="truncate opacity-70">Click to view original</div>
                            </div>
                          )}

                          {m.text}

                          {(m.file_id || m.file_name || m.payload?.media_url) && (
                            <div className="mt-2">
                              {/* Media Preview Logic */}
                              {(function () {
                                const url = m.payload?.media_url;
                                if (url && m.type === 'photo') {
                                  return (
                                    <div className="rounded-lg overflow-hidden border border-black/5 bg-gray-100 flex justify-center max-w-sm">
                                      <img src={url} alt="Attachment" className="max-h-[300px] w-auto object-contain cursor-pointer hover:opacity-95" onClick={() => window.open(url, '_blank')} />
                                    </div>
                                  );
                                }
                                if (url && m.type === 'video') {
                                  return (
                                    <div className="rounded-lg overflow-hidden border border-black/5 bg-black max-w-sm">
                                      <video src={url} controls className="max-h-[300px] w-full" />
                                    </div>
                                  );
                                }
                                // Fallback for docs or missing URL
                                return (
                                  <div className="flex items-center gap-2 p-2 rounded bg-black/5 border border-black/5">
                                    {m.type === 'photo' ? <ImageIcon className="w-5 h-5 text-purple-500" /> : <FileText className="w-5 h-5 text-blue-500" />}
                                    <div className="flex flex-col overflow-hidden">
                                      {url ? (
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium truncate w-full hover:underline text-blue-600">
                                          {m.file_name || 'Download Attachment'}
                                        </a>
                                      ) : (
                                        <span className="text-xs font-medium truncate w-full">{m.file_name || 'Media Attachment'}</span>
                                      )}
                                      <span className="text-[10px] text-gray-500 uppercase">{m.type || 'FILE'}</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        {/* Timestamp & Status */}
                        <div className="absolute right-2 bottom-1 flex items-center gap-1 space-x-0.5 select-none">
                          <span className="text-[11px] text-gray-500/80 min-w-[45px] text-right">
                            {format(new Date(m.created_at), 'h:mm a')}
                          </span>
                          {isOutbound && (
                            <div className="flex">
                              {/* Double Tick (Blue if read, Gray if sent) - Mocking blue for now as "delivered" */}
                              <CheckCheck className="w-4 h-4 text-blue-500" />
                            </div>
                          )}
                        </div>
                      </div>

                      {!isOutbound && (
                        <button
                          onClick={() => setReplyTo(m)}
                          className="mb-2 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-full hover:bg-gray-200 text-gray-400"
                          title="Reply"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
                        </button>
                      )}
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

      {/* User Info Panel with Flow Answers */}
      {selectedConversation && (
        <div className="w-80 border-l bg-white flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm text-gray-900">User Info</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* User Profile */}
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {selectedConversation.photo_url && <AvatarImage src={selectedConversation.photo_url} />}
                  <AvatarFallback className="bg-blue-100 text-blue-700">
                    {(selectedConversation.first_name?.[0] || '?').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {selectedConversation.first_name || selectedConversation.username || 'User'}
                    {selectedConversation.last_name ? ` ${selectedConversation.last_name}` : ''}
                  </p>
                  {selectedConversation.username && (
                    <p className="text-xs text-blue-600 truncate">@{selectedConversation.username}</p>
                  )}
                  <p className="text-xs text-gray-500 font-mono">ID: {selectedConversation.user_id || selectedConversation.telegram_chat_id}</p>
                </div>
              </div>

              <Separator />

              {/* Flow Answers */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-purple-600" />
                  <h4 className="font-semibold text-xs text-gray-700 uppercase tracking-wide">Flow Answers</h4>
                </div>

                {loadingFlows ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : flowSessions.length > 0 ? (
                  <div className="space-y-3">
                    {flowSessions.map((session) => (
                      <div key={session.id} className="border rounded-lg p-3 bg-purple-50/50">
                        <p className="font-semibold text-xs text-purple-900 mb-2">
                          {session.flow_name || session.flow_id}
                        </p>
                        {session.questions && session.questions.length > 0 ? (
                          <div className="space-y-2">
                            {session.questions.map((q, i) => (
                              <div key={i} className="text-xs">
                                <p className="text-gray-600 mb-0.5">• {q.question}</p>
                                <p className="text-purple-700 font-medium pl-3">
                                  → {typeof q.answer === 'string' ? q.answer : JSON.stringify(q.answer)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 italic">No answers yet</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic py-4 text-center">
                    No flow responses yet
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
