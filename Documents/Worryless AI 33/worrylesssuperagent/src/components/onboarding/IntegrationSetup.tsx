import { Mail, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface IntegrationSetupProps {
  onContinue: () => void;
}

export function IntegrationSetup({ onContinue }: IntegrationSetupProps) {
  const { toast } = useToast();

  const handleConnectGoogle = () => {
    const redirectTo = `${window.location.origin}/dashboard`;
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  };

  const handleBrowserLogin = () => {
    toast({
      title: "Coming soon",
      description: "Browser login setup coming soon",
    });
  };

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold">Connect Your Tools</h2>
      <div className="mt-6 space-y-3">
        {/* Google Workspace tile */}
        <div className="flex items-center gap-4 p-4 border rounded-lg h-20">
          <Mail className="h-8 w-8 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Google Workspace</p>
            <p className="text-xs text-muted-foreground">
              Gmail, Calendar, Drive
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto shrink-0"
            onClick={handleConnectGoogle}
          >
            Connect Google Account
          </Button>
        </div>

        {/* Social Browser tile */}
        <div className="flex items-center gap-4 p-4 border rounded-lg h-20">
          <Globe className="h-8 w-8 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Social Media Browser</p>
            <p className="text-xs text-muted-foreground">
              Log in to your social accounts for the Marketer
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto shrink-0"
            onClick={handleBrowserLogin}
          >
            Set Up Browser Login
          </Button>
        </div>
      </div>

      <button
        onClick={onContinue}
        className="text-xs text-muted-foreground underline-offset-4 hover:underline mt-4 mx-auto block"
      >
        I'll do this later
      </button>
    </div>
  );
}
