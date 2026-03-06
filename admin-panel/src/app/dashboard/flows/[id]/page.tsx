'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save, Smartphone, Plus, Trash2, GripVertical, ArrowRight, MessageCircle, List, Calendar, FileText, Hash, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  createFlowVersion,
  getFlow,
  getFlowVersion,
  publishFlowVersion,
  setFlowStartNode,
  upsertFlowNode,
  deleteFlowNode,
  upsertFlowOption,
  deleteFlowOption,
  validateFlowVersion,
} from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const NODE_TYPES = [
  { value: 'text', label: 'Message', icon: MessageCircle },
  { value: 'single_choice', label: 'Single Choice', icon: List },
  { value: 'multi_choice', label: 'Multiple Choice', icon: List },
  { value: 'number', label: 'Number Input', icon: Hash },
  { value: 'date', label: 'Date Input', icon: Calendar },
  { value: 'file', label: 'File Upload', icon: FileText },
  { value: 'end', label: 'End Flow', icon: CheckCircle2 },
] as const;

function humanizeFlowText(msg: string): string {
  let out = String(msg || '');
  out = out.replace(/node_key/gi, 'Question ID');
  out = out.replace(/option_key/gi, 'Option');
  out = out.replace(/flow_node_id/gi, 'Question');
  out = out.replace(/\bkey\b/gi, 'Question');
  return out;
}

function formatFlowError(err: any): string {
  const raw = String(err?.response?.data?.message || err?.message || '').trim();
  if (!raw) return 'Failed. Please check your Questions and Options.';
  let msg = raw;
  msg = humanizeFlowText(msg);
  msg = msg.replace(/key not found/gi, 'Question not found');
  msg = msg.replace(/not found/gi, 'not found');
  return msg;
}

