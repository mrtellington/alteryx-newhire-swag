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
          active: boolean | null
          auth_user_id: string | null
          created_at: string | null
          created_by: string | null
          email: string
          full_name: string
          id: string
          role: string | null
        }
        Insert: {
          active?: boolean | null
          auth_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          role?: string | null
        }
        Update: {
          active?: boolean | null
          auth_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          role?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          name: string
          product_id: string
          quantity_available: number | null
          sku: string
        }
        Insert: {
          name: string
          product_id?: string
          quantity_available?: number | null
          sku: string
        }
        Update: {
          name?: string
          product_id?: string
          quantity_available?: number | null
          sku?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          date_submitted: string | null
          id: string
          order_number: string | null
          shipping_carrier: string | null
          status: string | null
          tee_size: string | null
          tracking_number: string | null
          user_id: string | null
        }
        Insert: {
          date_submitted?: string | null
          id?: string
          order_number?: string | null
          shipping_carrier?: string | null
          status?: string | null
          tee_size?: string | null
          tracking_number?: string | null
          user_id?: string | null
        }
        Update: {
          date_submitted?: string | null
          id?: string
          order_number?: string | null
          shipping_carrier?: string | null
          status?: string | null
          tee_size?: string | null
          tracking_number?: string | null
          user_id?: string | null
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
          additional_context: string | null
          created_at: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          severity:
            | Database["public"]["Enums"]["security_event_severity"]
            | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          additional_context?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?:
            | Database["public"]["Enums"]["security_event_severity"]
            | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          additional_context?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?:
            | Database["public"]["Enums"]["security_event_severity"]
            | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          email: string
          first_name: string | null
          full_name: string
          id: string
          invited: boolean | null
          last_name: string | null
          order_submitted: boolean | null
          shipping_address: Json
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          full_name: string
          id?: string
          invited?: boolean | null
          last_name?: string | null
          order_submitted?: boolean | null
          shipping_address?: Json
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          full_name?: string
          id?: string
          invited?: boolean | null
          last_name?: string | null
          order_submitted?: boolean | null
          shipping_address?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authenticate_secure_readonly_admin: {
        Args: { admin_email: string }
        Returns: Json
      }
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
      create_missing_auth_users: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      create_secure_readonly_admin: {
        Args: { admin_email: string; created_by_email?: string }
        Returns: Json
      }
      create_user_from_webhook: {
        Args:
          | {
              auth_user_id?: string
              order_date?: string
              order_number?: string
              user_email: string
              user_first_name?: string
              user_full_name?: string
              user_last_name?: string
              user_shipping_address?: Json
            }
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
              user_full_name: string
              user_shipping_address?: Json
            }
        Returns: Json
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_admin_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_all_orders_for_admin: {
        Args: Record<PropertyKey, never>
        Returns: {
          date_submitted: string
          id: string
          order_number: string
          shipping_carrier: string
          status: string
          tee_size: string
          tracking_number: string
          user_id: string
        }[]
      }
      get_auth_users_to_clean: {
        Args: Record<PropertyKey, never>
        Returns: {
          email: string
          reason: string
        }[]
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
      is_current_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_full_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_secure_readonly_admin: {
        Args: { admin_email?: string }
        Returns: boolean
      }
      is_system_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_user_admin: {
        Args: { user_email?: string }
        Returns: boolean
      }
      link_existing_auth_users: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      list_all_views: {
        Args: Record<PropertyKey, never>
        Returns: {
          view_definition: string
          view_name: string
        }[]
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
        Args: {
          event_type_param: string
          metadata_param?: Json
          user_id_param?: string
        }
        Returns: undefined
      }
      notify_slack_on_events: {
        Args: { event_data?: Json; event_type_param: string }
        Returns: undefined
      }
      nuclear_reset_all_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      place_order: {
        Args:
          | Record<PropertyKey, never>
          | { tee_size_param?: string }
          | { tee_size_param?: string; user_uuid: string }
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
