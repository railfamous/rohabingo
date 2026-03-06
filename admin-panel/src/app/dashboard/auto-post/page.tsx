'use client';

import { useEffect, useState } from 'react';
import {
    getBotChats,
    BotChat,
    getWebsiteMonitors,
    createWebsiteMonitor,
    updateWebsiteMonitor,
    deleteWebsiteMonitor,
    triggerWebsiteCheck,
    previewWebsiteMedia,
    WebsiteMonitor,
    PreviewMediaItem,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Globe, Plus, Trash2, RefreshCw, Loader2, Clock, AlertCircle, CheckCircle2, Image as ImageIcon, Video, Eye, XCircle, Play } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default function AutoPostPage() {
    const [loading, setLoading] = useState(false);
    const [monitors, setMonitors] = useState<WebsiteMonitor[]>([]);
    const [botChats, setBotChats] = useState<BotChat[]>([]);

    // Form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingMonitor, setEditingMonitor] = useState<WebsiteMonitor | null>(null);
    const [formName, setFormName] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formInterval, setFormInterval] = useState('60');
    const [formMediaTypes, setFormMediaTypes] = useState<string[]>(['video', 'image']);
    const [formTargetChats, setFormTargetChats] = useState<number[]>([]);
    const [formCssSelector, setFormCssSelector] = useState('');
    const [formCaptionTemplate, setFormCaptionTemplate] = useState('');
    const [formIsActive, setFormIsActive] = useState(true);

    // Preview state
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewMedia, setPreviewMedia] = useState<PreviewMediaItem[]>([]);
    const [showPreview, setShowPreview] = useState(false);

    // Check state
    const [checkingId, setCheckingId] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const [monitorsRes, chatsRes] = await Promise.all([
                getWebsiteMonitors(),
                getBotChats(),
            ]);
            setMonitors(monitorsRes.monitors || []);
            setBotChats(chatsRes.chats || []);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const resetForm = () => {
        setFormName('');
        setFormUrl('');
        setFormInterval('60');
        setFormMediaTypes(['video', 'image']);
        setFormTargetChats([]);
        setFormCssSelector('');
        setFormCaptionTemplate('');
        setFormIsActive(true);
        setEditingMonitor(null);
        setPreviewMedia([]);
    };

    const handlePreview = async () => {
        if (!formUrl) {
            toast.error('Please enter a URL first');
            return;
        }
        setPreviewLoading(true);
        try {
            const result = await previewWebsiteMedia(formUrl, formMediaTypes, formCssSelector || null);
            setPreviewMedia(result.media || []);
            setShowPreview(true);
            toast.success(`Found ${result.total_found} media items`);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || e?.message || 'Failed to preview URL');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formName || !formUrl) {
            toast.error('Name and URL are required');
            return;
        }
        if (formTargetChats.length === 0) {
            toast.error('Select at least one target chat');
            return;
        }

        setLoading(true);
        try {
            const data = {
                name: formName,
                website_url: formUrl,
                check_interval_minutes: parseInt(formInterval) || 60,
                media_types: formMediaTypes,
                target_chat_ids: formTargetChats,
                css_selector: formCssSelector || null,
                caption_template: formCaptionTemplate,
                is_active: formIsActive,
            };

            if (editingMonitor) {
                await updateWebsiteMonitor(editingMonitor.id, data);
                toast.success('Monitor updated');
            } else {
                await createWebsiteMonitor(data);
                toast.success('Monitor created');
            }

            resetForm();
            setShowAddForm(false);
            await load();
        } catch (e: any) {
            toast.error(e?.response?.data?.message || e?.message || 'Failed to save');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this monitor?')) return;
        try {
            await deleteWebsiteMonitor(id);
            toast.success('Monitor deleted');
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Failed to delete');
        }
    };

    const handleCheck = async (id: number) => {
        setCheckingId(id);
        try {
            const result = await triggerWebsiteCheck(id);
            toast.success(`Found ${result.total_found} items, ${result.new_media} new`);
            await load();
        } catch (e: any) {
            toast.error(e?.response?.data?.message || e?.message || 'Check failed');
        } finally {
            setCheckingId(null);
        }
    };

    const handleEdit = (monitor: WebsiteMonitor) => {
        setEditingMonitor(monitor);
        setFormName(monitor.name);
        setFormUrl(monitor.website_url);
        setFormInterval(String(monitor.check_interval_minutes));
        setFormMediaTypes(monitor.media_types || ['video', 'image']);
        setFormTargetChats(monitor.target_chat_ids || []);
        setFormCssSelector(monitor.css_selector || '');
        setFormCaptionTemplate(monitor.caption_template || '');
        setFormIsActive(monitor.is_active);
        setShowAddForm(true);
    };

    const handleToggleActive = async (monitor: WebsiteMonitor) => {
        try {
            await updateWebsiteMonitor(monitor.id, { is_active: !monitor.is_active });
            toast.success(monitor.is_active ? 'Monitor paused' : 'Monitor activated');
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Failed to update');
        }
    };

    const toggleMediaType = (type: string) => {
        setFormMediaTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    const toggleTargetChat = (chatId: number) => {
        setFormTargetChats(prev =>
            prev.includes(chatId)
                ? prev.filter(id => id !== chatId)
                : [...prev, chatId]
        );
    };

    const getChatName = (chatId: number) => {
        const chat = botChats.find(c => c.chat_id === chatId);
        return chat?.title || chat?.username || String(chatId);
    };

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Globe className="w-6 h-6" />
                        Auto Post from Websites
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Monitor websites for new videos/images and automatically post to your channels
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={load} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button onClick={() => { resetForm(); setShowAddForm(true); }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Monitor
                    </Button>
                </div>
            </div>

            {/* Add/Edit Form Dialog */}
            <Dialog open={showAddForm} onOpenChange={(open) => { if (!open) { resetForm(); } setShowAddForm(open); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingMonitor ? 'Edit Monitor' : 'Add Website Monitor'}</DialogTitle>
                        <DialogDescription>
                            Configure a website to monitor for new media content
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input
                                    placeholder="My News Site"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Check Interval (minutes)</Label>
                                <Select value={formInterval} onValueChange={setFormInterval}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">1 minute (testing)</SelectItem>
                                        <SelectItem value="5">5 minutes</SelectItem>
                                        <SelectItem value="15">15 minutes</SelectItem>
                                        <SelectItem value="30">30 minutes</SelectItem>
                                        <SelectItem value="60">1 hour</SelectItem>
                                        <SelectItem value="120">2 hours</SelectItem>
                                        <SelectItem value="360">6 hours</SelectItem>
                                        <SelectItem value="720">12 hours</SelectItem>
                                        <SelectItem value="1440">24 hours</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Website URL</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="https://example.com/gallery"
                                    value={formUrl}
                                    onChange={(e) => setFormUrl(e.target.value)}
                                    className="flex-1"
                                />
                                <Button variant="outline" onClick={handlePreview} disabled={previewLoading}>
                                    {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                                    <span className="ml-2">Preview</span>
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>CSS Selector (optional)</Label>
                            <Input
                                placeholder=".gallery-container, #content"
                                value={formCssSelector}
                                onChange={(e) => setFormCssSelector(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Limit scraping to a specific part of the page</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Media Types to Extract</Label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox
                                        checked={formMediaTypes.includes('video')}
                                        onCheckedChange={() => toggleMediaType('video')}
                                    />
                                    <Video className="w-4 h-4" />
                                    <span>Videos</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox
                                        checked={formMediaTypes.includes('image')}
                                        onCheckedChange={() => toggleMediaType('image')}
                                    />
                                    <ImageIcon className="w-4 h-4" />
                                    <span>Images</span>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Target Chats/Channels</Label>
                            <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
                                {botChats.length === 0 ? (
                                    <p className="text-sm text-muted-foreground p-2">No chats available. Make sure the bot is added to groups/channels.</p>
                                ) : (
                                    botChats.map(chat => (
                                        <label key={chat.chat_id} className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer">
                                            <Checkbox
                                                checked={formTargetChats.includes(chat.chat_id)}
                                                onCheckedChange={() => toggleTargetChat(chat.chat_id)}
                                            />
                                            <span className="text-sm">
                                                {chat.title || chat.username || chat.chat_id}
                                                <span className="text-muted-foreground ml-2 text-xs">({chat.chat_type})</span>
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>
                            {formTargetChats.length > 0 && (
                                <p className="text-xs text-muted-foreground">{formTargetChats.length} chat(s) selected</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Caption Template (optional)</Label>
                            <Input
                                placeholder="New post: {title}"
                                value={formCaptionTemplate}
                                onChange={(e) => setFormCaptionTemplate(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Use {'{title}'} to include the media title</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                checked={formIsActive}
                                onCheckedChange={setFormIsActive}
                            />
                            <Label>Active</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { resetForm(); setShowAddForm(false); }}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={loading}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {editingMonitor ? 'Update' : 'Create'} Monitor
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Preview Media ({previewMedia.length} items)</DialogTitle>
                        <DialogDescription>
                            Media found on the website that would be posted
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
                        {previewMedia.map((item, idx) => (
                            <div key={idx} className="border rounded-lg overflow-hidden">
                                {item.type === 'image' ? (
                                    <img src={item.url} alt={item.title} className="w-full h-32 object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png'; }} />
                                ) : (
                                    <div className="w-full h-32 bg-muted flex items-center justify-center">
                                        <Video className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="p-2">
                                    <p className="text-xs truncate">{item.title || 'No title'}</p>
                                    <p className="text-xs text-muted-foreground truncate">{item.type}</p>
                                </div>
                            </div>
                        ))}
                        {previewMedia.length === 0 && (
                            <p className="col-span-3 text-center text-muted-foreground py-8">No media found</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Monitors List */}
            <Card>
                <CardHeader>
                    <CardTitle>Website Monitors</CardTitle>
                    <CardDescription>
                        {monitors.length} monitor(s) configured
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading && monitors.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                    ) : monitors.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No monitors configured yet</p>
                            <Button className="mt-4" onClick={() => setShowAddForm(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add your first monitor
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>URL</TableHead>
                                    <TableHead>Interval</TableHead>
                                    <TableHead>Targets</TableHead>
                                    <TableHead>Last Check</TableHead>
                                    <TableHead>Posts</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monitors.map(monitor => (
                                    <TableRow key={monitor.id}>
                                        <TableCell>
                                            <button onClick={() => handleToggleActive(monitor)} className="cursor-pointer">
                                                {monitor.is_active ? (
                                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                ) : (
                                                    <XCircle className="w-5 h-5 text-muted-foreground" />
                                                )}
                                            </button>
                                        </TableCell>
                                        <TableCell className="font-medium">{monitor.name}</TableCell>
                                        <TableCell>
                                            <a href={monitor.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-[200px] block">
                                                {monitor.website_url}
                                            </a>
                                        </TableCell>
                                        <TableCell>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {monitor.check_interval_minutes}m
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm">
                                                {monitor.target_chat_ids?.length || 0} chat(s)
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {monitor.last_checked_at ? (
                                                <div>
                                                    <span className="text-sm">{formatDistanceToNow(new Date(monitor.last_checked_at))} ago</span>
                                                    {monitor.last_error && (
                                                        <div className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                                            <AlertCircle className="w-3 h-3" />
                                                            Error
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">Never</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm font-medium">{monitor.total_posts || 0}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleCheck(monitor.id)}
                                                    disabled={checkingId === monitor.id}
                                                >
                                                    {checkingId === monitor.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Play className="w-4 h-4" />
                                                    )}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleEdit(monitor)}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleDelete(monitor.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
