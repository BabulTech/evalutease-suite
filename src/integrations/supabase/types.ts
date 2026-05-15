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
      promo_codes: {
        Row: {
          id: string
          code: string
          description: string | null
          discount_percent: number | null
          discount_fixed_cents: number | null
          applies_to_slugs: string[]
          max_uses: number | null
          uses_count: number
          expires_at: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          description?: string | null
          discount_percent?: number | null
          discount_fixed_cents?: number | null
          applies_to_slugs?: string[]
          max_uses?: number | null
          uses_count?: number
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          description?: string | null
          discount_percent?: number | null
          discount_fixed_cents?: number | null
          applies_to_slugs?: string[]
          max_uses?: number | null
          uses_count?: number
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      app_feedback: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string
          status: string
          priority: string
          admin_reply: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type?: string
          title: string
          body: string
          status?: string
          priority?: string
          admin_reply?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string
          status?: string
          priority?: string
          admin_reply?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      quiz_feedback: {
        Row: {
          id: string
          session_id: string
          participant_name: string
          participant_email: string | null
          rating: number
          comment: string | null
          submitted_at: string
        }
        Insert: {
          id?: string
          session_id: string
          participant_name?: string
          participant_email?: string | null
          rating: number
          comment?: string | null
          submitted_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          participant_name?: string
          participant_email?: string | null
          rating?: number
          comment?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          id: string
          name: string
          slug: string
          tier: string
          description: string | null
          price_pkr: number
          credits_per_month: number
          quizzes_per_day: number
          participants_per_session: number
          participants_total: number
          question_bank: number
          sessions_total: number
          ai_enabled: boolean
          custom_branding: boolean
          white_label: boolean
          credit_cost_ai_question: number
          credit_cost_ai_feedback: number
          credit_cost_ai_report: number
          credit_cost_ai_10q: number
          credit_cost_ai_scan: number
          credit_cost_extra_quiz: number
          credit_cost_extra_participants: number
          credit_cost_session_launch: number
          credit_cost_export: number
          max_hosts: number
          features_list: string[]
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          tier?: string
          description?: string | null
          price_pkr?: number
          credits_per_month?: number
          quizzes_per_day?: number
          participants_per_session?: number
          participants_total?: number
          question_bank?: number
          sessions_total?: number
          ai_enabled?: boolean
          custom_branding?: boolean
          white_label?: boolean
          credit_cost_ai_question?: number
          credit_cost_ai_feedback?: number
          credit_cost_ai_report?: number
          credit_cost_ai_10q?: number
          credit_cost_ai_scan?: number
          credit_cost_extra_quiz?: number
          credit_cost_extra_participants?: number
          credit_cost_session_launch?: number
          credit_cost_export?: number
          max_hosts?: number
          features_list?: string[]
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          tier?: string
          description?: string | null
          price_pkr?: number
          credits_per_month?: number
          quizzes_per_day?: number
          participants_per_session?: number
          participants_total?: number
          question_bank?: number
          sessions_total?: number
          ai_enabled?: boolean
          custom_branding?: boolean
          white_label?: boolean
          credit_cost_ai_question?: number
          credit_cost_ai_feedback?: number
          credit_cost_ai_report?: number
          credit_cost_ai_10q?: number
          credit_cost_ai_scan?: number
          credit_cost_extra_quiz?: number
          credit_cost_extra_participants?: number
          credit_cost_session_launch?: number
          credit_cost_export?: number
          max_hosts?: number
          features_list?: string[]
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          status: string
          started_at: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id: string
          status?: string
          started_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_id?: string
          status?: string
          started_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_payments: {
        Row: {
          id: string
          user_id: string
          plan_id: string | null
          amount_pkr: number
          payment_method: string
          account_holder_name: string | null
          transaction_ref: string | null
          screenshot_url: string | null
          credits_to_add: number
          status: string
          notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id?: string | null
          amount_pkr: number
          payment_method: string
          account_holder_name?: string | null
          transaction_ref?: string | null
          screenshot_url?: string | null
          credits_to_add?: number
          status?: string
          notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_id?: string | null
          amount_pkr?: number
          payment_method?: string
          account_holder_name?: string | null
          transaction_ref?: string | null
          screenshot_url?: string | null
          credits_to_add?: number
          status?: string
          notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_accounts: {
        Row: {
          id: string
          method: string
          title: string
          account_name: string
          account_number: string
          instructions: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          method: string
          title: string
          account_name: string
          account_number: string
          instructions?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          method?: string
          title?: string
          account_name?: string
          account_number?: string
          instructions?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          id: string
          user_id: string
          balance: number
          total_earned: number
          total_spent: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          balance?: number
          total_earned?: number
          total_spent?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          balance?: number
          total_earned?: number
          total_spent?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          type: string
          description: string | null
          reference_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          type: string
          description?: string | null
          reference_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          type?: string
          description?: string | null
          reference_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          id: string
          admin_user_id: string
          company_name: string
          company_type: string
          registration_no: string | null
          established_year: number | null
          total_students: number | null
          phone: string | null
          email: string | null
          website: string | null
          address: string | null
          city: string | null
          province: string | null
          country: string | null
          description: string | null
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          admin_user_id: string
          company_name: string
          company_type: string
          registration_no?: string | null
          established_year?: number | null
          total_students?: number | null
          phone?: string | null
          email?: string | null
          website?: string | null
          address?: string | null
          city?: string | null
          province?: string | null
          country?: string | null
          description?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          admin_user_id?: string
          company_name?: string
          company_type?: string
          registration_no?: string | null
          established_year?: number | null
          total_students?: number | null
          phone?: string | null
          email?: string | null
          website?: string | null
          address?: string | null
          city?: string | null
          province?: string | null
          country?: string | null
          description?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          id: string
          company_id: string
          user_id: string | null
          invited_email: string
          full_name: string
          role: string
          status: string
          employee_id: string | null
          department: string | null
          designation: string | null
          subject_area: string | null
          phone: string | null
          invite_token: string | null
          joined_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id?: string | null
          invited_email: string
          full_name: string
          role?: string
          status?: string
          employee_id?: string | null
          department?: string | null
          designation?: string | null
          subject_area?: string | null
          phone?: string | null
          invite_token?: string | null
          joined_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string | null
          invited_email?: string
          full_name?: string
          role?: string
          status?: string
          employee_id?: string | null
          department?: string | null
          designation?: string | null
          subject_area?: string | null
          phone?: string | null
          invite_token?: string | null
          joined_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      host_settings: {
        Row: {
          created_at: string
          marks_per_correct: number
          owner_id: string
          registration_fields: Json
          show_explanation: boolean
          speed_bonus_enabled: boolean
          speed_bonus_max: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          marks_per_correct?: number
          owner_id: string
          registration_fields?: Json
          show_explanation?: boolean
          speed_bonus_enabled?: boolean
          speed_bonus_max?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          marks_per_correct?: number
          owner_id?: string
          registration_fields?: Json
          show_explanation?: boolean
          speed_bonus_enabled?: boolean
          speed_bonus_max?: number
          updated_at?: string
        }
        Relationships: []
      }
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
          subtype_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json | null
          mobile?: string | null
          name: string
          owner_id: string
          subtype_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json | null
          mobile?: string | null
          name?: string
          owner_id?: string
          subtype_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_subtype_id_fkey"
            columns: ["subtype_id"]
            isOneToOne: false
            referencedRelation: "participant_subtypes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          logo_url: string | null
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
          logo_url?: string | null
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
          logo_url?: string | null
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
          icon: string | null
          id: string
          name: string
          owner_id: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          owner_id: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          owner_id?: string
          subject?: string | null
        }
        Relationships: []
      }
      question_subcategories: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "question_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_types: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      participant_subtypes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          type_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          type_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_subtypes_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "participant_types"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_invites: {
        Row: {
          accepted_at: string | null
          accepted_participant_id: string | null
          created_at: string
          email: string | null
          id: string
          owner_id: string
          status: string
          subtype_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_participant_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          owner_id: string
          status?: string
          subtype_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_participant_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          owner_id?: string
          status?: string
          subtype_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_invites_subtype_id_fkey"
            columns: ["subtype_id"]
            isOneToOne: false
            referencedRelation: "participant_subtypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_invites_accepted_participant_id_fkey"
            columns: ["accepted_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_session_subtypes: {
        Row: {
          session_id: string
          subtype_id: string
        }
        Insert: {
          session_id: string
          subtype_id: string
        }
        Update: {
          session_id?: string
          subtype_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_session_subtypes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_session_subtypes_subtype_id_fkey"
            columns: ["subtype_id"]
            isOneToOne: false
            referencedRelation: "participant_subtypes"
            referencedColumns: ["id"]
          },
        ]
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
          subcategory_id: string | null
          subject: string | null
          text: string
          time_seconds: number
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
          subcategory_id?: string | null
          subject?: string | null
          text: string
          time_seconds?: number
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
          subcategory_id?: string | null
          subject?: string | null
          text?: string
          time_seconds?: number
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
          {
            foreignKeyName: "questions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "question_subcategories"
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
          category_id: string | null
          created_at: string
          default_time_per_question: number | null
          description: string | null
          expires_at: string | null
          id: string
          is_open: boolean
          language: string | null
          mode: Database["public"]["Enums"]["session_mode"]
          owner_id: string
          pause_offset_seconds: number
          paused_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["session_status"]
          subcategory_id: string | null
          subject: string | null
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          category_id?: string | null
          created_at?: string
          default_time_per_question?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_open?: boolean
          language?: string | null
          mode?: Database["public"]["Enums"]["session_mode"]
          owner_id: string
          pause_offset_seconds?: number
          paused_at?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          subcategory_id?: string | null
          subject?: string | null
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          category_id?: string | null
          created_at?: string
          default_time_per_question?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_open?: boolean
          language?: string | null
          mode?: Database["public"]["Enums"]["session_mode"]
          owner_id?: string
          pause_offset_seconds?: number
          paused_at?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          subcategory_id?: string | null
          subject?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "question_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_sessions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "question_subcategories"
            referencedColumns: ["id"]
          },
        ]
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
      get_session_for_join: {
        Args: { p_access_code: string }
        Returns: Json
      }
      get_session_for_play: {
        Args: { p_access_code: string; p_attempt_id: string }
        Returns: Json
      }
      join_quiz_session: {
        Args: {
          p_access_code: string
          p_name: string
          p_email?: string | null
          p_mobile?: string | null
          p_roll_number?: string | null
        }
        Returns: Json
      }
      submit_quiz_answer: {
        Args: {
          p_attempt_id: string
          p_question_id: string
          p_answer: string | null
          p_time_taken_seconds: number
        }
        Returns: Json
      }
      submit_quiz_answers_batch: {
        Args: { p_answers: Json }
        Returns: Json
      }
      complete_quiz_attempt: {
        Args: { p_attempt_id: string }
        Returns: Json
      }
      get_invite_for_token: {
        Args: { p_token: string }
        Returns: Json
      }
      redeem_participant_invite: {
        Args: {
          p_token: string
          p_name: string
          p_email?: string | null
          p_mobile?: string | null
          p_metadata?: Json
        }
        Returns: Json
      }
      pause_quiz_session: {
        Args: { p_session_id: string }
        Returns: Json
      }
      resume_quiz_session: {
        Args: { p_session_id: string }
        Returns: Json
      }
      close_quiz_session: {
        Args: { p_session_id: string }
        Returns: Json
      }
      get_session_leaderboard: {
        Args: { p_session_id: string }
        Returns: Json
      }
      approve_payment: {
        Args: { p_payment_id: string; p_admin_id: string; p_admin_notes?: string }
        Returns: void
      }
      deduct_credits: {
        Args: { p_user_id: string; p_amount: number; p_type: string; p_description?: string; p_reference_id?: string }
        Returns: boolean
      }
      add_credits: {
        Args: { p_user_id: string; p_amount: number; p_type: string; p_description?: string; p_reference_id?: string; p_performed_by?: string }
        Returns: void
      }
      transfer_credits_to_host: {
        Args: { p_admin_id: string; p_host_user_id: string; p_member_id: string; p_amount: number; p_note?: string }
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
