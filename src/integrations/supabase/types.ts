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
      education_stories: {
        Row: {
          category: string | null
          cover_image: string | null
          cover_tone: Database["public"]["Enums"]["slide_overlay"]
          created_at: string
          id: string
          published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          cover_image?: string | null
          cover_tone?: Database["public"]["Enums"]["slide_overlay"]
          created_at?: string
          id?: string
          published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          cover_image?: string | null
          cover_tone?: Database["public"]["Enums"]["slide_overlay"]
          created_at?: string
          id?: string
          published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      education_story_slides: {
        Row: {
          body: string | null
          created_at: string
          detail_chips: string[]
          headline: string
          id: string
          media_overlay: Database["public"]["Enums"]["slide_overlay"]
          media_url: string | null
          slide_order: number
          slide_type: Database["public"]["Enums"]["education_slide_type"]
          story_id: string
          updated_at: string
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
          slide_type: Database["public"]["Enums"]["education_slide_type"]
          story_id: string
          updated_at?: string
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
          slide_type?: Database["public"]["Enums"]["education_slide_type"]
          story_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_story_slides_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "education_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_health_flags: {
        Row: {
          allergies: string | null
          autoimmune_condition: boolean | null
          blood_thinners: boolean | null
          keloid_history: boolean | null
          other_notes: string | null
          pregnant_or_breastfeeding: boolean | null
          recent_isotretinoin: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allergies?: string | null
          autoimmune_condition?: boolean | null
          blood_thinners?: boolean | null
          keloid_history?: boolean | null
          other_notes?: string | null
          pregnant_or_breastfeeding?: boolean | null
          recent_isotretinoin?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allergies?: string | null
          autoimmune_condition?: boolean | null
          blood_thinners?: boolean | null
          keloid_history?: boolean | null
          other_notes?: string | null
          pregnant_or_breastfeeding?: boolean | null
          recent_isotretinoin?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      patient_profile: {
        Row: {
          budget_band: string | null
          concerns: string[] | null
          downtime_tolerance: string | null
          goals: string[] | null
          languages: string[] | null
          md_only: boolean | null
          needle_comfort: string | null
          preferred_provider_gender: string | null
          skin_type: string | null
          travel_radius_km: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          budget_band?: string | null
          concerns?: string[] | null
          downtime_tolerance?: string | null
          goals?: string[] | null
          languages?: string[] | null
          md_only?: boolean | null
          needle_comfort?: string | null
          preferred_provider_gender?: string | null
          skin_type?: string | null
          travel_radius_km?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          budget_band?: string | null
          concerns?: string[] | null
          downtime_tolerance?: string | null
          goals?: string[] | null
          languages?: string[] | null
          md_only?: boolean | null
          needle_comfort?: string | null
          preferred_provider_gender?: string | null
          skin_type?: string | null
          travel_radius_km?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      provider_media: {
        Row: {
          after_url: string
          approved: boolean
          before_url: string
          consent_confirmed: boolean
          created_at: string
          id: string
          provider_id: string
          sort_order: number
          treatment_name: string
          treatment_slug: string
          updated_at: string
          weeks_between: number | null
          weeks_elapsed: number | null
        }
        Insert: {
          after_url: string
          approved?: boolean
          before_url: string
          consent_confirmed?: boolean
          created_at?: string
          id?: string
          provider_id: string
          sort_order?: number
          treatment_name: string
          treatment_slug: string
          updated_at?: string
          weeks_between?: number | null
          weeks_elapsed?: number | null
        }
        Update: {
          after_url?: string
          approved?: boolean
          before_url?: string
          consent_confirmed?: boolean
          created_at?: string
          id?: string
          provider_id?: string
          sort_order?: number
          treatment_name?: string
          treatment_slug?: string
          updated_at?: string
          weeks_between?: number | null
          weeks_elapsed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_media_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_rating_stats"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_media_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_reviews: {
        Row: {
          body: string
          created_at: string
          id: string
          provider_id: string
          published: boolean
          rating: number
          reviewed_at: string
          reviewer_name: string
          treatment_name: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          provider_id: string
          published?: boolean
          rating?: number
          reviewed_at?: string
          reviewer_name: string
          treatment_name?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          provider_id?: string
          published?: boolean
          rating?: number
          reviewed_at?: string
          reviewer_name?: string
          treatment_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_rating_stats"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_storefronts: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          provider_id: string
          storefront_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          provider_id: string
          storefront_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          provider_id?: string
          storefront_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_storefronts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_rating_stats"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_storefronts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_storefronts_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_storefronts_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_treatments: {
        Row: {
          created_at: string
          id: string
          price_from: number | null
          provider_id: string
          treatment_slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_from?: number | null
          provider_id: string
          treatment_slug: string
        }
        Update: {
          created_at?: string
          id?: string
          price_from?: number | null
          provider_id?: string
          treatment_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_treatments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "provider_rating_stats"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "provider_treatments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          avatar_url: string | null
          bio: string
          claimed: boolean
          created_at: string
          credentials: string
          id: string
          is_seed_data: boolean
          languages: string[]
          licensing_body: string
          name: string
          owner_user_id: string | null
          rating: number
          review_count: number
          slug: string
          specialties: string[]
          title: string
          updated_at: string
          verified: boolean
          years_experience: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string
          claimed?: boolean
          created_at?: string
          credentials?: string
          id?: string
          is_seed_data?: boolean
          languages?: string[]
          licensing_body?: string
          name: string
          owner_user_id?: string | null
          rating?: number
          review_count?: number
          slug: string
          specialties?: string[]
          title?: string
          updated_at?: string
          verified?: boolean
          years_experience?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          claimed?: boolean
          created_at?: string
          credentials?: string
          id?: string
          is_seed_data?: boolean
          languages?: string[]
          licensing_body?: string
          name?: string
          owner_user_id?: string | null
          rating?: number
          review_count?: number
          slug?: string
          specialties?: string[]
          title?: string
          updated_at?: string
          verified?: boolean
          years_experience?: number
        }
        Relationships: []
      }
      saved_treatments: {
        Row: {
          created_at: string | null
          treatment_slug: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          treatment_slug: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          treatment_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      storefronts: {
        Row: {
          address_line: string
          city: string
          claimed: boolean
          created_at: string
          featured: boolean
          google_place_id: string | null
          hero_image_url: string | null
          id: string
          lat: number
          lng: number
          name: string
          owner_user_id: string | null
          postcode: string
          rating: number
          review_count: number
          slug: string
          tagline: string
          updated_at: string
        }
        Insert: {
          address_line?: string
          city?: string
          claimed?: boolean
          created_at?: string
          featured?: boolean
          google_place_id?: string | null
          hero_image_url?: string | null
          id?: string
          lat: number
          lng: number
          name: string
          owner_user_id?: string | null
          postcode?: string
          rating?: number
          review_count?: number
          slug: string
          tagline?: string
          updated_at?: string
        }
        Update: {
          address_line?: string
          city?: string
          claimed?: boolean
          created_at?: string
          featured?: boolean
          google_place_id?: string | null
          hero_image_url?: string | null
          id?: string
          lat?: number
          lng?: number
          name?: string
          owner_user_id?: string | null
          postcode?: string
          rating?: number
          review_count?: number
          slug?: string
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      treatment_areas: {
        Row: {
          area_slug: string
          id: string
          name: string
          price_from: number | null
          sort_order: number
          treatment_slug: string
        }
        Insert: {
          area_slug: string
          id?: string
          name: string
          price_from?: number | null
          sort_order?: number
          treatment_slug: string
        }
        Update: {
          area_slug?: string
          id?: string
          name?: string
          price_from?: number | null
          sort_order?: number
          treatment_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_areas_treatment_slug_fkey"
            columns: ["treatment_slug"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["slug"]
          },
        ]
      }
      treatment_before_afters: {
        Row: {
          after_url: string
          approved: boolean
          before_url: string
          caption: string | null
          consent_confirmed: boolean
          created_at: string
          id: string
          provider_name: string | null
          sort_order: number
          treatment_slug: string
          updated_at: string
          weeks_between: number | null
        }
        Insert: {
          after_url: string
          approved?: boolean
          before_url: string
          caption?: string | null
          consent_confirmed?: boolean
          created_at?: string
          id?: string
          provider_name?: string | null
          sort_order?: number
          treatment_slug: string
          updated_at?: string
          weeks_between?: number | null
        }
        Update: {
          after_url?: string
          approved?: boolean
          before_url?: string
          caption?: string | null
          consent_confirmed?: boolean
          created_at?: string
          id?: string
          provider_name?: string | null
          sort_order?: number
          treatment_slug?: string
          updated_at?: string
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
      treatment_log: {
        Row: {
          amount: number | null
          amount_unit: string | null
          areas_treated: string[] | null
          booking_id: string | null
          created_at: string | null
          created_by_provider_id: string | null
          id: string
          next_due_at: string | null
          performed_at: string
          price_paid: number | null
          product_name: string | null
          provider_id: string | null
          provider_notes: string | null
          source: string
          storefront_id: string | null
          treatment_slug: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          amount_unit?: string | null
          areas_treated?: string[] | null
          booking_id?: string | null
          created_at?: string | null
          created_by_provider_id?: string | null
          id?: string
          next_due_at?: string | null
          performed_at: string
          price_paid?: number | null
          product_name?: string | null
          provider_id?: string | null
          provider_notes?: string | null
          source?: string
          storefront_id?: string | null
          treatment_slug: string
          user_id: string
        }
        Update: {
          amount?: number | null
          amount_unit?: string | null
          areas_treated?: string[] | null
          booking_id?: string | null
          created_at?: string | null
          created_by_provider_id?: string | null
          id?: string
          next_due_at?: string | null
          performed_at?: string
          price_paid?: number | null
          product_name?: string | null
          provider_id?: string | null
          provider_notes?: string | null
          source?: string
          storefront_id?: string | null
          treatment_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      treatment_log_media: {
        Row: {
          created_at: string | null
          id: string
          kind: string
          log_id: string | null
          taken_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          kind: string
          log_id?: string | null
          taken_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          kind?: string
          log_id?: string | null
          taken_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_log_media_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "treatment_log"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_story_slides: {
        Row: {
          body: string | null
          headline: string | null
          id: string
          image_url: string | null
          kind: string
          overlay: Database["public"]["Enums"]["slide_overlay"] | null
          slide_index: number
          treatment_slug: string
        }
        Insert: {
          body?: string | null
          headline?: string | null
          id?: string
          image_url?: string | null
          kind: string
          overlay?: Database["public"]["Enums"]["slide_overlay"] | null
          slide_index: number
          treatment_slug: string
        }
        Update: {
          body?: string | null
          headline?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          overlay?: Database["public"]["Enums"]["slide_overlay"] | null
          slide_index?: number
          treatment_slug?: string
        }
        Relationships: []
      }
      treatments: {
        Row: {
          accent_color: string | null
          aliases: string[]
          avg_price_high: number | null
          avg_price_low: number | null
          blurb: string | null
          category: string | null
          created_at: string
          descriptor: string
          downtime: string
          downtime_label: string | null
          family: string
          group: Database["public"]["Enums"]["treatment_group"] | null
          hero_image: string
          hero_image_url: string | null
          hero_tone: Database["public"]["Enums"]["slide_overlay"]
          icon_url: string | null
          improves: string[]
          is_prescription_category: boolean | null
          medically_reviewed_at: string | null
          medically_reviewed_by: string | null
          name: string
          needs_device_disclaimer: boolean | null
          poster_url: string | null
          price_from: number | null
          price_note: string | null
          rec_mode: string
          science: string
          search_synonyms: string[]
          short_description: string
          slug: string
          sort_order: number
          updated_at: string
          what_it_is: string
          what_to_expect: string
        }
        Insert: {
          accent_color?: string | null
          aliases?: string[]
          avg_price_high?: number | null
          avg_price_low?: number | null
          blurb?: string | null
          category?: string | null
          created_at?: string
          descriptor?: string
          downtime?: string
          downtime_label?: string | null
          family?: string
          group?: Database["public"]["Enums"]["treatment_group"] | null
          hero_image?: string
          hero_image_url?: string | null
          hero_tone?: Database["public"]["Enums"]["slide_overlay"]
          icon_url?: string | null
          improves?: string[]
          is_prescription_category?: boolean | null
          medically_reviewed_at?: string | null
          medically_reviewed_by?: string | null
          name: string
          needs_device_disclaimer?: boolean | null
          poster_url?: string | null
          price_from?: number | null
          price_note?: string | null
          rec_mode?: string
          science?: string
          search_synonyms?: string[]
          short_description?: string
          slug: string
          sort_order?: number
          updated_at?: string
          what_it_is?: string
          what_to_expect?: string
        }
        Update: {
          accent_color?: string | null
          aliases?: string[]
          avg_price_high?: number | null
          avg_price_low?: number | null
          blurb?: string | null
          category?: string | null
          created_at?: string
          descriptor?: string
          downtime?: string
          downtime_label?: string | null
          family?: string
          group?: Database["public"]["Enums"]["treatment_group"] | null
          hero_image?: string
          hero_image_url?: string | null
          hero_tone?: Database["public"]["Enums"]["slide_overlay"]
          icon_url?: string | null
          improves?: string[]
          is_prescription_category?: boolean | null
          medically_reviewed_at?: string | null
          medically_reviewed_by?: string | null
          name?: string
          needs_device_disclaimer?: boolean | null
          poster_url?: string | null
          price_from?: number | null
          price_note?: string | null
          rec_mode?: string
          science?: string
          search_synonyms?: string[]
          short_description?: string
          slug?: string
          sort_order?: number
          updated_at?: string
          what_it_is?: string
          what_to_expect?: string
        }
        Relationships: []
      }
    }
    Views: {
      clinics: {
        Row: {
          address_line: string | null
          city: string | null
          claimed: boolean | null
          created_at: string | null
          featured: boolean | null
          hero_image_url: string | null
          id: string | null
          lat: number | null
          lng: number | null
          name: string | null
          postcode: string | null
          rating: number | null
          review_count: number | null
          slug: string | null
          tagline: string | null
          updated_at: string | null
        }
        Insert: {
          address_line?: string | null
          city?: string | null
          claimed?: boolean | null
          created_at?: string | null
          featured?: boolean | null
          hero_image_url?: string | null
          id?: string | null
          lat?: number | null
          lng?: number | null
          name?: string | null
          postcode?: string | null
          rating?: number | null
          review_count?: number | null
          slug?: string | null
          tagline?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line?: string | null
          city?: string | null
          claimed?: boolean | null
          created_at?: string | null
          featured?: boolean | null
          hero_image_url?: string | null
          id?: string | null
          lat?: number | null
          lng?: number | null
          name?: string | null
          postcode?: string | null
          rating?: number | null
          review_count?: number | null
          slug?: string | null
          tagline?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      provider_rating_stats: {
        Row: {
          provider_id: string | null
          rating: number | null
          review_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      owns_provider: { Args: { _provider_id: string }; Returns: boolean }
    }
    Enums: {
      education_slide_type:
        | "hook"
        | "concept"
        | "science"
        | "myth_vs_fact"
        | "how_to"
        | "when_to_scan"
        | "cta"
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
      treatment_group: "injectables" | "skin" | "laser" | "body"
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
      education_slide_type: [
        "hook",
        "concept",
        "science",
        "myth_vs_fact",
        "how_to",
        "when_to_scan",
        "cta",
      ],
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
      treatment_group: ["injectables", "skin", "laser", "body"],
    },
  },
} as const
