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
      candidates: {
        Row: {
          blob_url: string | null
          created_at: string
          email: string | null
          error_message: string | null
          file_name: string
          full_name: string | null
          id: string
          job_description_id: string | null
          parsed_education: Json | null
          parsed_experience: Json | null
          parsed_skills: string[]
          phone: string | null
          raw_text: string | null
          status: string
          total_experience_years: number | null
          updated_at: string
        }
        Insert: {
          blob_url?: string | null
          created_at?: string
          email?: string | null
          error_message?: string | null
          file_name: string
          full_name?: string | null
          id?: string
          job_description_id?: string | null
          parsed_education?: Json | null
          parsed_experience?: Json | null
          parsed_skills?: string[]
          phone?: string | null
          raw_text?: string | null
          status?: string
          total_experience_years?: number | null
          updated_at?: string
        }
        Update: {
          blob_url?: string | null
          created_at?: string
          email?: string | null
          error_message?: string | null
          file_name?: string
          full_name?: string | null
          id?: string
          job_description_id?: string | null
          parsed_education?: Json | null
          parsed_experience?: Json | null
          parsed_skills?: string[]
          phone?: string | null
          raw_text?: string | null
          status?: string
          total_experience_years?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_job_description_id_fkey"
            columns: ["job_description_id"]
            isOneToOne: false
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_descriptions: {
        Row: {
          company: string | null
          created_at: string
          education_requirement: string | null
          id: string
          max_experience_years: number | null
          min_experience_years: number | null
          preferred_skills: string[]
          raw_text: string
          required_skills: string[]
          role_summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          education_requirement?: string | null
          id?: string
          max_experience_years?: number | null
          min_experience_years?: number | null
          preferred_skills?: string[]
          raw_text: string
          required_skills?: string[]
          role_summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          education_requirement?: string | null
          id?: string
          max_experience_years?: number | null
          min_experience_years?: number | null
          preferred_skills?: string[]
          raw_text?: string
          required_skills?: string[]
          role_summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      match_results: {
        Row: {
          ai_summary: string | null
          candidate_id: string | null
          concerns: string | null
          created_at: string
          id: string
          job_description_id: string | null
          keyword_score: number | null
          matched_skills: string[]
          missing_skills: string[]
          overall_score: number
          rank: number | null
          semantic_score: number | null
          strengths: string | null
          updated_at: string
          user_status: string
        }
        Insert: {
          ai_summary?: string | null
          candidate_id?: string | null
          concerns?: string | null
          created_at?: string
          id?: string
          job_description_id?: string | null
          keyword_score?: number | null
          matched_skills?: string[]
          missing_skills?: string[]
          overall_score: number
          rank?: number | null
          semantic_score?: number | null
          strengths?: string | null
          updated_at?: string
          user_status?: string
        }
        Update: {
          ai_summary?: string | null
          candidate_id?: string | null
          concerns?: string | null
          created_at?: string
          id?: string
          job_description_id?: string | null
          keyword_score?: number | null
          matched_skills?: string[]
          missing_skills?: string[]
          overall_score?: number
          rank?: number | null
          semantic_score?: number | null
          strengths?: string | null
          updated_at?: string
          user_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_results_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_job_description_id_fkey"
            columns: ["job_description_id"]
            isOneToOne: false
            referencedRelation: "job_descriptions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
