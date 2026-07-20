export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          average_shelf_life_days: number
          color: string
          created_at: string | null
          default_storage: string
          icon: string
          id: string
          name: string
          name_it: string
        }
        Insert: {
          average_shelf_life_days?: number
          color: string
          created_at?: string | null
          default_storage: string
          icon: string
          id?: string
          name: string
          name_it: string
        }
        Update: {
          average_shelf_life_days?: number
          color?: string
          created_at?: string | null
          default_storage?: string
          icon?: string
          id?: string
          name?: string
          name_it?: string
        }
        Relationships: []
      }
      foods: {
        Row: {
          barcode: string | null
          category_id: string
          consumed_at: string | null
          created_at: string | null
          deleted_at: string | null
          expiry_date: string
          id: string
          image_url: string | null
          list_id: string | null
          name: string
          notes: string | null
          quantity: number | null
          quantity_unit: string | null
          status: string | null
          storage_location: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          barcode?: string | null
          category_id: string
          consumed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          expiry_date: string
          id?: string
          image_url?: string | null
          list_id?: string | null
          name: string
          notes?: string | null
          quantity?: number | null
          quantity_unit?: string | null
          status?: string | null
          storage_location: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          barcode?: string | null
          category_id?: string
          consumed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          expiry_date?: string
          id?: string
          image_url?: string | null
          list_id?: string | null
          name?: string
          notes?: string | null
          quantity?: number | null
          quantity_unit?: string | null
          status?: string | null
          storage_location?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "foods_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foods_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          created_by: string
          email: string | null
          expires_at: string
          id: string
          list_id: string
          pending_user_email: string | null
          short_code: string | null
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          created_by: string
          email?: string | null
          expires_at: string
          id?: string
          list_id: string
          pending_user_email?: string | null
          short_code?: string | null
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          created_by?: string
          email?: string | null
          expires_at?: string
          id?: string
          list_id?: string
          pending_user_email?: string | null
          short_code?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_members: {
        Row: {
          id: string
          joined_at: string | null
          list_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          list_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          enabled: boolean
          expiry_intervals: number[]
          id: string
          last_notification_sent_at: string | null
          max_notifications_per_day: number
          notifications_sent_date: string | null
          notifications_sent_today: number
          quiet_hours_enabled: boolean
          quiet_hours_end: number
          quiet_hours_start: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          expiry_intervals?: number[]
          id?: string
          last_notification_sent_at?: string | null
          max_notifications_per_day?: number
          notifications_sent_date?: string | null
          notifications_sent_today?: number
          quiet_hours_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_start?: number
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          expiry_intervals?: number[]
          id?: string
          last_notification_sent_at?: string | null
          max_notifications_per_day?: number
          notifications_sent_date?: string | null
          notifications_sent_today?: number
          quiet_hours_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_start?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_pending_invite_by_email: {
        Args: Record<string, never>
        Returns: {
          error_message: string
          list_id: string
          success: boolean
        }[]
      }
      create_personal_list: {
        Args: never
        Returns: {
          error_message: string
          list_id: string
          success: boolean
        }[]
      }
      current_user_email: {
        Args: Record<string, never>
        Returns: string
      }
      delete_user: { Args: never; Returns: undefined }
      get_expiring_foods_for_notifications: {
        Args: never
        Returns: {
          category_name: string
          days_until_expiry: number
          expiry_date: string
          food_id: string
          food_name: string
          timezone: string
          user_id: string
        }[]
      }
      get_shared_list_member_ids: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      get_user_list_ids: {
        Args: never
        Returns: {
          list_id: string
        }[]
      }
      join_list_via_invite: {
        Args: { p_force?: boolean; p_short_code: string }
        Returns: {
          error_message: string
          food_count: number
          list_id: string
          requires_confirmation: boolean
          success: boolean
        }[]
      }
      register_pending_invite: {
        Args: { p_email: string; p_short_code: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

