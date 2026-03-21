import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogto } from "@logto/react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { AccountantAgent } from "@/components/agents/AccountantAgent";
import { MarketerAgent } from "@/components/agents/MarketerAgent";
import { SalesRepAgent } from "@/components/agents/SalesRepAgent";
import { PersonalAssistantAgent } from "@/components/agents/PersonalAssistantAgent";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { AgentChatView } from "@/components/chat/AgentChatView";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { BusinessArtifacts } from "@/components/dashboard/BusinessArtifacts";
import { ConversationalOnboarding } from "@/components/onboarding/ConversationalOnboarding";
import { GenericAgentPanel } from "@/components/agents/GenericAgentPanel";
import { AgentMarketplace } from "@/components/marketplace/AgentMarketplace";
import { TeamView } from "@/components/team/TeamView";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { PushOptInBanner } from "@/components/push/PushOptInBanner";

export type ActiveView =
  | "overview"
  | "team"
  | "accountant"
  | "marketer"
  | "sales"
  | "assistant"
  | "chat"
  | "settings"
  | "artifacts"
  | "marketplace"
  | string;

interface UserAgent {
  agent_type_id: string;
  available_agent_types: {
    id: string;
    display_name: string;
    description: string;
  } | null;
}

interface Profile {
  onboarding_completed: boolean;
  email?: string | null;
}

const Dashboard = () => {
  const { isAuthenticated } = useLogto();
  const { userId, token, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [userAgents, setUserAgents] = useState<UserAgent[]>([]);
  const [showPushOptIn, setShowPushOptIn] = useState(false);
  const navigate = useNavigate();

  // Auth guard — redirect to /auth if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, navigate]);

  const fetchUserAgents = async () => {
    if (!token) return;
    try {
      const data = await api.get<UserAgent[]>("/api/user-agents", { token });
      setUserAgents(data || []);
    } catch (error) {
      console.error("Error fetching user agents:", error);
    }
  };

  // Check onboarding status
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!userId || !token) return;
      try {
        const data = await api.get<Profile>("/api/profiles/me", { token });
        setShowOnboarding(!data?.onboarding_completed);
        if (data?.email) setUserEmail(data.email);
      } catch (error) {
        console.error("Error checking onboarding:", error);
        setShowOnboarding(true);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    if (userId && token) {
      checkOnboarding();
    }
  }, [userId, token]);

  // Show push opt-in banner for existing users who never saw the opt-in step
  useEffect(() => {
    if (!userId || showOnboarding || checkingOnboarding) return;
    if (!("PushManager" in window)) return;
    if (Notification.permission === "denied") return;
    if (localStorage.getItem("push_opt_in_shown")) return;

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!sub) setShowPushOptIn(true);
        else localStorage.setItem("push_opt_in_shown", "1");
      })
      .catch(() => {});
  }, [userId, showOnboarding, checkingOnboarding]);

  // Fetch user's active agents whenever userId/token changes
  useEffect(() => {
    if (userId && token) {
      fetchUserAgents();
    }
  }, [userId, token]);

  if (loading || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (showOnboarding) {
    return (
      <ConversationalOnboarding
        userId={userId ?? ""}
        userEmail={userEmail || ""}
        onComplete={() => {
          setShowOnboarding(false);
          fetchUserAgents();
        }}
      />
    );
  }

  const renderContent = () => {
    switch (activeView) {
      case "overview":
        return (
          <>
            {showPushOptIn && userId && (
              <PushOptInBanner
                userId={userId}
                onDismiss={() => {
                  localStorage.setItem("push_opt_in_shown", "1");
                  setShowPushOptIn(false);
                }}
              />
            )}
            <DashboardOverview onNavigate={setActiveView} />
          </>
        );
      case "team":
        return <TeamView userId={userId ?? undefined} onNavigate={setActiveView} />;
      case "accountant":
        return <AgentChatView agentType="accountant" userId={userId ?? ""} />;
      case "marketer":
        return <AgentChatView agentType="marketer" userId={userId ?? ""} />;
      case "sales":
        return <AgentChatView agentType="sales_rep" userId={userId ?? ""} />;
      case "assistant":
        return (
          <AgentChatView agentType="personal_assistant" userId={userId ?? ""} />
        );
      case "chat":
        return <AgentChatView agentType="chief_of_staff" userId={userId ?? ""} />;
      case "settings":
        return <SettingsPage />;
      case "artifacts":
        return <BusinessArtifacts />;
      case "marketplace":
        return (
          <AgentMarketplace
            userId={userId ?? ""}
            onAgentChange={() => fetchUserAgents()}
          />
        );
      default:
        if (typeof activeView === "string" && activeView.startsWith("agent:")) {
          const agentTypeId = activeView.replace("agent:", "");
          return <AgentChatView agentType={agentTypeId} userId={userId ?? ""} />;
        }
        return <DashboardOverview onNavigate={setActiveView} />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar
          activeView={activeView}
          onViewChange={setActiveView}
          userAgents={userAgents}
        />
        <SidebarInset className="flex-1">
          <DashboardHeader userId={userId} userEmail={userEmail} onNavigate={setActiveView} />
          <main className="flex-1 p-6">{renderContent()}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
