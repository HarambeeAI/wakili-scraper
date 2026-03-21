import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Mail, Search, Sparkles, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Lead = {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  status: string;
  score: number;
  notes: string | null;
  created_at: string;
};

const statusStages = [
  { value: "prospecting", label: "Prospecting", color: "bg-muted text-muted-foreground" },
  { value: "contacted", label: "Contacted", color: "bg-blue-500/10 text-blue-600" },
  { value: "responded", label: "Responded", color: "bg-yellow-500/10 text-yellow-600" },
  { value: "qualified", label: "Qualified", color: "bg-purple-500/10 text-purple-600" },
  { value: "converted", label: "Converted", color: "bg-green-500/10 text-green-600" },
  { value: "lost", label: "Lost", color: "bg-red-500/10 text-red-600" },
];

export function SalesRepAgent() {
  const { token, userId } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [emailContent, setEmailContent] = useState({ subject: "", body: "" });
  const { toast } = useToast();

  const [newLead, setNewLead] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    website: "",
    industry: "",
  });

  useEffect(() => {
    if (!token) return;
    fetchLeads();
  }, [token]);

  const fetchLeads = async () => {
    try {
      const data = await api.get<Lead[]>("/api/leads", { token: token! });
      if (data) setLeads(data);
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLead = async () => {
    try {
      await api.post("/api/leads", { ...newLead }, { token: token! });
      toast({ title: "Success", description: "Lead added" });
      setDialogOpen(false);
      setNewLead({ company_name: "", contact_name: "", email: "", phone: "", website: "", industry: "" });
      fetchLeads();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const updateLeadStatus = async (id: string, status: "prospecting" | "contacted" | "responded" | "qualified" | "converted" | "lost") => {
    try {
      await api.patch(`/api/leads/${id}`, { status }, { token: token! });
      fetchLeads();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const generateEmail = async (lead: Lead) => {
    setSelectedLead(lead);
    setEmailDialogOpen(true);
    setGeneratingEmail(true);

    try {
      const data = await api.post<{ subject: string; body: string }>("/api/generate-outreach", {
        lead,
        userId,
      }, { token: token! });

      setEmailContent({ subject: data.subject, body: data.body });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setGeneratingEmail(false);
    }
  };

  const saveOutreach = async () => {
    if (!selectedLead) return;

    try {
      await api.post("/api/outreach-emails", {
        lead_id: selectedLead.id,
        subject: emailContent.subject,
        body: emailContent.body,
      }, { token: token! });

      toast({ title: "Success", description: "Outreach email saved" });
      setEmailDialogOpen(false);
      updateLeadStatus(selectedLead.id, "contacted");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getStatusColor = (status: string) => {
    return statusStages.find((s) => s.value === status)?.color || "bg-muted text-muted-foreground";
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Sales Rep</h1>
          <p className="text-muted-foreground">Finds and qualifies leads, personalizes outreach, manages follow-ups, and keeps your sales pipeline moving.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={newLead.company_name}
                    onChange={(e) => setNewLead({ ...newLead, company_name: e.target.value })}
                    placeholder="Acme Inc"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input
                    value={newLead.contact_name}
                    onChange={(e) => setNewLead({ ...newLead, contact_name: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    placeholder="john@acme.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    placeholder="+1 555-0123"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input
                    value={newLead.website}
                    onChange={(e) => setNewLead({ ...newLead, website: e.target.value })}
                    placeholder="https://acme.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input
                    value={newLead.industry}
                    onChange={(e) => setNewLead({ ...newLead, industry: e.target.value })}
                    placeholder="Technology"
                  />
                </div>
              </div>
              <Button onClick={handleAddLead} className="w-full">Add Lead</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pipeline Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">{leads.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contacted</p>
                <p className="text-2xl font-bold">{leads.filter((l) => l.status === "contacted").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Search className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Qualified</p>
                <p className="text-2xl font-bold">{leads.filter((l) => l.status === "qualified").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Sparkles className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Converted</p>
                <p className="text-2xl font-bold">{leads.filter((l) => l.status === "converted").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Pipeline</CardTitle>
          <CardDescription>Manage your leads and track progress</CardDescription>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No leads yet. Add your first lead to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{lead.company_name}</p>
                    <p className="text-sm text-muted-foreground">{lead.contact_name} • {lead.email}</p>
                    <p className="text-xs text-muted-foreground">{lead.industry}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => generateEmail(lead)}>
                      <Mail className="h-4 w-4 mr-1" /> Generate Email
                    </Button>
                    <Select
                      value={lead.status}
                      onValueChange={(value) => updateLeadStatus(lead.id, value as "prospecting" | "contacted" | "responded" | "qualified" | "converted" | "lost")}
                    >
                      <SelectTrigger className={`w-32 ${getStatusColor(lead.status)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusStages.map((stage) => (
                          <SelectItem key={stage.value} value={stage.value}>
                            {stage.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Outreach Email for {selectedLead?.company_name}</DialogTitle>
          </DialogHeader>
          {generatingEmail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Generating personalized email...</span>
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={emailContent.subject}
                  onChange={(e) => setEmailContent({ ...emailContent, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea
                  value={emailContent.body}
                  onChange={(e) => setEmailContent({ ...emailContent, body: e.target.value })}
                  rows={10}
                />
              </div>
              <Button onClick={saveOutreach} className="w-full">Save Outreach Email</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
