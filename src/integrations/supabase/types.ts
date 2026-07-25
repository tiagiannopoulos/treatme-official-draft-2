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
      treatment_before_afters: {
        Row: {
          after_url: string
          before_url: string
          caption: string | null
          created_at: string
          id: string
          provider_name: string | null
          sort_order: number
          treatment_slug: string
          weeks_between: number | null
        }
        Insert: {
          after_url: string
          before_url: string
          caption?: string | null
          created_at?: string
          id?: string
          provider_name?: string | null
          sort_order?: number
          treatment_slug: string
          weeks_between?: number | null
        }
        Update: {
          after_url?: string
          before_url?: string
          caption?: string | null
          created_at?: string
          id?: string
          provider_name?: string | null
          sort_order?: number
          treatment_slug?: string
          weeks_between?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_before_afters_treatment_slug_fkey"
            columns: ["treatment_slug"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["slug"]
          },
        ]
      }
      treatment_story_slides: {
        Row: {
          body: string | null
          created_at: string
          detail_chips: string[]
          headline: string
          id: string
          media_overlay: Database["public"]["Enums"]["slide_overlay"]
          media_url: string | null
          slide_order: number
          slide_type: Database["public"]["Enums"]["slide_type"]
          treatment_slug: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          detail_chips?: string[]
          headline: string
          id?: string
          media_overlay?: Database["public"]["Enums"]["slide_overlay"]
          media_url?: string | null
          slide_order: number
          slide_type: Database["public"]["Enums"]["slide_type"]
          treatment_slug: string
        }
        Update: {
          body?: string | null
          created_at?: string
          detail_chips?: string[]
          headline?: string
          id?: string
          media_overlay?: Database["public"]["Enums"]["slide_overlay"]
          media_url?: string | null
          slide_order?: number
          slide_type?: Database["public"]["Enums"]["slide_type"]
          treatment_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_story_slides_treatment_slug_fkey"
            columns: ["treatment_slug"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["slug"]
          },
        ]
      }
      treatments: {
        Row: {
          category: string
          created_at: string
          downtime: string
          hero_image_url: string | null
          improves: string[]
          name: string
          price_from: number
          science: string
          slug: string
          sort_order: number
          what_it_is: string
          what_to_expect: string
        }
        Insert: {
          category: string
          created_at?: string
          downtime: string
          hero_image_url?: string | null
          improves?: string[]
          name: string
          price_from: number
          science?: string
          slug: string
          sort_order?: number
          what_it_is: string
          what_to_expect: string
        }
        Update: {
          category?: string
          created_at?: string
          downtime?: string
          hero_image_url?: string | null
          improves?: string[]
          name?: string
          price_from?: number
          science?: string
          slug?: string
          sort_order?: number
          what_it_is?: string
          what_to_expect?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      slide_overlay:
        | "cream_scrim"
        | "butter_scrim"
        | "mint_scrim"
        | "bubblegum_scrim"
        | "none"
      slide_type:
        | "hook"
        | "what_it_is"
        | "how_it_works"
        | "science"
        | "what_to_expect"
        | "downtime"
        | "results"
        | "pricing"
        | "cta"
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
      slide_overlay: [
        "cream_scrim",
        "butter_scrim",
        "mint_scrim",
        "bubblegum_scrim",
        "none",
      ],
      slide_type: [
        "hook",
        "what_it_is",
        "how_it_works",
        "science",
        "what_to_expect",
        "downtime",
        "results",
        "pricing",
        "cta",
      ],
    },
  },
} as const
