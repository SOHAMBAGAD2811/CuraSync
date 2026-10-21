"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      // If user session is established immediately (email confirm disabled)
      if (data.session) {
        // Ensure patient_settings exists
        if (data.user) {
          await supabase
            .from("patient_settings")
            .upsert({
              patient_id: data.user.id,
              timezone: "Asia/Kolkata",
              missed_dose_grace_minutes: 60,
            })
            .select();
        }
        router.push("/dashboard");
        router.refresh();
      } else if (data.user) {
        setSuccessMsg(
          "Registration successful! If confirmation is required, please check your email before signing in."
        );
        setLoading(false);
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
        <h1 className="text-2xl font-semibold text-slate-900">
          Create an account
        </h1>
        <p className="text-sm text-slate-500">
          Start managing your health today
        </p>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-slate-700"
          >
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-500"
            placeholder="Jane Doe"
          />
        </div>

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
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-500"
            placeholder="Min. 6 characters"
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
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-sky-600 hover:text-sky-700 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
