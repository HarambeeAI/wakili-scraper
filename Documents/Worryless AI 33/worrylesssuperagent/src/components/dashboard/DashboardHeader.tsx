import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

interface DashboardHeaderProps {
  userId: string | null;
  userEmail?: string | null;
  onNavigate: (view: string) => void;
}

export function DashboardHeader({
  userId,
  userEmail,
  onNavigate,
}: DashboardHeaderProps) {
  const { signOut } = useAuth();

  return (
    <header className="border-b border-border bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <p className="text-sm text-muted-foreground">Welcome back</p>
            <p className="font-medium text-foreground">{userEmail ?? ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell
            userId={userId ?? undefined}
            onNavigate={onNavigate}
          />
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
