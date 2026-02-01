'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { bulkUpdateSettings, createFlow, deleteFlow, getFlows, getSettings } from '@/lib/api';
import { Plus, Search, MoreHorizontal, Trash2, Check, ExternalLink, MessageCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export default function FlowsPage() {
  const [flows, setFlows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [defaultFlowId, setDefaultFlowId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [flowsData, settingsData] = await Promise.all([getFlows(), getSettings()]);
      setFlows(flowsData.flows || []);

      const def = (settingsData.settings || []).find((s: any) => s.key === 'default_flow_id');
      setDefaultFlowId(String(def?.value || ''));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load flows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setAsDefault = async (flowId: string) => {
    try {
      await bulkUpdateSettings([{ key: 'default_flow_id', value: flowId }]);
      setDefaultFlowId(flowId);
      toast.success(`Default flow set to: ${flowId}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Failed to set default flow');
    }
  };

  const onCreate = async () => {
    if (!slug.trim() || !title.trim()) {
      toast.error('Slug and title are required');
      return;
    }
    try {
      await createFlow({ slug: slug.trim(), title: title.trim() });
      setSlug('');
      setTitle('');
      toast.success('Flow created');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Failed to create flow');
    }
  };

  const filteredFlows = flows.filter(f =>
    f.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">

      {/* Header & Create Section */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flows</h1>
          <p className="text-muted-foreground mt-1">Manage your conversation flows and questionnaires.</p>
        </div>

        <Card className="w-full md:w-auto min-w-[400px] border-blue-100 bg-blue-50/50 shadow-sm">
          <CardContent className="p-4 flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-medium text-gray-600">New Flow ID</label>
              <Input
                placeholder="e.g. feedback-survey"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="bg-white h-9"
              />
            </div>
            <div className="flex-[2] space-y-2">
              <label className="text-xs font-medium text-gray-600">Title</label>
              <Input
                placeholder="Review Collection Flow"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white h-9"
              />
            </div>
            <Button onClick={onCreate} className="h-9 bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Create
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Search and Grid */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search flows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : filteredFlows.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No flows found</h3>
            <p className="text-gray-500">Create one above to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFlows.map((f) => {
              const isDefault = defaultFlowId === f.slug;

              return (
                <Card key={f.id} className={`group hover:shadow-md transition-shadow ${isDefault ? 'border-green-200 bg-green-50/10' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{f.title}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs font-normal text-muted-foreground bg-gray-50">
                            {f.slug}
                          </Badge>
                          {isDefault && (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                              Default
                            </Badge>
                          )}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setAsDefault(f.slug)}>
                            <Check className="mr-2 h-4 w-4" /> Set as Default
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={async () => {
                            if (!confirm(`Delete flow "${f.slug}"?`)) return;
                            try {
                              await deleteFlow(f.id);
                              toast.success('Flow deleted');
                              await load();
                            } catch (e: any) {
                              toast.error(e?.message || 'Failed to delete');
                            }
                          }}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${f.published?.status === 'published' ? 'bg-green-500' : 'bg-gray-300'}`} />
                        {f.published?.status === 'published' ? 'Published' : 'Draft'}
                      </div>
                      {f.published?.version && (
                        <div>v{f.published.version}</div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button asChild className="w-full bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 shadow-sm" variant="outline">
                      <Link href={`/dashboard/flows/${f.id}`}>
                        Open Editor <ExternalLink className="w-3 h-3 ml-2 text-gray-400" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
