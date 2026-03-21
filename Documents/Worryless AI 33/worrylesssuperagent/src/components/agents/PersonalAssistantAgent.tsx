import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Calendar, AlertTriangle, Clock, FileText,
  RefreshCw, Send, CheckCircle, Loader2, Inbox,
  CalendarDays, Brain, ExternalLink
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type EmailSummary = {
  id: string;
  gmail_message_id: string;
  sender_email: string;
  sender_name: string | null;
  subject: string;
  summary: string | null;
  urgency_level: string;
  category: string | null;
  requires_response: boolean;
  received_at: string;
};

type CalendarEvent = {
  id: string;
  google_event_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
};

type DailyBriefing = {
  id: string;
  briefing_date: string;
  top_priorities: unknown;
  urgent_emails: unknown;
  todays_schedule: unknown;
  action_items: unknown;
  summary_text: string | null;
  email_sent_at: string | null;
};

type EmailDraft = {
  id: string;
  recipient_email: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
};

type Integration = {
  id: string;
  provider: string;
  is_active: boolean;
};

export function PersonalAssistantAgent() {
  const { token } = useAuth();
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [briefings, setBriefings] = useState<DailyBriefing[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!token) return;
    fetchData();
    checkConnection();
  }, [token]);

  const checkConnection = async () => {
    try {
      const data = await api.get<Integration[]>("/api/integrations?provider=google&is_active=true", { token: token! });
      setIsConnected(Array.isArray(data) && data.length > 0);
    } catch {
      setIsConnected(false);
    }
  };

  const fetchData = async () => {
    try {
      const now = new Date().toISOString();
      const [emailsData, eventsData, briefingsData, draftsData] = await Promise.all([
        api.get<EmailSummary[]>("/api/email-summaries?limit=50", { token: token! }),
        api.get<CalendarEvent[]>(`/api/calendar-events?from=${now}&limit=20`, { token: token! }),
        api.get<DailyBriefing[]>("/api/daily-briefings?limit=7", { token: token! }),
        api.get<EmailDraft[]>("/api/email-drafts?status=draft", { token: token! }),
      ]);

      if (emailsData) setEmails(emailsData);
      if (eventsData) setEvents(eventsData);
      if (briefingsData) setBriefings(briefingsData);
      if (draftsData) setDrafts(draftsData);
    } catch (err) {
      console.error("Error fetching personal assistant data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await api.post<{ emailsProcessed?: number; eventsProcessed?: number }>(
        "/api/sync-gmail-calendar",
        {},
        { token: token! }
      );

      toast({
        title: "Sync complete",
        description: `Synced ${data?.emailsProcessed || 0} emails and ${data?.eventsProcessed || 0} calendar events`,
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync with Google",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectGoogle = async () => {
    toast({
      title: "Google Connection",
      description: "Please configure Google OAuth in your backend settings to enable Gmail and Calendar sync.",
    });
  };

  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      const data = await api.post<{ message?: string }>("/api/send-test-email", {}, { token: token! });

      toast({
        title: "Test email sent!",
        description: data?.message || "Check your inbox for the test email.",
      });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast({
        title: "Failed to send test email",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "urgent": return "bg-destructive/10 text-destructive border-destructive/20";
      case "high": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "normal": return "bg-primary/10 text-primary border-primary/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const urgentEmails = emails.filter(e => e.urgency_level === "urgent" || e.urgency_level === "high");
  const todaysEvents = events.filter(e => {
    const eventDate = new Date(e.start_time).toDateString();
    return eventDate === new Date().toDateString();
  });
  const latestBriefing = briefings[0];

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Personal Assistant</h1>
          <p className="text-muted-foreground">Monitors your inbox and calendar, prioritizes what matters, flags decisions, and delivers clear daily and weekly briefings.</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSendTestEmail}
            disabled={sendingTestEmail}
            variant="outline"
          >
            {sendingTestEmail ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {sendingTestEmail ? "Sending..." : "Send Test Email"}
          </Button>
          {!isConnected ? (
            <Button onClick={handleConnectGoogle} variant="outline" className="border-2 border-primary/50 shadow-md shadow-primary/20">
              <Mail className="h-4 w-4 mr-2" /> Connect Google
            </Button>
          ) : (
            <Button onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-sky-500 hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-sky-500/10">
                <Inbox className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unread Emails</p>
                <p className="text-2xl font-bold">{emails.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-destructive hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Urgent</p>
                <p className="text-2xl font-bold">{urgentEmails.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500 hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <CalendarDays className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today's Meetings</p>
                <p className="text-2xl font-bold">{todaysEvents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Draft Responses</p>
                <p className="text-2xl font-bold">{drafts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest Briefing */}
      {latestBriefing && (
        <Card className="bg-gradient-to-br from-sky-500/5 to-violet-500/5 border-sky-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sky-500/10">
                  <Brain className="h-5 w-5 text-sky-600" />
                </div>
                <div>
                  <CardTitle>Today's Briefing</CardTitle>
                  <CardDescription>
                    {new Date(latestBriefing.briefing_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </CardDescription>
                </div>
              </div>
              {latestBriefing.email_sent_at && (
                <Badge variant="outline" className="text-emerald-600 border-emerald-500/20">
                  <CheckCircle className="h-3 w-3 mr-1" /> Sent at {new Date(latestBriefing.email_sent_at).toLocaleTimeString()}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {latestBriefing.summary_text ? (
              <p className="text-muted-foreground">{latestBriefing.summary_text}</p>
            ) : (
              <p className="text-muted-foreground">No briefing generated yet. Sync your Gmail and Calendar to generate.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="emails" className="space-y-4">
        <TabsList>
          <TabsTrigger value="emails">
            <Mail className="h-4 w-4 mr-2" /> Emails
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="h-4 w-4 mr-2" /> Calendar
          </TabsTrigger>
          <TabsTrigger value="drafts">
            <FileText className="h-4 w-4 mr-2" /> Drafts
          </TabsTrigger>
          <TabsTrigger value="briefings">
            <Brain className="h-4 w-4 mr-2" /> Briefings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="emails">
          <Card>
            <CardHeader>
              <CardTitle>Email Summary</CardTitle>
              <CardDescription>AI-analyzed emails sorted by urgency</CardDescription>
            </CardHeader>
            <CardContent>
              {emails.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No emails synced yet. Connect Google to get started.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {emails.map((email) => (
                      <div key={email.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{email.sender_name || email.sender_email}</p>
                            <Badge className={getUrgencyColor(email.urgency_level)} variant="outline">
                              {email.urgency_level}
                            </Badge>
                            {email.requires_response && (
                              <Badge variant="secondary">Needs Reply</Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium">{email.subject}</p>
                          {email.summary && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{email.summary}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {new Date(email.received_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
              <CardDescription>Your schedule for the next few days</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No upcoming events. Connect Google Calendar to sync.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {events.map((event) => (
                      <div key={event.id} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className="p-2 rounded-lg bg-violet-500/10">
                          <Clock className="h-5 w-5 text-violet-600" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="font-medium">{event.title}</p>
                          {event.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              {event.is_all_day
                                ? "All day"
                                : `${new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              }
                            </span>
                            <span>{new Date(event.start_time).toLocaleDateString()}</span>
                            {event.location && <span>Location: {event.location}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drafts">
          <Card>
            <CardHeader>
              <CardTitle>Email Drafts</CardTitle>
              <CardDescription>AI-generated responses ready for review</CardDescription>
            </CardHeader>
            <CardContent>
              {drafts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No drafts yet. The AI will create drafts for emails that need responses.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {drafts.map((draft) => (
                      <Dialog key={draft.id}>
                        <DialogTrigger asChild>
                          <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                            <div className="space-y-1 flex-1">
                              <p className="font-medium">To: {draft.recipient_email}</p>
                              <p className="text-sm">{draft.subject}</p>
                              <p className="text-sm text-muted-foreground line-clamp-2">{draft.body}</p>
                              <p className="text-xs text-muted-foreground">
                                Created {new Date(draft.created_at).toLocaleString()}
                              </p>
                            </div>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Draft Email</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div>
                              <p className="text-sm text-muted-foreground">To:</p>
                              <p className="font-medium">{draft.recipient_email}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Subject:</p>
                              <p className="font-medium">{draft.subject}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Body:</p>
                              <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap">{draft.body}</div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              This draft has been saved to your Gmail drafts folder for review.
                            </p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="briefings">
          <Card>
            <CardHeader>
              <CardTitle>Daily Briefings</CardTitle>
              <CardDescription>Your morning summaries from the past week</CardDescription>
            </CardHeader>
            <CardContent>
              {briefings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No briefings yet. Enable automation to receive daily morning briefings.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {briefings.map((briefing) => (
                      <div key={briefing.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">
                            {new Date(briefing.briefing_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </p>
                          {briefing.email_sent_at && (
                            <Badge variant="outline" className="text-emerald-600">
                              <CheckCircle className="h-3 w-3 mr-1" /> Sent
                            </Badge>
                          )}
                        </div>
                        {briefing.summary_text && (
                          <p className="text-sm text-muted-foreground">{briefing.summary_text}</p>
                        )}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="p-2 bg-muted rounded">
                            <p className="font-medium">{Array.isArray(briefing.top_priorities) ? briefing.top_priorities.length : 0}</p>
                            <p className="text-muted-foreground">Priorities</p>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <p className="font-medium">{Array.isArray(briefing.urgent_emails) ? briefing.urgent_emails.length : 0}</p>
                            <p className="text-muted-foreground">Urgent Emails</p>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <p className="font-medium">{Array.isArray(briefing.todays_schedule) ? briefing.todays_schedule.length : 0}</p>
                            <p className="text-muted-foreground">Meetings</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
