"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMsg(message);
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
      {/* Logo */}
      <div className="flex items-center gap-2 justify-center">
        <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center shadow-sm">
          <Heart className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-slate-900 tracking-tight">
          CuraSync
        </span>
      </div>

      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
        <p className="text-sm text-slate-500">Sign in to your patient account</p>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-500"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-500"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-sky-600 hover:text-sky-700 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
