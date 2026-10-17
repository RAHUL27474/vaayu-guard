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
          consent_notice_version: number | null
          agent_version: number | null
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
          consent_notice_version?: number | null
          agent_version?: number | null
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
          consent_notice_version?: number | null
          agent_version?: number | null
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
          is_foreground: boolean
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
          is_foreground?: boolean
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
          is_foreground?: boolean
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
          close_requested_at: string | null
          close_requested_by: string | null
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
          close_requested_at?: string | null
          close_requested_by?: string | null
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
          close_requested_at?: string | null
          close_requested_by?: string | null
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
          {
            foreignKeyName: "alerts_close_requested_by_fkey"
            columns: ["close_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      window_activity: {
        Row: {
          id: number
          device_id: string
          captured_at: string
          process_name: string
          window_title: string
          url: string | null
          browser_profile: string | null
          account_email: string | null
          whatsapp_number: string | null
          is_foreground: boolean
          created_at: string
        }
        Insert: {
          id?: number
          device_id: string
          captured_at: string
          process_name: string
          window_title: string
          url?: string | null
          browser_profile?: string | null
          account_email?: string | null
          whatsapp_number?: string | null
          is_foreground?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          device_id?: string
          captured_at?: string
          process_name?: string
          window_title?: string
          url?: string | null
          browser_profile?: string | null
          account_email?: string | null
          whatsapp_number?: string | null
          is_foreground?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "window_activity_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          id: number
          device_id: string
          detected_identity: string
          channel: Database["public"]["Enums"]["activity_channel"]
          started_at: string
          last_seen_at: string
          ended_at: string | null
          total_hits: number
          foreground_hits: number
        }
        Insert: {
          id?: number
          device_id: string
          detected_identity: string
          channel: Database["public"]["Enums"]["activity_channel"]
          started_at: string
          last_seen_at: string
          ended_at?: string | null
          total_hits?: number
          foreground_hits?: number
        }
        Update: {
          id?: number
          device_id?: string
          detected_identity?: string
          channel?: Database["public"]["Enums"]["activity_channel"]
          started_at?: string
          last_seen_at?: string
          ended_at?: string | null
          total_hits?: number
          foreground_hits?: number
        }
        Relationships: [
          {
            foreignKeyName: "sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: boolean
          uninstall_code: string
          developer_code: string
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          uninstall_code: string
          developer_code?: string
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          uninstall_code?: string
          developer_code?: string
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visibility_filters: {
        Row: {
          id: number
          device_id: string
          target: Database["public"]["Enums"]["filter_target"]
          pattern: string
          note: string | null
          active: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: number
          device_id: string
          target: Database["public"]["Enums"]["filter_target"]
          pattern: string
          note?: string | null
          active?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          device_id?: string
          target?: Database["public"]["Enums"]["filter_target"]
          pattern?: string
          note?: string | null
          active?: boolean
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visibility_filters_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      daily_identity_activity: {
        Row: {
          device_id: string
          detected_identity: string
          channel: Database["public"]["Enums"]["activity_channel"]
          activity_date: string
          session_count: number
          total_duration_seconds: number
          foreground_hits: number
          total_hits: number
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin_like: {
        Args: { uid: string }
        Returns: boolean
      }
      is_developer: {
        Args: { uid: string }
        Returns: boolean
      }
    }
    Enums: {
      filter_target: "tab" | "email" | "whatsapp" | "profile" | "app"
      user_role: "admin" | "developer"
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
export type Session = Tables<"sessions">
export type WindowActivity = Tables<"window_activity">
export type VisibilityFilter = Tables<"visibility_filters">
export type AppSettings = Tables<"app_settings">
export type DailyIdentityActivity =
  Database["public"]["Views"]["daily_identity_activity"]["Row"]
