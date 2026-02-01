'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, DollarSign, Crown, MessageCircle, ArrowUp, ArrowDown, Eye, EyeOff, Trash2, Plus, Image as ImageIcon, Video, Link as LinkIcon, Type, Workflow } from 'lucide-react';

import { motion } from 'framer-motion';
import {
  Setting,
  getSettings,
  bulkUpdateSettings,
  uploadFile,
  getOnboardingQuestions,
  createOnboardingQuestion,
  updateOnboardingQuestion,
  deleteOnboardingQuestion,
  getOnboardingAnswers,
  getWelcomeBlocks,
  saveWelcomeBlocks,
  WelcomeBlock,
  WelcomeBlockType,
  OnboardingQuestion,
  OnboardingAnswer,
  getFlows
} from '@/lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [activeTab, setActiveTab] = useState<'points' | 'premium' | 'welcome' | 'languages' | 'onboarding'>('welcome');

  const [supportedLanguages, setSupportedLanguages] = useState<string>('');
  const [defaultLanguage, setDefaultLanguage] = useState<string>('en');
  const [welcomeText, setWelcomeText] = useState<string>('');
  const [welcomeImageUrl, setWelcomeImageUrl] = useState<string>('');
  const [welcomeVideoUrl, setWelcomeVideoUrl] = useState<string>('');

  // New Welcome Builder (ordered blocks)
  const [welcomeBlocks, setWelcomeBlocks] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);

  const [onboardingQuestions, setOnboardingQuestions] = useState<OnboardingQuestion[]>([]);
  const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswer[]>([]);
  const [newQuestionCode, setNewQuestionCode] = useState('profile_name');
  const [newQuestionType, setNewQuestionType] = useState<'text' | 'single_choice'>('text');
  const [newQuestionTextEn, setNewQuestionTextEn] = useState('What is your name?');
  const [newQuestionOptions, setNewQuestionOptions] = useState<string>(''); // one option per line: key=Label
  const [newQuestionRequired, setNewQuestionRequired] = useState(true);
  const [newQuestionSortOrder, setNewQuestionSortOrder] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  useEffect(() => {
    fetchSettings();

    // Load welcome blocks
    (async () => {
      try {
        const wb = await getWelcomeBlocks();
        setWelcomeBlocks(wb.blocks || []);

        const f = await getFlows();
        setFlows(f.flows || []);
      } catch {
        // ignore if not configured
      }
    })();

    // Load onboarding data in background
    (async () => {
      try {
        const q = await getOnboardingQuestions();
        setOnboardingQuestions(q.questions);
        const a = await getOnboardingAnswers();
        setOnboardingAnswers(a.answers);
      } catch (e) {
        // ignore if not configured
      }
    })();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await getSettings();
      setSettings(response.settings);

      const map = new Map(response.settings.map(s => [s.key, String(s.value ?? '')]));
      setSupportedLanguages(map.get('supported_languages') || '[]');
      setDefaultLanguage(map.get('default_language') || 'en');
      setWelcomeText(map.get('welcome_text') || '');
      setWelcomeImageUrl(map.get('welcome_image_url') || '');
      setWelcomeVideoUrl(map.get('welcome_video_url') || '');
    } catch (error) {
      console.error('Error fetching settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (key: string, newValue: string) => {
    setSettings(settings.map(setting =>
      setting.key === key ? { ...setting, value: newValue } : setting
    ));
  };

  const saveSettings = async () => {
    try {
      setSaving(true);

      // Save welcome blocks first
      try {
        const normalized: WelcomeBlock[] = (welcomeBlocks || []).map((b: any, idx: number) => ({
          sort_order: typeof b.sort_order === 'number' ? b.sort_order : idx,
          is_active: b.is_active !== false,
          block_type: b.block_type as WelcomeBlockType,
          payload: b.payload ?? {},
        }));
        await saveWelcomeBlocks(normalized);
      } catch (e) {
        // If welcome blocks fail, still allow settings save.
        console.error('Error saving welcome blocks:', e);
      }

      const extraUpdates = [
        { key: 'supported_languages', value: supportedLanguages },
        { key: 'default_language', value: defaultLanguage },
        { key: 'welcome_text', value: welcomeText },
        { key: 'welcome_image_url', value: welcomeImageUrl },
        { key: 'welcome_video_url', value: welcomeVideoUrl }
      ];

      const base = settings.map(({ key, value }) => ({ key, value }));
      const merged = [
        ...base.filter(s => !['supported_languages', 'default_language', 'welcome_text', 'welcome_image_url', 'welcome_video_url'].includes(s.key)),
        ...extraUpdates
      ];

      const updatedSettings = await bulkUpdateSettings(merged);
      setSettings(updatedSettings);

      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Welcome Messages</h1>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchSettings}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={saveSettings}
            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
            disabled={saving}
          >
            <Save className="h-4 w-4" />
            Save Changes
          </motion.button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <ul className="flex flex-wrap -mb-px">
          <li className="mr-2">
            <button
              onClick={() => setActiveTab('welcome')}
              className={`inline-block p-4 border-b-2 ${activeTab === 'welcome'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
                } rounded-t-lg`}
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Welcome
              </div>
            </button>
          </li>

        </ul>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Welcome (Legacy + Builder) */}
      {activeTab === 'welcome' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Welcome Flow</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium flex items-center gap-2 transition-colors"
                  onClick={() => {
                    const nextSort = (welcomeBlocks?.length || 0);
                    setWelcomeBlocks([
                      ...(welcomeBlocks || []),
                      { sort_order: nextSort, is_active: true, block_type: 'text', payload: { text: '' } }
                    ]);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Add Text
                </button>
                <div className="relative group">
                  <button className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium flex items-center gap-2 transition-colors">
                    <Plus className="w-4 h-4" />
                    More
                  </button>
                  <div className="absolute right-0 mt-1 w-40 bg-white border rounded-lg shadow-xl hidden group-hover:block z-10 overflow-hidden">
                    <button
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700"
                      onClick={() => {
                        const nextSort = (welcomeBlocks?.length || 0);
                        setWelcomeBlocks([...(welcomeBlocks || []), { sort_order: nextSort, is_active: true, block_type: 'image', payload: { url: '', caption: '' } }]);
                      }}
                    >
                      <ImageIcon className="w-4 h-4 text-blue-500" />
                      Image
                    </button>
                    <button
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700"
                      onClick={() => {
                        const nextSort = (welcomeBlocks?.length || 0);
                        setWelcomeBlocks([...(welcomeBlocks || []), { sort_order: nextSort, is_active: true, block_type: 'video', payload: { url: '', caption: '' } }]);
                      }}
                    >
                      <Video className="w-4 h-4 text-red-500" />
                      Video
                    </button>
                    <button
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700"
                      onClick={() => {
                        const nextSort = (welcomeBlocks?.length || 0);
                        setWelcomeBlocks([...(welcomeBlocks || []), { sort_order: nextSort, is_active: true, block_type: 'link', payload: { title: 'Link', url: 'https://' } }]);
                      }}
                    >
                      <LinkIcon className="w-4 h-4 text-green-500" />
                      Link Button
                    </button>
                    <button
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700"
                      onClick={() => {
                        const nextSort = (welcomeBlocks?.length || 0);
                        setWelcomeBlocks([...(welcomeBlocks || []), { sort_order: nextSort, is_active: true, block_type: 'question_flow', payload: { slug: '' } }]);
                      }}
                    >
                      <Workflow className="w-4 h-4 text-purple-500" />
                      Flow
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {(welcomeBlocks || []).map((b: any, idx: number) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-xl border-2 transition-colors ${b.is_active !== false ? 'bg-white border-gray-100 hover:border-blue-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-md uppercase font-bold tracking-wider">
                        {b.block_type}
                      </span>
                      <span className="text-xs text-gray-400">#{idx + 1}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                        disabled={idx === 0}
                        onClick={() => {
                          if (idx === 0) return;
                          const copy = [...(welcomeBlocks || [])];
                          const tmp = copy[idx - 1];
                          copy[idx - 1] = copy[idx];
                          copy[idx] = tmp;
                          setWelcomeBlocks(copy);
                        }}
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                        disabled={idx === (welcomeBlocks?.length || 0) - 1}
                        onClick={() => {
                          const copy = [...(welcomeBlocks || [])];
                          if (idx >= copy.length - 1) return;
                          const tmp = copy[idx + 1];
                          copy[idx + 1] = copy[idx];
                          copy[idx] = tmp;
                          setWelcomeBlocks(copy);
                        }}
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <div className="w-px h-4 bg-gray-200 mx-1"></div>
                      <button
                        className={`p-1.5 rounded-md transition-all ${b.is_active !== false ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                        onClick={() => {
                          const copy = [...(welcomeBlocks || [])];
                          copy[idx] = { ...copy[idx], is_active: !(b.is_active !== false) };
                          setWelcomeBlocks(copy);
                        }}
                        title={b.is_active !== false ? "Active" : "Inactive"}
                      >
                        {b.is_active !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all ml-1"
                        onClick={() => {
                          const copy = [...(welcomeBlocks || [])];
                          copy.splice(idx, 1);
                          setWelcomeBlocks(copy);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Block Content Inputs */}
                  <div className="space-y-3">
                    {b.block_type === 'text' && (
                      <textarea
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        rows={3}
                        value={b.payload?.text || ''}
                        onChange={(e) => {
                          const copy = [...(welcomeBlocks || [])];
                          copy[idx] = { ...copy[idx], payload: { ...(copy[idx].payload || {}), text: e.target.value } };
                          setWelcomeBlocks(copy);
                        }}
                        placeholder="Enter welcome message... (HTML supported)"
                      />
                    )}

                    {b.block_type === 'link' && (
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          value={b.payload?.title || ''}
                          onChange={(e) => {
                            const copy = [...(welcomeBlocks || [])];
                            copy[idx] = { ...copy[idx], payload: { ...(copy[idx].payload || {}), title: e.target.value } };
                            setWelcomeBlocks(copy);
                          }}
                          placeholder="Button Label"
                        />
                        <input
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          value={b.payload?.url || ''}
                          onChange={(e) => {
                            const copy = [...(welcomeBlocks || [])];
                            copy[idx] = { ...copy[idx], payload: { ...(copy[idx].payload || {}), url: e.target.value } };
                            setWelcomeBlocks(copy);
                          }}
                          placeholder="https://example.com"
                        />
                      </div>
                    )}

                    {(b.block_type === 'image' || b.block_type === 'video') && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            className="flex-1 px-3 py-2 border rounded-lg text-sm"
                            value={b.payload?.url || ''}
                            onChange={(e) => {
                              const copy = [...(welcomeBlocks || [])];
                              copy[idx] = { ...copy[idx], payload: { ...(copy[idx].payload || {}), url: e.target.value } };
                              setWelcomeBlocks(copy);
                            }}
                            placeholder={`URL to ${b.block_type}...`}
                          />
                          <label className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer text-sm font-medium">
                            Upload
                            <input
                              type="file"
                              accept={b.block_type === 'image' ? 'image/*' : 'video/*'}
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  setSaving(true);
                                  const up = await uploadFile(file, 'welcome');
                                  const copy = [...(welcomeBlocks || [])];
                                  copy[idx] = { ...copy[idx], payload: { ...(copy[idx].payload || {}), url: up.url } };
                                  setWelcomeBlocks(copy);
                                  setMessage({ type: 'success', text: 'Upload successful' });
                                  setTimeout(() => setMessage(null), 2000);
                                } catch (err) {
                                  setMessage({ type: 'error', text: 'Upload failed' });
                                } finally {
                                  setSaving(false);
                                  e.currentTarget.value = '';
                                }
                              }}
                            />
                          </label>
                        </div>
                        <input
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          value={b.payload?.caption || ''}
                          onChange={(e) => {
                            const copy = [...(welcomeBlocks || [])];
                            copy[idx] = { ...copy[idx], payload: { ...(copy[idx].payload || {}), caption: e.target.value } };
                            setWelcomeBlocks(copy);
                          }}
                          placeholder="Media caption (HTML supported)"
                        />
                      </div>
                    )}

                    {b.block_type === 'question_flow' && (
                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                        <label className="block text-xs font-semibold text-purple-700 uppercase mb-1">Trigger Flow</label>
                        <select
                          className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-white"
                          value={b.payload?.slug || ''}
                          onChange={(e) => {
                            const copy = [...(welcomeBlocks || [])];
                            copy[idx] = { ...copy[idx], payload: { ...(copy[idx].payload || {}), slug: e.target.value } };
                            setWelcomeBlocks(copy);
                          }}
                        >
                          <option value="">Select a flow...</option>
                          {flows.map(f => (
                            <option key={f.id} value={f.slug}>{f.title} ({f.slug})</option>
                          ))}
                        </select>
                        <p className="text-xs text-purple-600 mt-1">Users will enter this flow.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {(!welcomeBlocks || welcomeBlocks.length === 0) && (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 text-gray-500">
                  <p>No welcome blocks yet.</p>
                  <p className="text-sm">Add a text message or image to get started.</p>
                </div>
              )}
            </div>
          </div>

          {/* Preview Column */}
          <div className="pt-8 lg:pt-0">
            <div className="sticky top-8">
              <div className="bg-gray-900 rounded-[2.5rem] p-4 shadow-2xl border-4 border-gray-800 max-w-sm mx-auto overflow-hidden relative min-h-[600px]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 bg-gray-800 rounded-b-2xl z-20"></div>

                {/* Telegram Header */}
                <div className="bg-[#242f3d] -m-4 mb-4 p-4 pt-8 text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 to-blue-600 flex items-center justify-center text-sm font-bold">
                    B
                  </div>
                  <div>
                    <div className="font-bold text-sm">BotDash Bot</div>
                    <div className="text-xs text-blue-300">bot</div>
                  </div>
                </div>

                {/* Message Area */}
                <div className="space-y-4 pt-2 pb-20 px-1 overflow-auto h-[500px] scrollbar-hide bg-[#0e1621] -mx-1">
                  <div className="text-center text-xs text-gray-500 my-4 bg-[#182533] inline-block px-3 py-1 rounded-full mx-auto">Today</div>

                  {/* Start Command */}
                  <div className="flex justify-end pr-2">
                    <div className="bg-[#2b5278] text-white p-2 rounded-l-xl rounded-tr-xl rounded-br-none max-w-[80%] text-sm">
                      /start
                    </div>
                  </div>

                  {/* Bot Blocks */}
                  {(welcomeBlocks || []).filter((b: any) => b.is_active !== false).map((b: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-1 pl-2">
                      {/* Image/Video Block */}
                      {(b.block_type === 'image' || b.block_type === 'video') && b.payload?.url ? (
                        <div className="bg-[#182533] p-1 rounded-xl max-w-[85%] self-start border border-[#0e1621]">
                          <div className="bg-gray-700 w-full h-32 rounded-lg mb-1 relative overflow-hidden flex items-center justify-center text-gray-500 text-xs">
                            {b.payload.url.startsWith('http')
                              ? <img src={b.payload.url} alt="media" className="w-full h-full object-cover" />
                              : <span>Media Preview</span>}
                          </div>
                          {b.payload.caption && (
                            <div className="px-2 pb-1 text-sm text-white whitespace-pre-wrap">{b.payload.caption}</div>
                          )}
                        </div>
                      ) : null}

                      {/* Text Block */}
                      {b.block_type === 'text' && b.payload?.text && (
                        <div className="bg-[#182533] text-white p-3 rounded-r-xl rounded-tl-xl rounded-bl-none max-w-[85%] text-sm whitespace-pre-wrap">
                          {b.payload.text}
                        </div>
                      )}

                      {/* Link Block */}
                      {b.block_type === 'link' && b.payload?.title && (
                        <div className="bg-[#182533] text-blue-400 p-3 rounded-xl max-w-[85%] text-sm text-center font-medium border border-[#0e1621] cursor-pointer hover:bg-[#202b36]">
                          {b.payload.title} ↗
                        </div>
                      )}

                      {/* Flow Block */}
                      {b.block_type === 'question_flow' && b.payload?.slug && (
                        <div className="bg-purple-500/20 text-purple-300 p-2 rounded-xl max-w-[85%] text-xs border border-purple-500/30 flex items-center gap-2">
                          <Workflow className="w-3 h-3" />
                          <span>Triggers: <b>{flows.find(f => f.slug === b.payload.slug)?.title || b.payload.slug}</b></span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Input Area */}
                <div className="absolute bottom-4 left-4 right-4 h-12 bg-[#182533] rounded-full border border-gray-700 flex items-center px-4 text-gray-500 text-sm">
                  Message...
                </div>
              </div>
              <div className="text-center mt-4 text-gray-500 text-sm italic">
                Live Preview
              </div>
            </div>
          </div>
        </div>
      )
      }

      {/* Onboarding Tab */}
      {
        activeTab === 'onboarding' && (
          <div className="grid gap-4">
            <div className="p-4 rounded-lg bg-white shadow-sm border">
              <h3 className="text-sm font-medium text-gray-900">Create Onboarding Question</h3>

              <div className="grid gap-3 mt-3">
                <div>
                  <label className="text-sm font-medium text-gray-900">Code</label>
                  <input
                    className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    value={newQuestionCode}
                    onChange={(e) => setNewQuestionCode(e.target.value)}
                    placeholder="profile_name"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-900">Type</label>
                  <select
                    className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    value={newQuestionType}
                    onChange={(e) => setNewQuestionType(e.target.value as any)}
                  >
                    <option value="text">Text</option>
                    <option value="single_choice">Single choice</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-900">Question (English)</label>
                  <input
                    className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    value={newQuestionTextEn}
                    onChange={(e) => setNewQuestionTextEn(e.target.value)}
                    placeholder="What is your name?"
                  />
                </div>

                {newQuestionType === 'single_choice' && (
                  <div>
                    <label className="text-sm font-medium text-gray-900">Options (one per line)</label>
                    <p className="text-xs text-gray-500 mt-1">Format: key=Label (example: yes=Yes)</p>
                    <textarea
                      className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm"
                      rows={5}
                      value={newQuestionOptions}
                      onChange={(e) => setNewQuestionOptions(e.target.value)}
                      placeholder={'yes=Yes\nno=No'}
                    />
                  </div>
                )}

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={newQuestionRequired} onChange={(e) => setNewQuestionRequired(e.target.checked)} />
                    Required
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-sm">Sort order</span>
                    <input
                      type="number"
                      className="w-24 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                      value={newQuestionSortOrder}
                      onChange={(e) => setNewQuestionSortOrder(parseInt(e.target.value || '0', 10))}
                    />
                  </div>
                </div>

                <button
                  className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={async () => {
                    try {
                      const question_translations = { en: newQuestionTextEn };

                      let options_translations: any = null;
                      if (newQuestionType === 'single_choice') {
                        const lines = newQuestionOptions.split('\n').map(l => l.trim()).filter(Boolean);
                        const opts: Record<string, string> = {};
                        for (const line of lines) {
                          const idx = line.indexOf('=');
                          if (idx === -1) continue;
                          const key = line.slice(0, idx).trim();
                          const label = line.slice(idx + 1).trim();
                          if (key) opts[key] = label;
                        }
                        options_translations = { en: opts };
                      }

                      const payload: any = {
                        code: newQuestionCode,
                        is_active: true,
                        trigger: 'on_start',
                        type: newQuestionType,
                        required: newQuestionRequired,
                        sort_order: newQuestionSortOrder,
                        question_translations,
                        options_translations
                      };

                      const created = await createOnboardingQuestion(payload);
                      setOnboardingQuestions([created.question, ...onboardingQuestions]);
                      setMessage({ type: 'success', text: 'Question created' });
                    } catch (e) {
                      setMessage({ type: 'error', text: 'Failed to create question' });
                    }
                  }}
                >
                  Create
                </button>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white shadow-sm border">
              <h3 className="text-sm font-medium text-gray-900">Questions</h3>
              <div className="mt-3 grid gap-3">
                {onboardingQuestions.map((q) => (
                  <div key={q.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{q.code} (#{q.id})</div>
                      <div className="flex gap-2">
                        <button className="text-sm text-red-600" onClick={async () => {
                          await deleteOnboardingQuestion(q.id);
                          setOnboardingQuestions(onboardingQuestions.filter(x => x.id !== q.id));
                        }}>Delete</button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">type={q.type} active={String(q.is_active)} sort={q.sort_order}</div>
                    <button className="mt-2 text-sm text-blue-600" onClick={async () => {
                      await updateOnboardingQuestion(q.id, { is_active: !q.is_active });
                      setOnboardingQuestions(onboardingQuestions.map(x => x.id === q.id ? { ...x, is_active: !x.is_active } : x));
                    }}>Toggle Active</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white shadow-sm border">
              <h3 className="text-sm font-medium text-gray-900">Latest Answers (max 500)</h3>
              <div className="mt-3 text-xs text-gray-700 max-h-[28rem] overflow-auto">
                <pre>{JSON.stringify(onboardingAnswers.slice(0, 50), null, 2)}</pre>
              </div>
            </div>
          </div>
        )
      }

    </div >
  );
}