export default function FlowEditPage() {
  const params = useParams();
  const flowId = Number(params?.id);

  const [flow, setFlow] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

  const [version, setVersion] = useState<any>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [options, setOptions] = useState<any[]>([]);
  const [savingAll, setSavingAll] = useState(false);
  const [reloading, setReloading] = useState(false);

  // Preview State
  const [previewNodeKey, setPreviewNodeKey] = useState<string | null>(null);



  // Debugging logs
  useEffect(() => {
    console.log('FlowEditPage State:', { flow, versionsCount: versions.length, nodesCount: nodes.length, optionsCount: options.length, versionId: selectedVersionId });
  }, [flow, versions, nodes, options, selectedVersionId]);

  const optionKeyToLabel = useMemo(() => {
    const m = new Map<string, string>();
    if (!Array.isArray(options)) return m;
    for (const o of options) {
      if (!o) continue;
      const k = String(o.option_key || '').trim();
      if (!k) continue;
      const label = String(o.label_i18n?.en || '').trim();
      if (label) m.set(k, label);
    }
    return m;
  }, [options]);

  const questionKeyToText = useMemo(() => {
    const m = new Map<string, string>();
    if (!Array.isArray(nodes)) return m;
    for (const n of nodes) {
      if (!n) continue;
      const k = String(n.node_key || '').trim();
      if (!k) continue;
      const t = String(n.prompt_i18n?.en || '').trim();
      if (t) m.set(k, t);
    }
    return m;
  }, [nodes]);

  const appendQuestionContext = (msg: string) => {
    const m = msg.match(/Question ID\s*[:=]?\s*([A-Za-z0-9_\-]+)/i);
    const qid = m?.[1];
    if (!qid) return msg;
    const qt = questionKeyToText.get(qid);
    if (!qt) return msg;
    return `${msg}\nQuestion: ${qid} — ${qt}`;
  };

  const formatFlowErrorUi = (err: any) => {
    let msg = formatFlowError(err);
    // Safety check for replace
    try {
      msg = msg.replace(/\bopt_\d+\b/gi, (k) => optionKeyToLabel.get(k) || k);
    } catch (e) { console.error('Error formatting UI error:', e); }
    msg = appendQuestionContext(msg);
    return msg;
  };

  const [collapsedOptions, setCollapsedOptions] = useState<Record<string, boolean>>({});

  const nodesById = useMemo(() => {
    if (!Array.isArray(nodes)) return new Map();
    return new Map(nodes.filter(n => !!n).map(n => [n.id, n]));
  }, [nodes]);

  // Helper to get ALL available nodes for dropdowns (including partials in state)
  const availableNodes = useMemo(() => {
    if (!Array.isArray(nodes)) return [];
    return nodes.filter(n => !!n).map(n => ({
      value: n.node_key,
      label: `${n.node_key} ${n.prompt_i18n?.en ? `- ${n.prompt_i18n.en.substring(0, 20)}...` : ''}`
    }));
  }, [nodes]);


  const optionsByNodeId = useMemo(() => {
    const m = new Map<number, any[]>();
    if (!Array.isArray(options)) return m;
    for (const o of options) {
      if (!o || !o.flow_node_id) continue;
      const list = m.get(o.flow_node_id) || [];
      list.push(o);
      m.set(o.flow_node_id, list);
    }
    for (const [k, list] of m.entries()) {
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      m.set(k, list);
    }
    return m;
  }, [options]);

  const loadFlow = async () => {
    try {
      const data = await getFlow(flowId);
      console.log('loadFlow data:', data);
      setFlow(data.flow);
      setVersions(Array.isArray(data.versions) ? data.versions : []);
      const first = (data.versions || [])[0];
      if (first?.id) setSelectedVersionId(first.id);
    } catch (e) {
      console.error('loadFlow error:', e);
      throw e;
    }
  };

  const loadVersion = async (versionId: number) => {
    try {
      const data = await getFlowVersion(flowId, versionId);
      console.log('loadVersion data:', data);
      setVersion(data.version);
      // Explicitly filter out any null/undefined nodes or options from backend
      setNodes(Array.isArray(data.nodes) ? data.nodes.filter((n: any) => n) : []);
      setOptions(Array.isArray(data.options) ? data.options.filter((o: any) => o) : []);

      // Set initial preview to start node if available
      if (data.version?.start_node_key) {
        setPreviewNodeKey(data.version.start_node_key);
      }
    } catch (e) {
      console.error('loadVersion error:', e);
      throw e;
    }
  };

  useEffect(() => {
    if (!flowId) return;
    loadFlow().catch((e) => toast.error(formatFlowError(e)));
  }, [flowId]);

  useEffect(() => {
    if (selectedVersionId) {
      loadVersion(selectedVersionId).catch((e) => toast.error(formatFlowError(e)));
    }
  }, [selectedVersionId]);

  const ensureVersion = async (): Promise<number> => {
    if (selectedVersionId) return selectedVersionId;
    const data = await createFlowVersion(flowId);
    await loadFlow();
    setSelectedVersionId(data.version.id);
    return data.version.id;
  };

  const onUpsertNode = async (nodeKey: string) => {
    if (!selectedVersionId) return;
    const n = nodes.find(x => x.node_key === nodeKey) || { node_key: nodeKey };
    try {
      await upsertFlowNode(selectedVersionId, nodeKey, n);
      toast.success('Question saved');
      await loadVersion(selectedVersionId);
    } catch (e: any) {
      toast.error(formatFlowErrorUi(e));
    }
  };

  const onDeleteNode = async (nodeKey: string) => {
    if (!selectedVersionId) return;
    if (!confirm(`Delete node ${nodeKey}?`)) return;
    await deleteFlowNode(selectedVersionId, nodeKey);
    await loadVersion(selectedVersionId);
  };

  const onDeleteOption = async (nodeId: number, optionKey: string) => {
    if (!confirm(`Delete option ${optionKey}?`)) return;
    await deleteFlowOption(nodeId, optionKey);
    await loadVersion(selectedVersionId!);
  };

  const onSaveFlowAll = async () => {
    try {
      setSavingAll(true);
      const versionId = await ensureVersion();

      const nodesSorted = [...nodes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      for (const n of nodesSorted) {
        if (!n?.node_key) continue;
        await upsertFlowNode(versionId, n.node_key, n);
      }

      if (version?.start_node_key) {
        await setFlowStartNode(versionId, version.start_node_key);
      }

      const currentNodes = await getFlowVersion(flowId, versionId);
      const nodeKeyToId = new Map((currentNodes.nodes || []).map((n: any) => [n.node_key, n.id]));

      const optionsSorted = [...options].sort((a, b) => {
        const na = (a.flow_node_id ?? 0) - (b.flow_node_id ?? 0);
        if (na !== 0) return na;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });

      for (const o of optionsSorted) {
        if (!o) continue;
        if (!o.flow_node_id && o.node_key && nodeKeyToId.has(o.node_key)) {
          o.flow_node_id = nodeKeyToId.get(o.node_key);
        }
        if (!o.flow_node_id || !o.option_key) continue;
        await upsertFlowOption(o.flow_node_id, o.option_key, o);
      }

      const vres = await validateFlowVersion(versionId);
      if (!vres.ok) {
        const lines = (vres.errors || []).map((e: string) => {
          const base = humanizeFlowText(e);
          const withOpt = base.replace(/\bopt_\d+\b/gi, (k) => optionKeyToLabel.get(k) || k);
          return appendQuestionContext(withOpt);
        });
        toast.error(lines.join('\n'));
        return;
      }

      await publishFlowVersion(versionId);
      toast.success('✅ Saved & Published');
      await loadFlow();
      await loadVersion(versionId);
    } catch (e: any) {
      toast.error(formatFlowErrorUi(e));
    } finally {
      setSavingAll(false);
    }
  };

  const onRefresh = async () => {
    if (!flowId) return;
    try {
      setReloading(true);
      await loadFlow();
      if (selectedVersionId) {
        await loadVersion(selectedVersionId);
      }
    } finally {
      setReloading(false);
    }
  };

  // --- Rendering ---

  if (!flow) return <div className="p-8 text-center text-gray-500">Loading flow...</div>;

  const validNodes = Array.isArray(nodes) ? nodes : [];
  const validOptions = Array.isArray(options) ? options : [];

  const previewNode = validNodes.find(n => n && n.node_key === previewNodeKey) || validNodes[0];

  // Safe options retrieval
  const previewOptions = previewNode
    ? (previewNode.id
      ? (optionsByNodeId.get(previewNode.id) || [])
      : validOptions.filter(o => o && o.node_key === previewNode.node_key)
    )
    : [];

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white p-4 border rounded-xl flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-gray-500">{flow.slug} /</span>
            {flow.title}
          </h1>
          <div className="text-xs text-gray-500 mt-1">Status: {version?.status || 'draft'} • Version: {version?.version || 1}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={reloading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${reloading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={onSaveFlowAll} disabled={savingAll} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            {savingAll ? 'Saving...' : 'Save & Publish'}
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* Left: Editor */}
        <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden h-full">
          <div className="h-full overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            <div className="space-y-6 pb-20">

              {/* Start Node Config */}
              <Card className="border-blue-100 bg-blue-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" /> Entry Point
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Label className="whitespace-nowrap">Start Question:</Label>
                    <Select
                      value={version?.start_node_key || ''}
                      onValueChange={(v) => {
                        setVersion({ ...version, start_node_key: v });
                        setPreviewNodeKey(v);
                      }}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Select first question..." />
                      </SelectTrigger>
                      <SelectContent>
                        {nodes.map(n => (
                          <SelectItem key={n.node_key} value={n.node_key}>
                            {n.node_key} ({n.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Nodes List */}
              {validNodes
                .slice()
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((n, idx) => {
                  if (!n) return null;
                  const isChoice = n.type === 'single_choice' || n.type === 'multi_choice';
                  const optList = n.id ? (optionsByNodeId.get(n.id) || []) : validOptions.filter((o) => o && o.node_key === n.node_key);
                  const isCollapsed = collapsedOptions[n.node_key] !== false;
                  const isPreviewing = previewNodeKey === n.node_key;

                  return (
                    <Card
                      key={n.node_key}
                      className={`transition-all ${isPreviewing ? 'ring-2 ring-blue-500 shadow-md' : 'border-gray-200 hover:border-blue-300'}`}
                      onClick={() => setPreviewNodeKey(n.node_key)}
                    >
                      <CardHeader className="py-3 px-4 bg-gray-50/50 border-b flex flex-row items-center justify-between cursor-pointer" >
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-2 rounded-md border shadow-sm">
                            {(() => {
                              const TypeIcon = NODE_TYPES.find(t => t.value === n.type)?.icon || MessageCircle;
                              return <TypeIcon className="w-5 h-5 text-gray-500" />;
                            })()}
                          </div>
                          <div>
                            <div className="font-semibold text-sm flex items-center gap-2">
                              {n.node_key}
                              <Badge variant="outline" className="text-[10px] h-5 font-normal text-gray-500">{n.type}</Badge>
                            </div>
                            <div className="text-xs text-gray-400 truncate max-w-[300px]">
                              {n.prompt_i18n?.en || 'No text set...'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-500 hover:bg-red-50"
                            onClick={(e) => { e.stopPropagation(); onDeleteNode(n.node_key); }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 space-y-4">
                        {/* Base Config: ID, Type, Next */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Question ID</Label>
                            <Input
                              value={n.node_key}
                              onChange={(e) => setNodes(nodes.map((x) => (x === n ? { ...x, node_key: e.target.value } : x)))}
                              className="font-mono text-xs h-9"
                              placeholder="unique_id"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
                            <Select value={n.type} onValueChange={(v) => setNodes(nodes.map(x => x.node_key === n.node_key ? { ...x, type: v } : x))}>
                              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {NODE_TYPES.map(t => (
                                  <SelectItem key={t.value} value={t.value} className="text-xs">
                                    <div className="flex items-center gap-2">
                                      <t.icon className="w-4 h-4" /> {t.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Next Question (Default)</Label>
                            <Select
                              value={n.next_node_key || 'end_flow'}
                              onValueChange={(v) => setNodes(nodes.map(x => x.node_key === n.node_key ? { ...x, next_node_key: v === 'end_flow' ? null : v } : x))}
                            >
                              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select next..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="end_flow" className="text-red-500 font-medium">End Flow</SelectItem>
                                {nodes.filter(x => x.node_key !== n.node_key).map(x => (
                                  <SelectItem key={x.node_key} value={x.node_key} className="text-xs">
                                    {x.node_key}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {n.type === 'single_choice' && (
                              <p className="text-[10px] text-gray-400 mt-1 italic leading-tight">
                                Optional. Ignored if options act as branches.
                              </p>
                            )}
                            {n.type === 'multi_choice' && (
                              <p className="text-[10px] text-blue-500 mt-1 font-medium leading-tight">
                                Required. Used after user clicks "Continue".
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Prompt */}
                        <div>
                          <Label className="text-xs text-muted-foreground block mb-1">Message Text</Label>

                          <Textarea
                            value={n.prompt_i18n?.en || ''}
                            onChange={(e) => setNodes(nodes.map((x) => x.node_key === n.node_key ? { ...x, prompt_i18n: { ...(x.prompt_i18n || {}), en: e.target.value } } : x))}
                            className="min-h-[80px] text-sm resize-none"
                            placeholder="What would you like to ask?"
                          />
                        </div>

                        {/* Options Builder */}
                        {isChoice && (
                          <div className="bg-gray-50 rounded-lg p-3 border">
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-xs font-semibold text-gray-700">Options</Label>
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => {
                                  const existingKeys = new Set((optList || []).map((x: any) => String(x.option_key)));
                                  let i = 1;
                                  while (existingKeys.has(`opt_${i}`)) i++;
                                  setOptions([...options, {
                                    flow_node_id: n.id || null,
                                    node_key: n.node_key,
                                    option_key: `opt_${i}`,
                                    label_i18n: { en: `Option ${i}` },
                                    sort_order: (optList || []).length
                                  }]);
                                }}
                              >
                                <Plus className="w-3 h-3 mr-1" /> Add Option
                              </Button>
                            </div>

                            <div className="space-y-2">
                              {(optList || [])
                                .slice()
                                .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                                .map((o: any, oIdx) => (
                                  <div key={o.option_key} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border shadow-sm">
                                    <div className="col-span-5">
                                      <Input
                                        className="h-8 text-xs"
                                        placeholder="Label"
                                        value={o.label_i18n?.en || ''}
                                        onChange={(e) => setOptions(options.map(x => (x === o ? { ...x, label_i18n: { ...x.label_i18n, en: e.target.value } } : x)))}
                                      />
                                    </div>
                                    <div className="col-span-1 text-center text-gray-400">
                                      <ArrowRight className="w-4 h-4 mx-auto" />
                                    </div>
                                    <div className="col-span-5">
                                      <Select
                                        value={o.next_node_key || 'default'}
                                        onValueChange={(v) => setOptions(options.map(x => (x === o ? { ...x, next_node_key: v === 'default' ? null : v } : x)))}
                                      >
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Use Default" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="default" className="text-gray-500 italic">Use Default Next</SelectItem>
                                          {nodes.filter(x => x.node_key !== n.node_key).map(x => (
                                            <SelectItem key={x.node_key} value={x.node_key} className="text-xs">{x.node_key}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="col-span-1 text-right">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-red-400 hover:text-red-500"
                                        onClick={() => {
                                          if (!n.id) {
                                            setOptions(options.filter(x => x !== o));
                                          } else {
                                            onDeleteOption(n.id, o.option_key);
                                          }
                                        }}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

              <Button
                onClick={() => {
                  if (!selectedVersionId) return;
                  // Safe filtering to prevent crashes
                  const safeNodes = nodes.filter(n => n);
                  const used = new Set(safeNodes.map((x) => String(x.node_key || '').toLowerCase()));
                  let i = 1;
                  while (used.has(`question_${i}`)) i += 1;
                  const nk = `question_${i}`;

                  const newNode = {
                    flow_version_id: selectedVersionId,
                    node_key: nk,
                    type: 'text',
                    prompt_i18n: { en: '' },
                    sort_order: safeNodes.length
                  };

                  setNodes([...safeNodes, newNode]);
                  setTimeout(() => setPreviewNodeKey(nk), 100);
                }}
                className="w-full py-6 border-dashed border-2 border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-400"
                variant="ghost"
              >
                <Plus className="w-5 h-5 mr-2" /> Add New Question
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Smartphone Preview */}
        <div className="hidden lg:block lg:col-span-1 relative">
          <div className="sticky top-6">
            <div className="w-[320px] mx-auto bg-gray-900 rounded-[3rem] p-4 shadow-2xl border-8 border-gray-800 relative aspect-[9/19] overflow-hidden">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-20"></div>

              {/* Screen */}
              <div className="bg-[#0e1621] w-full h-full rounded-[2rem] overflow-hidden flex flex-col relative text-white text-sm font-sans">
                {/* Chat Header */}
                <div className="h-14 bg-[#17212b] flex items-center px-4 pt-2 z-10 shrink-0 border-b border-gray-800">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold mr-3">BOT</div>
                  <div>
                    <div className="font-medium text-sm">BotDash</div>
                    <div className="text-[10px] text-blue-400">bot</div>
                  </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#0e1621]">
                  {(() => {
                    // Path Finding Logic
                    // 1. Build Adjacency Map for reverse lookup if needed, or just forward
                    // Actually, easiest is BFS from Start Node to Preview Node.

                    if (!previewNode || !version?.start_node_key) {
                      if (!previewNode) return <div className="text-gray-500 text-xs text-center mt-10">Select a question</div>;
                    }

                    // Reverse Path Lookup Strategy
                    // This is more robust for disconnected graphs or when start node isn't set.
                    const getReversePath = (targetKey: string): any[] => {
                      const parentMap = new Map<string, string>(); // child -> parent

                      validNodes.forEach(n => {
                        // Direct link
                        if (n.next_node_key) {
                          parentMap.set(n.next_node_key, n.node_key);
                        }
                        // Option links
                        const opts = n.id
                          ? (optionsByNodeId.get(n.id) || [])
                          : validOptions.filter(o => o.node_key === n.node_key);

                        opts.forEach((o: any) => {
                          if (o.next_node_key) {
                            parentMap.set(o.next_node_key, n.node_key);
                          }
                        });
                      });

                      const path: any[] = [];
                      let curr: string | undefined = targetKey;
                      const visited = new Set<string>();

                      while (curr && !visited.has(curr)) {
                        visited.add(curr);
                        const node = validNodes.find(n => n.node_key === curr);
                        if (node) path.unshift(node);
                        curr = parentMap.get(curr);
                        if (path.length > 5) break; // Limit depth for UI sanity
                      }

                      return path;
                    };

                    const pathNodes = getReversePath(previewNodeKey || '');

                    // Render path
                    return pathNodes.map((node, idx) => {
                      if (!node) return null;
                      const isLast = idx === pathNodes.length - 1;

                      return (
                        <div key={idx} className={`space-y-3 ${isLast ? 'opacity-100' : 'opacity-60'}`}>
                          {/* Bot Message */}
                          <div className="flex items-end gap-2 max-w-[90%]">
                            <div className="w-6 h-6 rounded-full bg-blue-500 shrink-0 mb-1"></div>
                            <div className="bg-[#182533] p-3 rounded-2xl rounded-bl-sm shadow-sm border border-gray-800">
                              <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-white">
                                {node.prompt_i18n?.en || '...'}
                              </div>
                            </div>
                          </div>

                          {/* Simulated User Reply (if not last) */}
                          {!isLast && (
                            <div className="flex justify-end pr-2">
                              <div className="bg-[#2b5278] text-white p-2 rounded-l-xl rounded-tr-xl rounded-br-none max-w-[80%] text-sm">
                                User Reply...
                              </div>
                            </div>
                          )}

                          {/* Controls for Last Node */}
                          {isLast && (
                            <div className="mt-4">
                              {node.type === 'text' && (
                                <div className="bg-[#17212b] p-2 rounded-t-xl opacity-50 border-t border-gray-700">
                                  <div className="text-xs text-gray-400 px-2 italic">User types reply...</div>
                                </div>
                              )}
                              {(node.type === 'single_choice' || node.type === 'multi_choice') && (
                                <div className="flex flex-wrap gap-2 justify-center">
                                  {(node.id
                                    ? (optionsByNodeId.get(node.id) || [])
                                    : validOptions.filter(o => o && o.node_key === node.node_key)
                                  ).map((o: any) => (
                                    <div key={o.option_key} className="bg-[#2b5278] text-white text-xs px-3 py-2 rounded-lg border border-black/20 font-medium">
                                      {o.label_i18n?.en || 'Option'}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                  {/* Controls for Last Node handled in path loop */}
                </div>
              </div>
            </div>
          </div>
          <div className="text-center mt-4 text-xs text-muted-foreground">
            Live Preview • {previewNode?.node_key}
          </div>
        </div>
      </div>
    </div>
  );
}
