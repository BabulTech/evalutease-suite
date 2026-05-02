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
      participant_group_members: {
        Row: {
          group_id: string
          participant_id: string
        }
        Insert: {
          group_id: string
          participant_id: string
        }
        Update: {
          group_id?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "participant_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_group_members_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      participants: {
        Row: {
          created_at: string
          email: string | null
          id: string
          metadata: Json | null
          mobile: string | null
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json | null
          mobile?: string | null
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json | null
          mobile?: string | null
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          mobile: string | null
          organization: string | null
          preferred_language: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          mobile?: string | null
          organization?: string | null
          preferred_language?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          mobile?: string | null
          organization?: string | null
          preferred_language?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      question_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          subject?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          category_id: string | null
          correct_answer: string | null
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty"]
          explanation: string | null
          id: string
          language: string | null
          options: Json | null
          owner_id: string
          source: Database["public"]["Enums"]["question_source"]
          subject: string | null
          text: string
          topic: string | null
          type: Database["public"]["Enums"]["question_type"]
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          correct_answer?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty"]
          explanation?: string | null
          id?: string
          language?: string | null
          options?: Json | null
          owner_id: string
          source?: Database["public"]["Enums"]["question_source"]
          subject?: string | null
          text: string
          topic?: string | null
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          correct_answer?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty"]
          explanation?: string | null
          id?: string
          language?: string | null
          options?: Json | null
          owner_id?: string
          source?: Database["public"]["Enums"]["question_source"]
          subject?: string | null
          text?: string
          topic?: string | null
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "question_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          answer: string | null
          answered_at: string
          attempt_id: string
          id: string
          is_correct: boolean | null
          question_id: string
          time_taken_seconds: number | null
        }
        Insert: {
          answer?: string | null
          answered_at?: string
          attempt_id: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          time_taken_seconds?: number | null
        }
        Update: {
          answer?: string | null
          answered_at?: string
          attempt_id?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          time_taken_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          completed: boolean
          completed_at: string | null
          id: string
          participant_email: string | null
          participant_id: string | null
          participant_name: string | null
          score: number
          session_id: string
          started_at: string
          total_questions: number
          user_id: string | null
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          participant_email?: string | null
          participant_id?: string | null
          participant_name?: string | null
          score?: number
          session_id: string
          started_at?: string
          total_questions?: number
          user_id?: string | null
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          participant_email?: string | null
          participant_id?: string | null
          participant_name?: string | null
          score?: number
          session_id?: string
          started_at?: string
          total_questions?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_session_participants: {
        Row: {
          participant_id: string
          session_id: string
        }
        Insert: {
          participant_id: string
          session_id: string
        }
        Update: {
          participant_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_session_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_session_questions: {
        Row: {
          id: string
          position: number
          question_id: string
          session_id: string
          time_seconds: number | null
        }
        Insert: {
          id?: string
          position?: number
          question_id: string
          session_id: string
          time_seconds?: number | null
        }
        Update: {
          id?: string
          position?: number
          question_id?: string
          session_id?: string
          time_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_session_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_session_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sessions: {
        Row: {
          access_code: string | null
          created_at: string
          default_time_per_question: number | null
          description: string | null
          expires_at: string | null
          id: string
          is_open: boolean
          language: string | null
          mode: Database["public"]["Enums"]["session_mode"]
          owner_id: string
          status: Database["public"]["Enums"]["session_status"]
          subject: string | null
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          created_at?: string
          default_time_per_question?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_open?: boolean
          language?: string | null
          mode?: Database["public"]["Enums"]["session_mode"]
          owner_id: string
          status?: Database["public"]["Enums"]["session_status"]
          subject?: string | null
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          created_at?: string
          default_time_per_question?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_open?: boolean
          language?: string | null
          mode?: Database["public"]["Enums"]["session_mode"]
          owner_id?: string
          status?: Database["public"]["Enums"]["session_status"]
          subject?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      app_role: "admin" | "teacher" | "student"
      difficulty: "easy" | "medium" | "hard"
      question_source: "manual" | "ai" | "ocr" | "import"
      question_type: "mcq" | "true_false" | "short_answer"
      session_mode: "live" | "qr_link"
      session_status: "draft" | "scheduled" | "active" | "completed" | "expired"
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
      app_role: ["admin", "teacher", "student"],
      difficulty: ["easy", "medium", "hard"],
      question_source: ["manual", "ai", "ocr", "import"],
      question_type: ["mcq", "true_false", "short_answer"],
      session_mode: ["live", "qr_link"],
      session_status: ["draft", "scheduled", "active", "completed", "expired"],
    },
  },
} as const
