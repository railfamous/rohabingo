'use client';

import { useState } from 'react';
import { uploadFile, broadcastMedia, generateAIText } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Send, Image as ImageIcon, Video, UploadCloud, CheckCircle2, AlertCircle, Loader2, Sparkles, X } from 'lucide-react';

export default function BroadcastPage() {
  const [message, setMessage] = useState<string>('');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  // AI Generation State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedText, setAiGeneratedText] = useState('');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      // Basic validation
      if (mediaType === 'photo' && !file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (mediaType === 'video' && !file.type.startsWith('video/')) {
        toast.error('Please select a video file');
        return;
      }

      const up = await uploadFile(file, 'broadcast');
      setMediaUrl(up.url);
      toast.success('Media uploaded successfully');
    } catch {
      toast.error('Media upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSend = async () => {
    if (!message && !mediaUrl) {
      toast.error('Please enter a message or upload media');
      return;
    }

    try {
      setSending(true);
      const res = await broadcastMedia({
        message,
        media_type: mediaUrl ? mediaType : undefined,
        media_url: mediaUrl || undefined,
      });

      toast.success(`Broadcast sent!`, {
        description: `Sent to ${res.sent} users. Failed: ${res.failed}`
      });

      // Reset form
      setMessage('');
      setMediaUrl('');
    } catch {
      toast.error('Broadcast failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Broadcast</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Send announcements, updates, or promotional content to all your bot subscribers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-500" />
                Compose Message
              </CardTitle>
              <CardDescription>
                Write your message below. You can include text, media, or both.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Message Text</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`gap-1.5 ${showAIModal ? 'bg-purple-100 text-purple-600' : 'text-gray-500 hover:text-purple-600 hover:bg-purple-50'}`}
                    onClick={() => setShowAIModal(!showAIModal)}
                  >
                    <Sparkles className="w-4 h-4" />
                    AI Generate
                  </Button>
                </div>

                {/* AI Modal */}
                {showAIModal && (
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100 animate-in slide-in-from-top-2 mb-2">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span className="font-semibold text-sm text-purple-700">AI Text Generator</span>
                      </div>
                      <button onClick={() => { setShowAIModal(false); setAiPrompt(''); setAiGeneratedText(''); }} className="p-1 hover:bg-purple-100 rounded-full">
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>

                    {!aiGeneratedText ? (
                      <div className="space-y-3">
                        <textarea
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="Describe your broadcast... (e.g., 'Write an announcement about a new feature' or 'Create a promotional message for a 20% discount')"
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                          rows={2}
                          autoFocus
                        />
                        <Button
                          onClick={async () => {
                            if (!aiPrompt.trim()) return;
                            setAiGenerating(true);
                            try {
                              const result = await generateAIText(aiPrompt, {
                                system_prompt: 'You are a marketing assistant helping to write broadcast messages for a Telegram bot. Write engaging, concise messages that grab attention. Keep messages under 200 words unless specifically asked for longer content. Do not use markdown formatting.'
                              });
                              setAiGeneratedText(result.text);
                            } catch (err: any) {
                              toast.error(err?.response?.data?.message || err?.message || 'Failed to generate text');
                            } finally {
                              setAiGenerating(false);
                            }
                          }}
                          disabled={!aiPrompt.trim() || aiGenerating}
                          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                        >
                          {aiGenerating ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
                          ) : (
                            <><Sparkles className="w-4 h-4 mr-2" /> Generate</>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-white p-3 rounded-lg border text-sm whitespace-pre-wrap max-h-40 overflow-auto">
                          {aiGeneratedText}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setAiGeneratedText('')}
                          >
                            Try Again
                          </Button>
                          <Button
                            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                            onClick={() => {
                              setMessage((prev) => prev ? prev + '\n\n' + aiGeneratedText : aiGeneratedText);
                              setShowAIModal(false);
                              setAiPrompt('');
                              setAiGeneratedText('');
                              toast.success('Text inserted!');
                            }}
                          >
                            Insert Text
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  placeholder="Hello! We have an exciting update for you..."
                  className="resize-y min-h-[150px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Media Attachment (Optional)</Label>
                <div className="bg-gray-50 border rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-4">
                    <Select value={mediaType} onValueChange={(v: any) => setMediaType(v)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="photo">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" /> Photo
                          </div>
                        </SelectItem>
                        <SelectItem value="video">
                          <div className="flex items-center gap-2">
                            <Video className="w-4 h-4" /> Video
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex-1">
                      <Input
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        placeholder="https://..."
                        className="bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <label className={`
                      flex flex-col items-center gap-2 cursor-pointer 
                      border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/50 
                      rounded-xl px-12 py-8 transition-all w-full
                      ${uploading ? 'opacity-50 pointer-events-none' : ''}
                    `}>
                      {uploading ? (
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      ) : (
                        <UploadCloud className="w-8 h-8 text-gray-400" />
                      )}
                      <span className="text-sm font-medium text-gray-600">
                        {uploading ? 'Uploading...' : 'Click to upload from device'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {mediaType === 'photo' ? 'JPG, PNG, WEBP' : 'MP4, MOV'}
                      </span>
                      <input
                        type="file"
                        accept={mediaType === 'photo' ? 'image/*' : 'video/*'}
                        className="hidden"
                        onChange={handleUpload}
                      />
                    </label>
                  </div>

                  {mediaUrl && (
                    <div className="mt-2 text-xs text-green-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Media ready to send
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  onClick={handleSend}
                  disabled={sending || (!message && !mediaUrl)}
                  className="pl-4 pr-6"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Broadcast Now
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-blue-50/50 border-blue-100">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-blue-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-blue-700 space-y-2">
              <p>• Short and catchy messages work best.</p>
              <p>• Avoid sending too frequently to prevent users from blocking the bot.</p>
              <p>• Images usually increase engagement rates.</p>
            </CardContent>
          </Card>

          {/* Placeholder for Stats or Recent History if existed */}
        </div>
      </div>
    </div>
  );
}
