import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Package,
  Users,
  MessageSquareQuote,
  Image,
  Globe,
  Trash2,
  RefreshCw,
  Loader2,
  FileText,
  Target,
  Palette,
  FileUp
} from "lucide-react";

interface Artifact {
  id: string;
  artifact_type: string;
  title: string | null;
  content: string | null;
  image_url: string | null;
  metadata: any;
  source_url: string | null;
  created_at: string;
}

const artifactTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  description: { icon: <FileText className="h-4 w-4" />, label: "Description", color: "bg-blue-500/10 text-blue-600" },
  product: { icon: <Package className="h-4 w-4" />, label: "Product/Service", color: "bg-green-500/10 text-green-600" },
  team_member: { icon: <Users className="h-4 w-4" />, label: "Team", color: "bg-purple-500/10 text-purple-600" },
  testimonial: { icon: <MessageSquareQuote className="h-4 w-4" />, label: "Testimonial", color: "bg-yellow-500/10 text-yellow-600" },
  image: { icon: <Image className="h-4 w-4" />, label: "Image", color: "bg-pink-500/10 text-pink-600" },
  contact: { icon: <Globe className="h-4 w-4" />, label: "Contact", color: "bg-cyan-500/10 text-cyan-600" },
  brand_color: { icon: <Palette className="h-4 w-4" />, label: "Brand", color: "bg-orange-500/10 text-orange-600" },
  logo: { icon: <Building2 className="h-4 w-4" />, label: "Logo", color: "bg-indigo-500/10 text-indigo-600" },
  uploaded_document: { icon: <FileUp className="h-4 w-4" />, label: "Document", color: "bg-slate-500/10 text-slate-600" },
};

export const BusinessArtifacts = () => {
  const { token } = useAuth();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();

  const fetchArtifacts = async () => {
    if (!token) return;
    try {
      const data = await api.get<Artifact[]>("/api/artifacts", { token });
      setArtifacts(data || []);
    } catch (error) {
      console.error('Error fetching artifacts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtifacts();
  }, [token]);

  const deleteArtifact = async (id: string) => {
    if (!token) return;
    try {
      await api.delete(`/api/artifacts/${id}`, { token });
      setArtifacts(artifacts.filter(a => a.id !== id));
      toast({
        title: "Artifact deleted",
        description: "The artifact has been removed from your knowledge base",
      });
    } catch (error) {
      console.error('Error deleting artifact:', error);
      toast({
        title: "Error",
        description: "Failed to delete artifact",
        variant: "destructive",
      });
    }
  };

  const getFilteredArtifacts = () => {
    if (activeTab === "all") return artifacts;
    return artifacts.filter(a => a.artifact_type === activeTab);
  };

  const getUniqueTypes = () => {
    const types = [...new Set(artifacts.map(a => a.artifact_type))];
    return types;
  };

  const renderArtifactContent = (artifact: Artifact) => {
    if (artifact.artifact_type === 'image' && artifact.image_url) {
      return (
        <div className="mt-2">
          <img
            src={artifact.image_url}
            alt={artifact.title || 'Business image'}
            className="rounded-lg max-h-48 object-cover"
          />
        </div>
      );
    }

    if (artifact.artifact_type === 'contact' && artifact.metadata) {
      const contact = artifact.metadata;
      return (
        <div className="mt-2 space-y-1 text-sm">
          {contact.email && <p><span className="text-muted-foreground">Email:</span> {contact.email}</p>}
          {contact.phone && <p><span className="text-muted-foreground">Phone:</span> {contact.phone}</p>}
          {contact.address && <p><span className="text-muted-foreground">Address:</span> {contact.address}</p>}
        </div>
      );
    }

    return (
      <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
        {artifact.content}
      </p>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (artifacts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Business Knowledge Base</h1>
          <p className="text-muted-foreground">Your AI agents use this information to provide personalized assistance</p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No business artifacts yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Add your website URL in Settings to automatically build your knowledge base,
              or your AI agents will learn about your business as you interact with them.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Business Knowledge Base</h1>
          <p className="text-muted-foreground">
            {artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''} collected from your business
          </p>
        </div>
        <Button variant="outline" onClick={fetchArtifacts}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {getUniqueTypes().map(type => (
            <TabsTrigger key={type} value={type}>
              {artifactTypeConfig[type]?.label || type}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {getFilteredArtifacts().map((artifact) => {
                const config = artifactTypeConfig[artifact.artifact_type] || {
                  icon: <FileText className="h-4 w-4" />,
                  label: artifact.artifact_type,
                  color: "bg-gray-500/10 text-gray-600"
                };

                return (
                  <Card key={artifact.id} className="group">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <Badge variant="secondary" className={config.color}>
                          <span className="flex items-center gap-1">
                            {config.icon}
                            {config.label}
                          </span>
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteArtifact(artifact.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <CardTitle className="text-base mt-2">{artifact.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderArtifactContent(artifact)}
                      {artifact.source_url && (
                        <p className="text-xs text-muted-foreground mt-3 truncate">
                          Source: {artifact.source_url}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
