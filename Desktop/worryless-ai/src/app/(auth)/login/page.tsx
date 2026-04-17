"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message || "Invalid credentials");
        return;
      }

      router.push("/onboarding");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl section-card p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-dark">Welcome back</h1>
          <p className="text-muted-dark mt-2 text-sm">
            Log in to your Worryless AI account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="email" label="Email" type="email" placeholder="jane@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input id="password" label="Password" type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <Button type="submit" isLoading={isLoading} className="w-full">
            Log in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-dark">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
