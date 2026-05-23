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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      category_covers: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_profile: {
        Row: {
          about: string | null
          address: string | null
          email: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          linkedin_url: string | null
          logo_url: string | null
          name: string
          partners_intro: string | null
          partners_layout: Json
          phone: string | null
          services: Json
          updated_at: string
          website: string | null
          youtube_url: string | null
        }
        Insert: {
          about?: string | null
          address?: string | null
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name?: string
          partners_intro?: string | null
          partners_layout?: Json
          phone?: string | null
          services?: Json
          updated_at?: string
          website?: string | null
          youtube_url?: string | null
        }
        Update: {
          about?: string | null
          address?: string | null
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name?: string
          partners_intro?: string | null
          partners_layout?: Json
          phone?: string | null
          services?: Json
          updated_at?: string
          website?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      export_template_assignments: {
        Row: {
          export_kind: string
          set_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          export_kind: string
          set_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          export_kind?: string
          set_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_template_assignments_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "template_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      fitout_projects: {
        Row: {
          brand: string | null
          city_province: string | null
          comments: string | null
          contract_period_days: number | null
          created_at: string
          created_by: string | null
          date_added: string | null
          fitout_completion: string | null
          fitout_period_days: number | null
          hod: string | null
          id: string
          location: string | null
          pm: string | null
          project_type: string | null
          size_m2: number | null
          snag_completion_date: string | null
          snag_prep_date: string | null
          start_on_site: string | null
          status: string
          store_handover: string | null
          store_opening: string | null
          supervisor: string | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          city_province?: string | null
          comments?: string | null
          contract_period_days?: number | null
          created_at?: string
          created_by?: string | null
          date_added?: string | null
          fitout_completion?: string | null
          fitout_period_days?: number | null
          hod?: string | null
          id?: string
          location?: string | null
          pm?: string | null
          project_type?: string | null
          size_m2?: number | null
          snag_completion_date?: string | null
          snag_prep_date?: string | null
          start_on_site?: string | null
          status?: string
          store_handover?: string | null
          store_opening?: string | null
          supervisor?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          city_province?: string | null
          comments?: string | null
          contract_period_days?: number | null
          created_at?: string
          created_by?: string | null
          date_added?: string | null
          fitout_completion?: string | null
          fitout_period_days?: number | null
          hod?: string | null
          id?: string
          location?: string | null
          pm?: string | null
          project_type?: string | null
          size_m2?: number | null
          snag_completion_date?: string | null
          snag_prep_date?: string | null
          start_on_site?: string | null
          status?: string
          store_handover?: string | null
          store_opening?: string | null
          supervisor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fitout_sheet_config: {
        Row: {
          created_at: string
          enabled: boolean
          header_row: number
          id: string
          last_result: Json | null
          last_synced_at: string | null
          sheet_id: string | null
          sheet_url: string | null
          updated_at: string
          worksheet_name: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          header_row?: number
          id?: string
          last_result?: Json | null
          last_synced_at?: string | null
          sheet_id?: string | null
          sheet_url?: string | null
          updated_at?: string
          worksheet_name?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          header_row?: number
          id?: string
          last_result?: Json | null
          last_synced_at?: string | null
          sheet_id?: string | null
          sheet_url?: string | null
          updated_at?: string
          worksheet_name?: string | null
        }
        Relationships: []
      }
      fitout_sheet_sync_runs: {
        Row: {
          errors: Json
          finished_at: string | null
          id: string
          inserted: number
          skipped: number
          started_at: string
          status: string
          triggered_by: string
          updated: number
        }
        Insert: {
          errors?: Json
          finished_at?: string | null
          id?: string
          inserted?: number
          skipped?: number
          started_at?: string
          status?: string
          triggered_by?: string
          updated?: number
        }
        Update: {
          errors?: Json
          finished_at?: string | null
          id?: string
          inserted?: number
          skipped?: number
          started_at?: string
          status?: string
          triggered_by?: string
          updated?: number
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted: boolean
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted?: boolean
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted?: boolean
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      lead_intake_tokens: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          label: string | null
          token: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          token: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          message: string | null
          name: string
          phone: string | null
          project_id: string | null
          source: string
          source_meta: Json
          stage: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          project_id?: string | null
          source?: string
          source_meta?: Json
          stage?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          project_id?: string | null
          source?: string
          source_meta?: Json
          stage?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_connections: {
        Row: {
          access_token: string
          created_at: string
          email: string | null
          expires_at: string | null
          linkedin_sub: string
          name: string | null
          picture: string | null
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email?: string | null
          expires_at?: string | null
          linkedin_sub: string
          name?: string | null
          picture?: string | null
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string | null
          expires_at?: string | null
          linkedin_sub?: string
          name?: string | null
          picture?: string | null
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_oauth_states: {
        Row: {
          created_at: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pdf_templates: {
        Row: {
          background_url: string | null
          created_at: string
          id: string
          page_type: string
          set_id: string | null
          slots: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          background_url?: string | null
          created_at?: string
          id?: string
          page_type: string
          set_id?: string | null
          slots?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          background_url?: string | null
          created_at?: string
          id?: string
          page_type?: string
          set_id?: string | null
          slots?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          phone?: string | null
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          area_sqm: number | null
          client_name: string | null
          cover_image: string | null
          created_at: string
          created_by: string | null
          description: string | null
          estimated_completion: string | null
          highlights: Json
          id: string
          images: Json
          location: string | null
          name: string
          phase: string | null
          progress_pct: number
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          area_sqm?: number | null
          client_name?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_completion?: string | null
          highlights?: Json
          id?: string
          images?: Json
          location?: string | null
          name: string
          phase?: string | null
          progress_pct?: number
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          area_sqm?: number | null
          client_name?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_completion?: string | null
          highlights?: Json
          id?: string
          images?: Json
          location?: string | null
          name?: string
          phase?: string | null
          progress_pct?: number
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_page_permissions: {
        Row: {
          allowed: boolean
          page: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          page: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          page?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          content: string
          created_at: string
          error: string | null
          id: string
          image_urls: Json
          platform: string
          project_id: string | null
          published_id: string | null
          scheduled_for: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          error?: string | null
          id?: string
          image_urls?: Json
          platform?: string
          project_id?: string | null
          published_id?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          error?: string | null
          id?: string
          image_urls?: Json
          platform?: string
          project_id?: string | null
          published_id?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      template_pages: {
        Row: {
          created_at: string
          id: string
          image_url: string
          page_index: number
          role: string | null
          set_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          page_index?: number
          role?: string | null
          set_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          page_index?: number
          role?: string | null
          set_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_pages_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "template_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      template_sets: {
        Row: {
          created_at: string
          id: string
          name: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "manager" | "marketing"
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
      app_role: ["admin", "user", "manager", "marketing"],
    },
  },
} as const
