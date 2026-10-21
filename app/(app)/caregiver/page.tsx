"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Plus,
  Check,
  X,
  Shield,
  Loader2,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Database } from "@/lib/types/database";

type CaregiverLink = Database["public"]["Tables"]["caregiver_links"]["Row"];

const PERMISSION_CONFIG = [
  { id: "viewSchedule", label: "View medication schedules" },
  { id: "viewReports", label: "View weekly adherence reports" },
  { id: "viewHealthRecords", label: "View vital signs & health history" },
  { id: "viewSOS", label: "View emergency SOS events" },
  { id: "manageMedicines", label: "Manage medicines & schedules" },
];

export default function CaregiverPage() {
  const { user } = useAuth();
  const [links, setLinks] = useState<CaregiverLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [caregiverEmail, setCaregiverEmail] = useState("");
  const [permissions, setPermissions] = useState<{ [key: string]: boolean }>({
    viewSchedule: true,
    viewReports: true,
    viewHealthRecords: false,
    viewSOS: true,
    manageMedicines: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabase = createClient();

  const fetchCaregivers = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from("caregiver_links")
      .select("*")
      .eq("patient_id", user.id)
      .order("invited_at", { ascending: false });

    setLinks(data || []);
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchCaregivers();
  }, [fetchCaregivers]);

  const togglePermission = (key: string) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleInviteCaregiver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // Find or check profile by email (or create a pending placeholder)
      // Since Supabase auth users have UUID, we look up or generate a mock link target
      const mockCaregiverId = crypto.randomUUID();

      const { error } = await supabase.from("caregiver_links").insert({
        patient_id: user.id,
        caregiver_id: mockCaregiverId,
        status: "pending",
        permissions: { ...permissions, caregiver_email: caregiverEmail.trim() },
      });

      if (error) throw new Error(error.message);

      setCaregiverEmail("");
      setInviteModalOpen(false);
      fetchCaregivers();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to invite caregiver"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    await supabase.from("caregiver_links").delete().eq("id", linkId);
    fetchCaregivers();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Caregivers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Coordinate with family members and manage granular data access permissions
          </p>
        </div>
        <button
          onClick={() => {
            setErrorMsg(null);
            setInviteModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 text-white text-sm font-semibold rounded-xl hover:bg-sky-600 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Invite Caregiver
        </button>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center items-center">
          <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
        </div>
      ) : links.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">
            No caregivers linked
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Invite a family member or doctor to securely monitor your medication adherence and SOS signals.
          </p>
          <button
            onClick={() => setInviteModalOpen(true)}
            className="mt-4 px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-600"
          >
            Invite first caregiver
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {links.map((link) => {
            const perms = (link.permissions as Record<string, boolean | string>) || {};
            const email = (perms.caregiver_email as string) || "Family Member";

            return (
              <div
                key={link.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-sm">
                      {email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">
                        {email}
                      </p>
                      <p className="text-xs text-slate-400">
                        Invited on {new Date(link.invited_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        link.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {link.status === "active" ? "Active" : "Invitation Pending"}
                    </span>
                    <button
                      onClick={() => handleRevoke(link.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold p-1 hover:bg-red-50 rounded"
                      title="Revoke access"
                    >
                      Revoke
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Granted Permissions
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {PERMISSION_CONFIG.map(({ id, label }) => {
                      const granted = Boolean(perms[id]);
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-2 text-slate-700"
                        >
                          {granted ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <X className="w-4 h-4 text-slate-300" />
                          )}
                          <span>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900">Invite Caregiver</h3>
              <button onClick={() => setInviteModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleInviteCaregiver} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Caregiver Email *
                </label>
                <input
                  type="email"
                  required
                  value={caregiverEmail}
                  onChange={(e) => setCaregiverEmail(e.target.value)}
                  placeholder="caregiver@family.com"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-2 block">
                  Configure Permissions
                </label>
                <div className="space-y-2">
                  {PERMISSION_CONFIG.map(({ id, label }) => (
                    <label
                      key={id}
                      className="flex items-center justify-between text-xs text-slate-700 cursor-pointer p-2 rounded-lg bg-slate-50 hover:bg-slate-100"
                    >
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={permissions[id]}
                        onChange={() => togglePermission(id)}
                        className="w-4 h-4 accent-sky-500 rounded"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-semibold hover:bg-sky-600 disabled:opacity-60"
                >
                  {submitting ? "Inviting..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
