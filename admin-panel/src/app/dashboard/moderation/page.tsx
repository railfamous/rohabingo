'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createScheduledPost,
  createBulkScheduledPost, // Added
  deleteScheduledPost,
  getBotChats,
  BotChat,
  getGlobalModeration,
  getModerationSettings,
  upsertModerationSetting,
  ModerationSetting,
  getScheduledPosts,
  ScheduledPost,
  uploadFile,
  bulkUpsertModerationSetting,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Shield, Clock, Plus, Trash2, Calendar, Image as ImageIcon, Video, UploadCloud, Loader2, Save, RefreshCw, CheckCircle2, ChevronsUpDown, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

export default function ModerationPage() {
  const [loading, setLoading] = useState(false);

  // Destination (Multi-select). Format: "chatId:chatType"
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [openCombobox, setOpenCombobox] = useState(false);

  // This determines which chat's settings are currently SHOWN in the form.
  // When multiple are selected, this tracks the most recently clicked (or first).
  const [modChatDest, setModChatDest] = useState('');
  const [modSettingsMap, setModSettingsMap] = useState<Record<number, ModerationSetting>>({});

  const [enabled, setEnabled] = useState(true);
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeText, setWelcomeText] = useState('');
  const [deleteLinks, setDeleteLinks] = useState(true);
  const [autoMute, setAutoMute] = useState(false);

  // Store auto-mute duration as seconds for backend, but edit as value + unit in UI.
  const [autoMuteSeconds, setAutoMuteSeconds] = useState(3600);
  const [autoMuteDurationValue, setAutoMuteDurationValue] = useState('60');
  const [autoMuteDurationUnit, setAutoMuteDurationUnit] = useState<'seconds' | 'minutes' | 'hours'>('minutes');

  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [botChats, setBotChats] = useState<BotChat[]>([]);

  // Schedule form
  const [scheduleType, setScheduleType] = useState<'text' | 'photo' | 'video'>('text');
  const [scheduleText, setScheduleText] = useState('');

  const [scheduleMediaUrl, setScheduleMediaUrl] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);

  const [scheduleAt, setScheduleAt] = useState('');

  const secondsToUi = (secs: number) => {
    const s = Number(secs || 0);
    if (!s || s < 60) return { value: s || 0, unit: 'seconds' as const };
    if (s % 3600 === 0) return { value: s / 3600, unit: 'hours' as const };
    if (s % 60 === 0) return { value: s / 60, unit: 'minutes' as const };
    return { value: s, unit: 'seconds' as const };
  };

  const parseNonNegativeInt = (raw: string) => {
    if (raw.trim() === '') return 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  };

  const uiToSeconds = (value: string, unit: 'seconds' | 'minutes' | 'hours') => {
    const v = parseNonNegativeInt(value);
    if (unit === 'hours') return v * 3600;
    if (unit === 'minutes') return v * 60;
    return v;
  };

  const load = async () => {
    setLoading(true);
    try {
      const g = await getGlobalModeration();
      const c = g.config || {};

      setEnabled(c.enabled !== false);
      setWelcomeEnabled(!!c.welcome_enabled);
      setWelcomeText(String(c.welcome_text || ''));
      setDeleteLinks(!!c.delete_links_enabled);
      setAutoMute(!!c.auto_mute_enabled);
      {
        const secs = Number(c.auto_mute_seconds || 3600);
        setAutoMuteSeconds(secs);
        const ui = secondsToUi(secs);
        setAutoMuteDurationValue(String(ui.value));
        setAutoMuteDurationUnit(ui.unit);
      }

      const [p, chats, perChat] = await Promise.all([getScheduledPosts(), getBotChats(), getModerationSettings()]);
      setPosts(p.posts || []);

      const filteredChats = (chats.chats || []).filter((x) => x.chat_type === 'group' || x.chat_type === 'supergroup' || x.chat_type === 'channel');
      setBotChats(filteredChats);

      const m: Record<number, ModerationSetting> = {};
      for (const s of perChat.settings || []) m[Number(s.chat_id)] = s;
      setModSettingsMap(m);

      if (!modChatDest && filteredChats.length > 0) {
        const c0 = filteredChats[0];
        const val = `${c0.chat_id}:${c0.chat_type}`;
        setModChatDest(val);
        // Default to selecting the first one
        if (selectedChats.length === 0) setSelectedChats([val]);
      }
    } catch (e: any) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!modChatDest) return;
    const [chatIdRaw] = modChatDest.split(':');
    const chatId = Number(chatIdRaw);
    if (!chatId) return;

    const s = modSettingsMap[chatId];
    if (!s) {
      // Reset to defaults or keep current globals if no specific settings found?
      // Actually good UX is to keep the "Global Defaults" visible if no override exists.
      return;
    }

    setEnabled(s.enabled !== false);
    setWelcomeEnabled(!!s.welcome_enabled);
    setWelcomeText(String(s.welcome_text || ''));
    setDeleteLinks(!!s.delete_links_enabled);
    setAutoMute(!!s.auto_mute_enabled);
    {
      const secs = Number(s.auto_mute_seconds || 3600);
      setAutoMuteSeconds(secs);
      const ui = secondsToUi(secs);
      setAutoMuteDurationValue(String(ui.value));
      setAutoMuteDurationUnit(ui.unit);
    }
  }, [modChatDest, modSettingsMap]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Group & Channel Management</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Configure moderation rules and schedule posts for your communities.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Moderation Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600">
                <Shield className="w-5 h-5" />
                Moderation Rules
              </CardTitle>
              <CardDescription>
                Set rules for a specific group or channel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Destination Chat</Label>
                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCombobox}
                      className="w-full justify-between"
                    >
                      {selectedChats.length > 0
                        ? `${selectedChats.length} chat(s) selected`
                        : "Select groups/channels..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search chat..." />
                      <CommandList>
                        <CommandEmpty>No chat found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => {
                              if (selectedChats.length === botChats.length) {
                                setSelectedChats([]);
                              } else {
                                const all = botChats.map(c => `${c.chat_id}:${c.chat_type}`);
                                setSelectedChats(all);
                                if (all.length > 0) setModChatDest(all[0]);
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={botChats.length > 0 && selectedChats.length === botChats.length}
                                onCheckedChange={() => { }} // handled by CommandItem
                              />
                              <span>Select All ({botChats.length})</span>
                            </div>
                          </CommandItem>
                          {botChats.map((chat) => {
                            const val = `${chat.chat_id}:${chat.chat_type}`;
                            return (
                              <CommandItem
                                key={chat.chat_id}
                                value={chat.title || String(chat.chat_id)}
                                onSelect={() => {
                                  const isSelected = selectedChats.includes(val);
                                  let newSelected;
                                  if (isSelected) {
                                    newSelected = selectedChats.filter((x) => x !== val);
                                  } else {
                                    newSelected = [...selectedChats, val];
                                    setModChatDest(val);
                                  }
                                  setSelectedChats(newSelected);
                                }}
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <Checkbox
                                    checked={selectedChats.includes(val)}
                                    onCheckedChange={() => { }}
                                  />
                                  <span className="truncate">{chat.title || chat.username || chat.chat_id}</span>
                                  {val === modChatDest && <span className="ml-auto text-xs text-blue-500 font-mono">EDITING</span>}
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">The bot must be an Admin in the chat to enforce these rules.</p>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div className="space-y-0.5">
                  <Label>Enable Moderation</Label>
                  <div className="text-xs text-muted-foreground">Master switch for this chat</div>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div className="space-y-0.5">
                  <Label>Welcome New Members</Label>
                  <div className="text-xs text-muted-foreground">Send a message when users join</div>
                </div>
                <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
              </div>

              {welcomeEnabled && (
                <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                  <Label className="mb-2 block">Welcome Message (HTML supported)</Label>
                  <Textarea
                    value={welcomeText}
                    onChange={(e) => setWelcomeText(e.target.value)}
                    rows={3}
                    placeholder="Welcome <b>{name}</b> to our group!"
                    className="font-mono text-sm"
                  />
                </div>
              )}

              <div className="flex items-center justify-between border-t pt-4">
                <div className="space-y-0.5">
                  <Label>Delete Links</Label>
                  <div className="text-xs text-muted-foreground">Remove messages containing URLs</div>
                </div>
                <Switch checked={deleteLinks} onCheckedChange={setDeleteLinks} />
              </div>

              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Mute Sender</Label>
                    <div className="text-xs text-muted-foreground">Mute users who post links</div>
                  </div>
                  <Switch checked={autoMute} onCheckedChange={setAutoMute} />
                </div>

                {autoMute && (
                  <div className="flex items-end gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex-1">
                      <Label className="mb-1.5 block text-xs">Duration Value</Label>
                      <Input
                        type="number"
                        min="1"
                        value={autoMuteDurationValue}
                        onChange={(e) => setAutoMuteDurationValue(e.target.value)}
                      />
                    </div>
                    <div className="w-[120px]">
                      <Label className="mb-1.5 block text-xs">Unit</Label>
                      <Select value={autoMuteDurationUnit} onValueChange={(v: any) => setAutoMuteDurationUnit(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="seconds">Seconds</SelectItem>
                          <SelectItem value="minutes">Minutes</SelectItem>
                          <SelectItem value="hours">Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <Button className="w-full mt-4" disabled={loading} onClick={async () => {
                try {
                  if (selectedChats.length === 0) { toast.error('Select at least one chat target'); return; }

                  const chatIds = selectedChats.map(s => Number(s.split(':')[0]));

                  const seconds = uiToSeconds(autoMuteDurationValue, autoMuteDurationUnit);
                  const clampedSeconds = autoMute ? Math.max(30, seconds) : seconds;

                  const payload: Partial<ModerationSetting> = {
                    enabled,
                    welcome_enabled: welcomeEnabled,
                    welcome_text: welcomeText,
                    delete_links_enabled: deleteLinks,
                    auto_mute_enabled: autoMute,
                    auto_mute_seconds: clampedSeconds,
                  };

                  setLoading(true);
                  const r = await bulkUpsertModerationSetting(chatIds, payload);

                  toast.success(`Rules saved for ${r.count} chat(s)`);
                  await load(); // Reload to refresh map and ensure consistency
                } catch (e) {
                  console.error(e);
                  toast.error('Failed to save rules');
                } finally {
                  setLoading(false);
                }
              }}>
                <Save className="w-4 h-4 mr-2" />
                Save Rules to {selectedChats.length} Chat(s)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Scheduling Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-600">
                <Clock className="w-5 h-5" />
                Schedule Post
              </CardTitle>
              <CardDescription>
                Queue content to be sent automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Destination</Label>
                <div className="p-2 border rounded-md bg-muted/50 text-sm text-muted-foreground flex justify-between items-center">
                  <span>
                    {selectedChats.length > 0
                      ? `${selectedChats.length} chat(s) selected via Moderation card`
                      : 'No chats selected (select in Moderation card)'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Tip: Use the selector in the "Moderation Rules" card to choose targets.</p>
              </div>

              <div className="space-y-2">
                <Label>Content Type</Label>
                <Select value={scheduleType} onValueChange={(v: any) => setScheduleType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text Only</SelectItem>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Message / Caption</Label>
                <Textarea
                  value={scheduleText}
                  onChange={(e) => setScheduleText(e.target.value)}
                  placeholder="What's happening?"
                  rows={3}
                />
              </div>

              {(scheduleType !== 'text') && (
                <div className="p-3 bg-gray-50 border rounded-lg space-y-3">
                  <div className="flex items-center gap-3">
                    <Input
                      value={scheduleMediaUrl}
                      onChange={(e) => setScheduleMediaUrl(e.target.value)}
                      placeholder="Media URL or Upload"
                      className="bg-white"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => mediaFileInputRef.current?.click()}
                      disabled={uploadingMedia}
                    >
                      {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    </Button>
                    <input
                      ref={mediaFileInputRef}
                      type="file"
                      hidden
                      accept={scheduleType === 'photo' ? "image/*" : "video/*"}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          setUploadingMedia(true);
                          const r = await uploadFile(f, 'scheduled');
                          setScheduleMediaUrl(r.url);
                          toast.success('Uploaded!');
                        } catch {
                          toast.error('Upload failed');
                        } finally {
                          setUploadingMedia(false);
                        }
                      }}
                    />
                  </div>
                  {scheduleMediaUrl && (
                    <div className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Ready
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Send At (Local Time)</Label>
                <Input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
              </div>

              <Button className="w-full bg-purple-600 hover:bg-purple-700" disabled={loading} onClick={async () => {
                try {
                  if (selectedChats.length === 0) { toast.error('Select at least one destination in Moderation card'); return; }
                  if (!scheduleAt) { toast.error('Select time'); return; }

                  const chatIds = selectedChats.map(s => Number(s.split(':')[0]));

                  setLoading(true);
                  await createBulkScheduledPost({
                    chat_ids: chatIds,
                    content_type: scheduleType,
                    text: scheduleText,
                    media_url: scheduleMediaUrl,
                    send_at: new Date(scheduleAt).toISOString()
                  });

                  toast.success(`Post scheduled for ${chatIds.length} chat(s)!`);
                  await load();
                  setScheduleText('');
                  setScheduleMediaUrl('');
                  setScheduleAt('');
                } catch {
                  toast.error('Failed to schedule post');
                } finally {
                  setLoading(false);
                }
              }}>
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Post to {selectedChats.length} Chat(s)
              </Button>
            </CardContent>
          </Card>

          {/* Jobs List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700">Scheduled Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {posts.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">No pending posts</div>
              ) : (
                <div className="space-y-3">
                  {posts.map(p => (
                    <div key={p.id} className="flex items-start justify-between p-3 border rounded-lg bg-gray-50/50">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-gray-700">
                          To: {p.chat_id}
                          <span className="ml-1 px-1.5 py-0.5 bg-gray-200 rounded text-[10px] text-gray-600">{p.chat_type}</span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(p.send_at), 'MMM d, h:mm a')}
                        </div>
                        {p.error && <div className="text-xs text-red-500 mt-1">Error: {p.error}</div>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={async () => {
                        await deleteScheduledPost(p.id);
                        load();
                      }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
