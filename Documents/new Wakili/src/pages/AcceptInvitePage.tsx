import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Logo from "../components/shared/Logo";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [inviteInfo, setInviteInfo] = useState<{
    email: string;
    org_name: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/auth/invite/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("Invalid invite");
        return res.json();
      })
      .then(setInviteInfo)
      .catch(() => setError("This invite link is invalid or has already been used."))
      .finally(() => setPageLoading(false));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/invite/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to accept invite");
      }

      const data = await res.json();
      localStorage.setItem("lawlyfy_token", data.access_token);
      localStorage.setItem("lawlyfy_user", JSON.stringify(data.user));
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-surface">
        <div className="text-text-tertiary text-sm">Loading invite...</div>
      </div>
    );
  }

  if (!inviteInfo) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-surface px-4">
        <div className="text-center max-w-sm">
          <Logo />
          <h1 className="font-serif text-2xl text-text-primary mt-6 mb-2">
            Invalid Invite
          </h1>
          <p className="text-sm text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-block mb-4">
            <Logo />
          </div>
          <h1 className="font-serif text-2xl text-text-primary tracking-tight">
            Join {inviteInfo.org_name}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            You've been invited to join{" "}
            <strong>{inviteInfo.org_name}</strong> on Lawlyfy
          </p>
          <p className="text-xs text-text-tertiary mt-2">
            Signing up as {inviteInfo.email}
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
              Your Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-overlay-2 ring-1 ring-overlay-8 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Create Password
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-all"
          >
            {loading ? "Setting up..." : "Accept & Join"}
          </button>
        </form>
      </div>
    </div>
  );
}
