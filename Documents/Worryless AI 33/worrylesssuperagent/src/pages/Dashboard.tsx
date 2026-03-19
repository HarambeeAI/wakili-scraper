import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
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

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [userAgents, setUserAgents] = useState<UserAgent[]>([]);
  const [showPushOptIn, setShowPushOptIn] = useState(false);
  const navigate = useNavigate();

  const fetchUserAgents = async (currentUser: User) => {
    const { data } = await (supabase as any)
      .from("user_agents")
      .select(
        "agent_type_id, available_agent_types(id, display_name, description)",
      )
      .eq("user_id", currentUser.id)
      .eq("is_active", true);
    setUserAgents((data as UserAgent[]) || []);
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Check onboarding status
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Error checking onboarding:", error);
          setShowOnboarding(true);
        } else {
          setShowOnboarding(!data?.onboarding_completed);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    if (user) {
      checkOnboarding();
    }
  }, [user]);

  // Show push opt-in banner for existing users who never saw the opt-in step
  useEffect(() => {
    if (!user || showOnboarding || checkingOnboarding) return;
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
  }, [user, showOnboarding, checkingOnboarding]);

  // Fetch user's active agents whenever user changes
  useEffect(() => {
    if (user) {
      fetchUserAgents(user);
    }
  }, [user]);

  if (loading || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  if (showOnboarding) {
    return (
      <ConversationalOnboarding
        userId={user.id}
        userEmail={user.email || ""}
        onComplete={() => {
          setShowOnboarding(false);
          if (user) fetchUserAgents(user);
        }}
      />
    );
  }

  const renderContent = () => {
    switch (activeView) {
      case "overview":
        return (
          <>
            {showPushOptIn && user && (
              <PushOptInBanner
                userId={user.id}
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
        return <TeamView userId={user?.id} onNavigate={setActiveView} />;
      case "accountant":
        return <AgentChatView agentType="accountant" userId={user!.id} />;
      case "marketer":
        return <AgentChatView agentType="marketer" userId={user!.id} />;
      case "sales":
        return <AgentChatView agentType="sales_rep" userId={user!.id} />;
      case "assistant":
        return (
          <AgentChatView agentType="personal_assistant" userId={user!.id} />
        );
      case "chat":
        return <AgentChatView agentType="chief_of_staff" userId={user!.id} />;
      case "settings":
        return <SettingsPage />;
      case "artifacts":
        return <BusinessArtifacts />;
      case "marketplace":
        return (
          <AgentMarketplace
            userId={user.id}
            onAgentChange={() => fetchUserAgents(user)}
          />
        );
      default:
        if (typeof activeView === "string" && activeView.startsWith("agent:")) {
          const agentTypeId = activeView.replace("agent:", "");
          return <AgentChatView agentType={agentTypeId} userId={user!.id} />;
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
          <DashboardHeader user={user} onNavigate={setActiveView} />
          <main className="flex-1 p-6">{renderContent()}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
