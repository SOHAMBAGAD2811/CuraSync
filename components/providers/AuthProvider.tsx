"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type PatientSettings = Database["public"]["Tables"]["patient_settings"]["Row"];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  settings: PatientSettings | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  settings: null,
  loading: true,
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<PatientSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchUserData = useCallback(async (currentUser: User) => {
    try {
      // 1. Fetch or create profile
      let { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (!prof && (!profErr || profErr.code === "PGRST116")) {
        // Fallback insert if trigger did not run
        const fullName =
          currentUser.user_metadata?.full_name ||
          currentUser.email?.split("@")[0] ||
          "Patient";
        const { data: newProf } = await supabase
          .from("profiles")
          .insert({
            id: currentUser.id,
            full_name: fullName,
          })
          .select()
          .maybeSingle();
        prof = newProf;
      }
      setProfile(prof ?? null);

      // 2. Fetch or create patient_settings
      let { data: sett, error: settErr } = await supabase
        .from("patient_settings")
        .select("*")
        .eq("patient_id", currentUser.id)
        .maybeSingle();

      if (!sett && (!settErr || settErr.code === "PGRST116")) {
        const { data: newSett } = await supabase
          .from("patient_settings")
          .insert({
            patient_id: currentUser.id,
            timezone: "Asia/Kolkata",
            missed_dose_grace_minutes: 60,
          })
          .select()
          .maybeSingle();
        sett = newSett;
      }
      setSettings(sett ?? null);
    } catch (e) {
      console.error("Error fetching user data:", e);
    }
  }, [supabase]);

  const refresh = useCallback(async () => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    setUser(currentUser);
    if (currentUser) {
      await fetchUserData(currentUser);
    } else {
      setProfile(null);
      setSettings(null);
    }
  }, [supabase, fetchUserData]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      setUser(currentUser);

      if (currentUser) {
        await fetchUserData(currentUser);
      }
      if (mounted) {
        setLoading(false);
      }
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        await fetchUserData(sessionUser);
      } else {
        setProfile(null);
        setSettings(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserData]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSettings(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        settings,
        loading,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
