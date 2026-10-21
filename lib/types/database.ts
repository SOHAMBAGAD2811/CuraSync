export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DoseStatus =
  | "scheduled"
  | "pending"
  | "acknowledged"
  | "late"
  | "missed";

export type CompartmentNumber = 1 | 2 | 3;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      patient_settings: {
        Row: {
          id: string;
          patient_id: string;
          timezone: string;
          missed_dose_grace_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          timezone?: string;
          missed_dose_grace_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          timezone?: string;
          missed_dose_grace_minutes?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patient_settings_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      caregiver_links: {
        Row: {
          id: string;
          patient_id: string;
          caregiver_id: string;
          status: "pending" | "active" | "revoked";
          permissions: Json;
          invited_at: string;
          accepted_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          caregiver_id: string;
          status?: "pending" | "active" | "revoked";
          permissions?: Json;
          invited_at?: string;
          accepted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "active" | "revoked";
          permissions?: Json;
          accepted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "caregiver_links_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "caregiver_links_caregiver_id_fkey";
            columns: ["caregiver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      devices: {
        Row: {
          id: string;
          patient_id: string;
          device_key: string;
          label: string | null;
          last_heartbeat_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          device_key: string;
          label?: string | null;
          last_heartbeat_at?: string | null;
          created_at?: string;
        };
        Update: {
          label?: string | null;
          last_heartbeat_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "devices_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      medications: {
        Row: {
          id: string;
          patient_id: string;
          name: string;
          dosage: string | null;
          instructions: string | null;
          start_date: string;
          end_date: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          name: string;
          dosage?: string | null;
          instructions?: string | null;
          start_date: string;
          end_date?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          dosage?: string | null;
          instructions?: string | null;
          start_date?: string;
          end_date?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "medications_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      medication_schedules: {
        Row: {
          id: string;
          medication_id: string;
          patient_id: string;
          compartment_number: CompartmentNumber;
          scheduled_time: string; // HH:MM:SS or HH:MM
          days_of_week: number[]; // 0=Sun … 6=Sat
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          medication_id: string;
          patient_id: string;
          compartment_number: CompartmentNumber;
          scheduled_time: string;
          days_of_week: number[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          compartment_number?: CompartmentNumber;
          scheduled_time?: string;
          days_of_week?: number[];
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "medication_schedules_medication_id_fkey";
            columns: ["medication_id"];
            isOneToOne: false;
            referencedRelation: "medications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "medication_schedules_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      dose_occurrences: {
        Row: {
          id: string;
          schedule_id: string;
          patient_id: string;
          due_at: string;
          status: DoseStatus;
          acknowledged_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          patient_id: string;
          due_at: string;
          status?: DoseStatus;
          acknowledged_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: DoseStatus;
          acknowledged_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dose_occurrences_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "medication_schedules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dose_occurrences_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      device_events: {
        Row: {
          id: string;
          device_id: string;
          patient_id: string;
          event_type: "heartbeat" | "compartment_open" | "compartment_close";
          compartment_number: CompartmentNumber | null;
          event_time: string;
          raw_payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          patient_id: string;
          event_type: "heartbeat" | "compartment_open" | "compartment_close";
          compartment_number?: CompartmentNumber | null;
          event_time: string;
          raw_payload?: Json | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "device_events_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "device_events_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      notifications: {
        Row: {
          id: string;
          patient_id: string;
          type: "dose_due" | "dose_late" | "dose_missed" | "sos" | "general";
          title: string;
          body: string | null;
          is_read: boolean;
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          type: "dose_due" | "dose_late" | "dose_missed" | "sos" | "general";
          title: string;
          body?: string | null;
          is_read?: boolean;
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          is_read?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      sos_alerts: {
        Row: {
          id: string;
          patient_id: string;
          status: "active" | "acknowledged" | "resolved";
          notes: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          patient_id: string;
          status?: "active" | "acknowledged" | "resolved";
          notes?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          status?: "active" | "acknowledged" | "resolved";
          notes?: string | null;
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sos_alerts_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      vital_signs: {
        Row: {
          id: string;
          patient_id: string;
          type: string;
          value: number;
          unit: string;
          measured_at: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          type: string;
          value: number;
          unit: string;
          measured_at: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          type?: string;
          value?: number;
          unit?: string;
          measured_at?: string;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vital_signs_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      medical_documents: {
        Row: {
          id: string;
          patient_id: string;
          label: string;
          storage_path: string;
          file_type: string | null;
          file_size_bytes: number | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          label: string;
          storage_path: string;
          file_type?: string | null;
          file_size_bytes?: number | null;
          uploaded_at?: string;
        };
        Update: {
          label?: string;
        };
        Relationships: [
          {
            foreignKeyName: "medical_documents_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      medical_history: {
        Row: {
          id: string;
          patient_id: string;
          condition: string;
          diagnosed_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          condition: string;
          diagnosed_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          condition?: string;
          diagnosed_at?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "medical_history_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      appointments: {
        Row: {
          id: string;
          patient_id: string;
          title: string;
          doctor_name: string | null;
          location: string | null;
          scheduled_at: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          title: string;
          doctor_name?: string | null;
          location?: string | null;
          scheduled_at: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          doctor_name?: string | null;
          location?: string | null;
          scheduled_at?: string;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
