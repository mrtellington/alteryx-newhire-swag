export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          email: string
          id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          name: string
          product_id: string
          quantity_available: number
          sku: string
        }
        Insert: {
          name: string
          product_id?: string
          quantity_available?: number
          sku: string
        }
        Update: {
          name?: string
          product_id?: string
          quantity_available?: number
          sku?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          date_submitted: string
          id: string
          order_number: string | null
          shipping_carrier: string | null
          status: string | null
          tee_size: string | null
          tracking_number: string | null
          user_id: string
        }
        Insert: {
          date_submitted?: string
          id?: string
          order_number?: string | null
          shipping_carrier?: string | null
          status?: string | null
          tee_size?: string | null
          tracking_number?: string | null
          user_id: string
        }
        Update: {
          date_submitted?: string
          id?: string
          order_number?: string | null
          shipping_carrier?: string | null
          status?: string | null
          tee_size?: string | null
          tracking_number?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          additional_context: Json | null
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          session_id: string | null
          severity:
            | Database["public"]["Enums"]["security_event_severity"]
            | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          additional_context?: Json | null
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          session_id?: string | null
          severity?:
            | Database["public"]["Enums"]["security_event_severity"]
            | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          additional_context?: Json | null
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          session_id?: string | null
          severity?:
            | Database["public"]["Enums"]["security_event_severity"]
            | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          first_name: string | null
          full_name: string | null
          id: string
          invited: boolean
          last_name: string | null
          order_submitted: boolean
          shipping_address: Json | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          invited?: boolean
          last_name?: string | null
          order_submitted?: boolean
          shipping_address?: Json | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          invited?: boolean
          last_name?: string | null
          order_submitted?: boolean
          shipping_address?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_suspicious_activity: {
        Args: {
          event_type_param: string
          max_events?: number
          time_window_minutes?: number
          user_email_param: string
        }
        Returns: boolean
      }
      check_user_order_status: {
        Args: { user_email: string }
        Returns: Json
      }
      cleanup_unauthorized_auth_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          deleted_email: string
          deleted_id: string
        }[]
      }
      create_user_from_webhook: {
        Args:
          | {
              auth_user_id?: string
              user_email: string
              user_first_name?: string
              user_full_name?: string
              user_last_name?: string
              user_shipping_address?: Json
            }
          | {
              auth_user_id?: string
              user_email: string
              user_full_name?: string
              user_shipping_address?: Json
            }
          | {
              user_email: string
              user_full_name?: string
              user_shipping_address?: Json
            }
        Returns: Json
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_admin_status: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_security_dashboard: {
        Args: Record<PropertyKey, never>
        Returns: {
          event_count: number
          event_type: string
          first_occurrence: string
          last_occurrence: string
          severity: Database["public"]["Enums"]["security_event_severity"]
          unique_users: number
        }[]
      }
      is_user_admin: {
        Args: { user_email?: string }
        Returns: boolean
      }
      log_detailed_security_event: {
        Args: {
          additional_context?: Json
          event_type: string
          metadata?: Json
          session_id?: string
          severity?: Database["public"]["Enums"]["security_event_severity"]
          user_id?: string
        }
        Returns: undefined
      }
      log_security_event: {
        Args: { event_type: string; metadata?: Json; user_id?: string }
        Returns: undefined
      }
      place_order: {
        Args: Record<PropertyKey, never> | { tee_size_param?: string }
        Returns: string
      }
      validate_and_sanitize_input: {
        Args: { allow_html?: boolean; input_text: string; max_length?: number }
        Returns: string
      }
      validate_email_domain: {
        Args: { email_param: string }
        Returns: boolean
      }
    }
    Enums: {
      security_event_severity: "low" | "medium" | "high" | "critical"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      security_event_severity: ["low", "medium", "high", "critical"],
    },
  },
} as const
