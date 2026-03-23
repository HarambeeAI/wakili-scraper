import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Logo from "../components/shared/Logo";

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState("professional");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (plan === "team" && !orgName.trim()) {
      setError("Organization name is required for team plan");
      return;
    }

    setLoading(true);
    try {
      await signup(email, password, name, plan, orgName);
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-block mb-4">
            <Logo />
          </div>
          <h1 className="font-serif text-2xl text-text-primary tracking-tight">
            Create your account
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Start researching with AI-powered precision
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
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-overlay-2 ring-1 ring-overlay-8 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
              placeholder="Jane Doe"
            />
          </div>

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
              placeholder="Minimum 8 characters"
            />
          </div>

          {/* Plan selector */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">
              Plan
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPlan("professional")}
                className={`px-4 py-3 rounded-xl text-left transition-all ring-1 ${
                  plan === "professional"
                    ? "bg-accent/10 ring-accent/30 text-accent"
                    : "bg-overlay-2 ring-overlay-8 text-text-secondary hover:bg-overlay-4"
                }`}
              >
                <span className="text-sm font-medium block">Professional</span>
                <span className="text-[11px] opacity-70">
                  KES 5,999/mo
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPlan("team")}
                className={`px-4 py-3 rounded-xl text-left transition-all ring-1 ${
                  plan === "team"
                    ? "bg-accent/10 ring-accent/30 text-accent"
                    : "bg-overlay-2 ring-overlay-8 text-text-secondary hover:bg-overlay-4"
                }`}
              >
                <span className="text-sm font-medium block">Team</span>
                <span className="text-[11px] opacity-70">5 seats</span>
              </button>
            </div>
          </div>

          {plan === "team" && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Organization / Firm Name
              </label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-overlay-2 ring-1 ring-overlay-8 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
                placeholder="Doe & Partners LLP"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-all"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-text-tertiary mt-6">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-accent hover:text-accent/80 font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
