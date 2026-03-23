import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Logo from "../components/shared/Logo";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-block mb-4">
            <Logo />
          </div>
          <h1 className="font-serif text-2xl text-text-primary tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Sign in to continue your research
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-error/10 text-error text-sm ring-1 ring-error/20">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-overlay-2 ring-1 ring-overlay-8 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
              placeholder="you@firm.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-overlay-2 ring-1 ring-overlay-8 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-all"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-text-tertiary mt-6">
          Don't have an account?{" "}
          <Link
            to="/signup"
            className="text-accent hover:text-accent/80 font-medium"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
