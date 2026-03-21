import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Sparkles, Calendar, Instagram, Image, Loader2, FolderOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type SocialPost = {
  id: string;
  platform: string;
  content: string;
  image_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  status: string;
  engagement_likes: number;
  engagement_comments: number;
  created_at: string;
};

type AgentAsset = {
  id: string;
  agent_type: string;
  asset_type: string;
  title: string | null;
  content: string | null;
  file_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type Artifact = {
  id: string;
  artifact_type: string;
  content: string | null;
};

export function MarketerAgent() {
  const { token, userId } = useAuth();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [assets, setAssets] = useState<AgentAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const [newPost, setNewPost] = useState({ content: "", scheduled_at: "", topic: "" });

  useEffect(() => {
    if (!token) return;
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [postsData, assetsData] = await Promise.all([
        api.get<SocialPost[]>("/api/social-posts", { token: token! }),
        api.get<AgentAsset[]>("/api/agent-assets?agent_type=marketer", { token: token! }),
      ]);
      if (postsData) setPosts(postsData);
      if (assetsData) setAssets(assetsData as AgentAsset[]);
    } catch (err) {
      console.error("Error fetching marketer data:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateContent = async () => {
    if (!newPost.topic) {
      toast({ title: "Error", description: "Please enter a topic", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      let businessContext = "";
      const artifacts = await api.get<Artifact[]>("/api/artifacts", { token: token! });
      if (artifacts) {
        businessContext = artifacts
          .filter(a => a.artifact_type === "description" || a.artifact_type === "brand_tone")
          .slice(0, 3)
          .map(a => a.content)
          .filter(Boolean)
          .join(". ");
      }

      const data = await api.post<{ content: string; imageUrl?: string }>("/api/generate-content", {
        topic: newPost.topic,
        platform: "instagram",
        businessContext: businessContext.substring(0, 500),
        userId,
        generateImageForPost: true,
      }, { token: token! });

      setNewPost({ ...newPost, content: data.content });
      fetchData();
      toast({ title: "Success", description: data.imageUrl ? "Content and image generated!" : "Content generated!" });
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleCreatePost = async () => {
    try {
      const recentImageAsset = assets.find(a => a.asset_type === "image");
      await api.post("/api/social-posts", {
        content: newPost.content,
        image_url: recentImageAsset?.file_url || null,
        scheduled_at: newPost.scheduled_at || null,
        status: newPost.scheduled_at ? "scheduled" : "draft",
      }, { token: token! });

      toast({ title: "Success", description: "Post created" });
      setDialogOpen(false);
      setNewPost({ content: "", scheduled_at: "", topic: "" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "bg-green-500/10 text-green-600";
      case "scheduled": return "bg-blue-500/10 text-blue-600";
      case "draft": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  const imageAssets = assets.filter(a => a.asset_type === "image");
  const postAssets = assets.filter(a => a.asset_type === "post");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">AI Marketer</h1><p className="text-muted-foreground">Plans and runs marketing campaigns, creates and schedules content, tracks performance, and optimizes for growth.</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Create Post</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create New Post</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Topic (AI generates content + image)</Label>
                <div className="flex gap-2">
                  <Input value={newPost.topic} onChange={(e) => setNewPost({ ...newPost, topic: e.target.value })} placeholder="e.g., New product launch" />
                  <Button onClick={generateContent} disabled={generating} variant="secondary">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}</Button>
                </div>
                <p className="text-xs text-muted-foreground">AI auto-generates caption and visual</p>
              </div>
              <div className="space-y-2"><Label>Content</Label><Textarea value={newPost.content} onChange={(e) => setNewPost({ ...newPost, content: e.target.value })} placeholder="Write or generate with AI..." rows={5} /></div>
              <div className="space-y-2"><Label>Schedule (optional)</Label><Input type="datetime-local" value={newPost.scheduled_at} onChange={(e) => setNewPost({ ...newPost, scheduled_at: e.target.value })} /></div>
              <Button onClick={handleCreatePost} className="w-full">{newPost.scheduled_at ? "Schedule Post" : "Save as Draft"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer"><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-2 rounded-lg bg-primary/10"><Instagram className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total Posts</p><p className="text-2xl font-bold">{posts.length}</p></div></div></CardContent></Card>
        <Card className="hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer"><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-2 rounded-lg bg-blue-500/10"><Calendar className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-muted-foreground">Scheduled</p><p className="text-2xl font-bold">{posts.filter(p => p.status === "scheduled").length}</p></div></div></CardContent></Card>
        <Card className="hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer"><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-2 rounded-lg bg-green-500/10"><Sparkles className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-muted-foreground">Published</p><p className="text-2xl font-bold">{posts.filter(p => p.status === "published").length}</p></div></div></CardContent></Card>
        <Card className="hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer"><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-2 rounded-lg bg-purple-500/10"><FolderOpen className="h-5 w-5 text-purple-600" /></div><div><p className="text-sm text-muted-foreground">Assets</p><p className="text-2xl font-bold">{assets.length}</p></div></div></CardContent></Card>
      </div>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList><TabsTrigger value="calendar">Content Calendar</TabsTrigger><TabsTrigger value="assets">Generated Assets ({assets.length})</TabsTrigger></TabsList>
        <TabsContent value="calendar">
          <Card><CardHeader><CardTitle>Content Calendar</CardTitle><CardDescription>Your scheduled and published posts</CardDescription></CardHeader>
            <CardContent>{posts.length === 0 ? (<div className="text-center py-8 text-muted-foreground"><Image className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No posts yet.</p></div>) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{posts.map((post) => (
                <Card key={post.id} className="overflow-hidden">{post.image_url && <div className="aspect-video overflow-hidden"><img src={post.image_url} alt="Post" className="w-full h-full object-cover" /></div>}
                  <CardContent className="p-4 space-y-3"><div className="flex items-center justify-between"><Badge variant="outline" className={getStatusColor(post.status)}>{post.status}</Badge><span className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleDateString()}</span></div>
                    <p className="text-sm line-clamp-4">{post.content}</p>{post.scheduled_at && <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Scheduled: {new Date(post.scheduled_at).toLocaleString()}</p>}</CardContent></Card>))}</div>)}</CardContent></Card>
        </TabsContent>
        <TabsContent value="assets">
          <Card><CardHeader><CardTitle>Generated Assets</CardTitle><CardDescription>All content and images created by the AI</CardDescription></CardHeader>
            <CardContent>{assets.length === 0 ? (<div className="text-center py-8 text-muted-foreground"><FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No assets yet.</p></div>) : (
              <div className="space-y-6">
                {imageAssets.length > 0 && <div><h3 className="font-semibold mb-3">Images ({imageAssets.length})</h3><div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">{imageAssets.map(asset => (
                  <Card key={asset.id} className="overflow-hidden">{asset.file_url && <div className="aspect-square overflow-hidden"><img src={asset.file_url} alt={asset.title || "Image"} className="w-full h-full object-cover" /></div>}<CardContent className="p-3"><p className="text-xs font-medium line-clamp-2">{asset.title}</p><p className="text-xs text-muted-foreground mt-1">{new Date(asset.created_at).toLocaleDateString()}</p></CardContent></Card>))}</div></div>}
                {postAssets.length > 0 && <div><h3 className="font-semibold mb-3">Content ({postAssets.length})</h3><div className="grid gap-4 md:grid-cols-2">{postAssets.map(asset => (
                  <Card key={asset.id}><CardContent className="p-4"><div className="flex items-start justify-between mb-2"><p className="text-sm font-medium line-clamp-1">{asset.title}</p><Badge variant="outline" className="text-xs">{(asset.metadata as Record<string, unknown>)?.platform as string || "instagram"}</Badge></div><p className="text-sm text-muted-foreground line-clamp-3">{asset.content}</p><p className="text-xs text-muted-foreground mt-2">{new Date(asset.created_at).toLocaleString()}</p></CardContent></Card>))}</div></div>}
              </div>)}</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
