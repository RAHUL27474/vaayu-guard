// Hand-written to match supabase/migrations/0001_init.sql. Once a live
// Supabase project exists, regenerate with the Supabase CLI/MCP
// (`generate_typescript_types`) and diff against this file.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: Database["public"]["Enums"]["user_role"]
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          created_at?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          id: string
          hostname: string | null
          device_label: string | null
          assigned_email: string
          assigned_phone: string | null
          assigned_to_user: string | null
          enrollment_token_hash: string
          enrollment_token_used_at: string | null
          active_token_hash: string | null
          status: Database["public"]["Enums"]["device_status"]
          last_seen_at: string | null
          consent_acknowledged_at: string | null
          registered_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          hostname?: string | null
          device_label?: string | null
          assigned_email: string
          assigned_phone?: string | null
          assigned_to_user?: string | null
          enrollment_token_hash: string
          enrollment_token_used_at?: string | null
          active_token_hash?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          last_seen_at?: string | null
          consent_acknowledged_at?: string | null
          registered_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          hostname?: string | null
          device_label?: string | null
          assigned_email?: string
          assigned_phone?: string | null
          assigned_to_user?: string | null
          enrollment_token_hash?: string
          enrollment_token_used_at?: string | null
          active_token_hash?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          last_seen_at?: string | null
          consent_acknowledged_at?: string | null
          registered_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_events: {
        Row: {
          id: number
          device_id: string
          captured_at: string
          process_name: string
          window_title: string
          channel: Database["public"]["Enums"]["activity_channel"]
          detected_identity: string | null
          is_mismatch: boolean
          confidence: Database["public"]["Enums"]["event_confidence"]
          created_at: string
        }
        Insert: {
          id?: number
          device_id: string
          captured_at: string
          process_name: string
          window_title: string
          channel: Database["public"]["Enums"]["activity_channel"]
          detected_identity?: string | null
          is_mismatch?: boolean
          confidence?: Database["public"]["Enums"]["event_confidence"]
          created_at?: string
        }
        Update: {
          id?: number
          device_id?: string
          captured_at?: string
          process_name?: string
          window_title?: string
          channel?: Database["public"]["Enums"]["activity_channel"]
          detected_identity?: string | null
          is_mismatch?: boolean
          confidence?: Database["public"]["Enums"]["event_confidence"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          id: number
          device_id: string
          first_seen_at: string
          last_seen_at: string
          detected_identity: string
          channel: Database["public"]["Enums"]["activity_channel"]
          occurrence_count: number
          status: Database["public"]["Enums"]["alert_status"]
          acknowledged_by: string | null
          acknowledged_at: string | null
        }
        Insert: {
          id?: number
          device_id: string
          first_seen_at: string
          last_seen_at: string
          detected_identity: string
          channel: Database["public"]["Enums"]["activity_channel"]
          occurrence_count?: number
          status?: Database["public"]["Enums"]["alert_status"]
          acknowledged_by?: string | null
          acknowledged_at?: string | null
        }
        Update: {
          id?: number
          device_id?: string
          first_seen_at?: string
          last_seen_at?: string
          detected_identity?: string
          channel?: Database["public"]["Enums"]["activity_channel"]
          occurrence_count?: number
          status?: Database["public"]["Enums"]["alert_status"]
          acknowledged_by?: string | null
          acknowledged_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin_like: {
        Args: { uid: string }
        Returns: boolean
      }
      is_superadmin: {
        Args: { uid: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "admin" | "superadmin"
      activity_channel: "email" | "whatsapp"
      event_confidence: "high" | "low"
      device_status: "pending" | "active" | "disabled"
      alert_status: "open" | "acknowledged" | "dismissed"
    }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]

export type Profile = Tables<"profiles">
export type Device = Tables<"devices">
export type ActivityEvent = Tables<"activity_events">
export type Alert = Tables<"alerts">
