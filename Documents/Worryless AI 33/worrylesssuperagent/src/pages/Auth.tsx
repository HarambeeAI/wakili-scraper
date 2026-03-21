import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLogto } from "@logto/react";
import { useAuth } from "@/hooks/useAuth";

const Auth = () => {
  const { signIn } = useAuth();
  const { isAuthenticated } = useLogto();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      signIn();
    }
  }, [isAuthenticated, signIn, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Redirecting to sign in...</p>
    </div>
  );
};

export default Auth;
