export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string;
          actor_user_id: string | null;
          created_at: string;
          details: Json;
          entity_id: string | null;
          entity_label: string | null;
          entity_type: string | null;
          id: string;
          ip_address: unknown;
          message: string;
          metadata: Json;
          module: string;
          plan_owner_id: string | null;
          risk_score: number;
          user_agent: string | null;
        };
        Insert: {
          action_type: string;
          actor_user_id?: string | null;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_label?: string | null;
          entity_type?: string | null;
          id?: string;
          ip_address?: unknown;
          message: string;
          metadata?: Json;
          module: string;
          plan_owner_id?: string | null;
          risk_score?: number;
          user_agent?: string | null;
        };
        Update: {
          action_type?: string;
          actor_user_id?: string | null;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_label?: string | null;
          entity_type?: string | null;
          id?: string;
          ip_address?: unknown;
          message?: string;
          metadata?: Json;
          module?: string;
          plan_owner_id?: string | null;
          risk_score?: number;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_logs_plan_owner_id_fkey";
            columns: ["plan_owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_model_pricing: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          input_cost_per_million: number;
          is_active: boolean;
          model: string;
          output_cost_per_million: number;
          provider: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          id?: string;
          input_cost_per_million?: number;
          is_active?: boolean;
          model: string;
          output_cost_per_million?: number;
          provider?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          input_cost_per_million?: number;
          is_active?: boolean;
          model?: string;
          output_cost_per_million?: number;
          provider?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_usage_logs: {
        Row: {
          actor_user_id: string | null;
          created_at: string;
          credits_charged: number;
          currency: string;
          details: Json;
          estimated_cost: number;
          feature: string;
          id: string;
          input_tokens: number;
          latency_ms: number | null;
          model: string;
          output_tokens: number;
          plan_owner_id: string | null;
          provider: string;
          request_status: string;
          total_tokens: number | null;
        };
        Insert: {
          actor_user_id?: string | null;
          created_at?: string;
          credits_charged?: number;
          currency?: string;
          details?: Json;
          estimated_cost?: number;
          feature: string;
          id?: string;
          input_tokens?: number;
          latency_ms?: number | null;
          model: string;
          output_tokens?: number;
          plan_owner_id?: string | null;
          provider?: string;
          request_status?: string;
          total_tokens?: number | null;
        };
        Update: {
          actor_user_id?: string | null;
          created_at?: string;
          credits_charged?: number;
          currency?: string;
          details?: Json;
          estimated_cost?: number;
          feature?: string;
          id?: string;
          input_tokens?: number;
          latency_ms?: number | null;
          model?: string;
          output_tokens?: number;
          plan_owner_id?: string | null;
          provider?: string;
          request_status?: string;
          total_tokens?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_logs_plan_owner_id_fkey";
            columns: ["plan_owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      app_feedback: {
        Row: {
          admin_reply: string | null;
          body: string;
          created_at: string;
          id: string;
          priority: string;
          status: string;
          title: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          admin_reply?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          priority?: string;
          status?: string;
          title: string;
          type?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          admin_reply?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          priority?: string;
          status?: string;
          title?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      blocked_email_domains: {
        Row: {
          created_at: string;
          domain: string;
          id: string;
          is_active: boolean;
          reason: string | null;
        };
        Insert: {
          created_at?: string;
          domain: string;
          id?: string;
          is_active?: boolean;
          reason?: string | null;
        };
        Update: {
          created_at?: string;
          domain?: string;
          id?: string;
          is_active?: boolean;
          reason?: string | null;
        };
        Relationships: [];
      };
      company_members: {
        Row: {
          company_id: string;
          created_at: string;
          credit_limit: number | null;
          credits_used: number | null;
          department: string | null;
          designation: string | null;
          employee_id: string | null;
          full_name: string;
          id: string;
          invite_expires_at: string | null;
          invite_token: string | null;
          invited_by: string | null;
          invited_email: string;
          joined_at: string | null;
          phone: string | null;
          role: Database["public"]["Enums"]["member_role"];
          status: Database["public"]["Enums"]["member_status"];
          subject_area: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          credit_limit?: number | null;
          credits_used?: number | null;
          department?: string | null;
          designation?: string | null;
          employee_id?: string | null;
          full_name: string;
          id?: string;
          invite_expires_at?: string | null;
          invite_token?: string | null;
          invited_by?: string | null;
          invited_email: string;
          joined_at?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          subject_area?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          credit_limit?: number | null;
          credits_used?: number | null;
          department?: string | null;
          designation?: string | null;
          employee_id?: string | null;
          full_name?: string;
          id?: string;
          invite_expires_at?: string | null;
          invite_token?: string | null;
          invited_by?: string | null;
          invited_email?: string;
          joined_at?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          subject_area?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "company_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      company_profiles: {
        Row: {
          address: string | null;
          admin_user_id: string;
          city: string | null;
          company_name: string;
          company_type: Database["public"]["Enums"]["company_type"];
          country: string;
          created_at: string;
          description: string | null;
          email: string | null;
          established_year: number | null;
          id: string;
          is_verified: boolean;
          logo_url: string | null;
          onboarding_completed: boolean;
          phone: string | null;
          province: string | null;
          registration_no: string | null;
          total_students: number | null;
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          admin_user_id: string;
          city?: string | null;
          company_name: string;
          company_type?: Database["public"]["Enums"]["company_type"];
          country?: string;
          created_at?: string;
          description?: string | null;
          email?: string | null;
          established_year?: number | null;
          id?: string;
          is_verified?: boolean;
          logo_url?: string | null;
          onboarding_completed?: boolean;
          phone?: string | null;
          province?: string | null;
          registration_no?: string | null;
          total_students?: number | null;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          admin_user_id?: string;
          city?: string | null;
          company_name?: string;
          company_type?: Database["public"]["Enums"]["company_type"];
          country?: string;
          created_at?: string;
          description?: string | null;
          email?: string | null;
          established_year?: number | null;
          id?: string;
          is_verified?: boolean;
          logo_url?: string | null;
          onboarding_completed?: boolean;
          phone?: string | null;
          province?: string | null;
          registration_no?: string | null;
          total_students?: number | null;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      credit_packages: {
        Row: {
          allowed_tiers: string[];
          badge_text: string | null;
          created_at: string;
          credits: number;
          id: string;
          is_active: boolean;
          name: string;
          price_pkr: number;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          allowed_tiers?: string[];
          badge_text?: string | null;
          created_at?: string;
          credits: number;
          id?: string;
          is_active?: boolean;
          name: string;
          price_pkr: number;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          allowed_tiers?: string[];
          badge_text?: string | null;
          created_at?: string;
          credits?: number;
          id?: string;
          is_active?: boolean;
          name?: string;
          price_pkr?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      credit_requests: {
        Row: {
          amount: number;
          company_id: string;
          created_at: string;
          id: string;
          member_id: string;
          note: string | null;
          requester_user_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          company_id: string;
          created_at?: string;
          id?: string;
          member_id: string;
          note?: string | null;
          requester_user_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          company_id?: string;
          created_at?: string;
          id?: string;
          member_id?: string;
          note?: string | null;
          requester_user_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_requests_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "company_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_requests_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_transactions: {
        Row: {
          amount: number;
          balance_after: number;
          created_at: string;
          description: string | null;
          id: string;
          performed_by: string | null;
          reference_id: string | null;
          type: Database["public"]["Enums"]["credit_tx_type"];
          user_id: string;
        };
        Insert: {
          amount: number;
          balance_after: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          performed_by?: string | null;
          reference_id?: string | null;
          type: Database["public"]["Enums"]["credit_tx_type"];
          user_id: string;
        };
        Update: {
          amount?: number;
          balance_after?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          performed_by?: string | null;
          reference_id?: string | null;
          type?: Database["public"]["Enums"]["credit_tx_type"];
          user_id?: string;
        };
        Relationships: [];
      };
      host_settings: {
        Row: {
          created_at: string;
          marks_per_correct: number;
          owner_id: string;
          registration_fields: Json;
          registration_fields_by_type: Json;
          show_explanation: boolean;
          speed_bonus_enabled: boolean;
          speed_bonus_max: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          marks_per_correct?: number;
          owner_id: string;
          registration_fields?: Json;
          registration_fields_by_type?: Json;
          show_explanation?: boolean;
          speed_bonus_enabled?: boolean;
          speed_bonus_max?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          marks_per_correct?: number;
          owner_id?: string;
          registration_fields?: Json;
          registration_fields_by_type?: Json;
          show_explanation?: boolean;
          speed_bonus_enabled?: boolean;
          speed_bonus_max?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      manual_payments: {
        Row: {
          admin_notes: string | null;
          amount_pkr: number;
          created_at: string;
          credits_to_add: number;
          id: string;
          notes: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"];
          plan_id: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          screenshot_url: string;
          status: Database["public"]["Enums"]["payment_status"];
          transaction_ref: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          admin_notes?: string | null;
          amount_pkr: number;
          created_at?: string;
          credits_to_add?: number;
          id?: string;
          notes?: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"];
          plan_id?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          screenshot_url: string;
          status?: Database["public"]["Enums"]["payment_status"];
          transaction_ref?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          admin_notes?: string | null;
          amount_pkr?: number;
          created_at?: string;
          credits_to_add?: number;
          id?: string;
          notes?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          plan_id?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          screenshot_url?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          transaction_ref?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "manual_payments_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          read: boolean;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read?: boolean;
          title: string;
          type?: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read?: boolean;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      org_departments: {
        Row: {
          created_at: string;
          dept_credit_quota: number | null;
          dept_credits_used: number;
          description: string | null;
          head_user_id: string | null;
          icon: string | null;
          id: string;
          is_active: boolean;
          name: string;
          org_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          dept_credit_quota?: number | null;
          dept_credits_used?: number;
          description?: string | null;
          head_user_id?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          org_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          dept_credit_quota?: number | null;
          dept_credits_used?: number;
          description?: string | null;
          head_user_id?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          org_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      org_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          department_id: string | null;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          org_id: string;
          role: Database["public"]["Enums"]["org_member_role"];
          status: Database["public"]["Enums"]["org_invite_status"];
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          department_id?: string | null;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          org_id: string;
          role?: Database["public"]["Enums"]["org_member_role"];
          status?: Database["public"]["Enums"]["org_invite_status"];
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          department_id?: string | null;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          org_id?: string;
          role?: Database["public"]["Enums"]["org_member_role"];
          status?: Database["public"]["Enums"]["org_invite_status"];
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_invites_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "org_departments";
            referencedColumns: ["id"];
          },
        ];
      };
      participant_group_members: {
        Row: {
          group_id: string;
          participant_id: string;
        };
        Insert: {
          group_id: string;
          participant_id: string;
        };
        Update: {
          group_id?: string;
          participant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "participant_group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "participant_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "participant_group_members_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: false;
            referencedRelation: "participants";
            referencedColumns: ["id"];
          },
        ];
      };
      participant_groups: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          owner_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          owner_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
        };
        Relationships: [];
      };
      participant_invites: {
        Row: {
          accepted_at: string | null;
          accepted_participant_id: string | null;
          created_at: string;
          email: string | null;
          id: string;
          owner_id: string;
          participant_type: string | null;
          status: string;
          subtype_id: string;
          token: string;
          use_count: number;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_participant_id?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          owner_id: string;
          participant_type?: string | null;
          status?: string;
          subtype_id: string;
          token?: string;
          use_count?: number;
        };
        Update: {
          accepted_at?: string | null;
          accepted_participant_id?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          owner_id?: string;
          participant_type?: string | null;
          status?: string;
          subtype_id?: string;
          token?: string;
          use_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "participant_invites_accepted_participant_id_fkey";
            columns: ["accepted_participant_id"];
            isOneToOne: false;
            referencedRelation: "participants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "participant_invites_subtype_id_fkey";
            columns: ["subtype_id"];
            isOneToOne: false;
            referencedRelation: "participant_subtypes";
            referencedColumns: ["id"];
          },
        ];
      };
      participant_subtypes: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          owner_id: string;
          type_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          owner_id: string;
          type_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          type_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "participant_subtypes_type_id_fkey";
            columns: ["type_id"];
            isOneToOne: false;
            referencedRelation: "participant_types";
            referencedColumns: ["id"];
          },
        ];
      };
      participant_types: {
        Row: {
          created_at: string;
          icon: string | null;
          id: string;
          name: string;
          owner_id: string;
        };
        Insert: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          name: string;
          owner_id: string;
        };
        Update: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
        };
        Relationships: [];
      };
      participants: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          metadata: Json | null;
          mobile: string | null;
          name: string;
          owner_id: string;
          subtype_id: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: string;
          metadata?: Json | null;
          mobile?: string | null;
          name: string;
          owner_id: string;
          subtype_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          metadata?: Json | null;
          mobile?: string | null;
          name?: string;
          owner_id?: string;
          subtype_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "participants_subtype_id_fkey";
            columns: ["subtype_id"];
            isOneToOne: false;
            referencedRelation: "participant_subtypes";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_accounts: {
        Row: {
          account_name: string;
          account_number: string;
          id: string;
          instructions: string | null;
          is_active: boolean;
          method: Database["public"]["Enums"]["payment_method"];
          title: string;
          updated_at: string;
        };
        Insert: {
          account_name: string;
          account_number: string;
          id?: string;
          instructions?: string | null;
          is_active?: boolean;
          method: Database["public"]["Enums"]["payment_method"];
          title: string;
          updated_at?: string;
        };
        Update: {
          account_name?: string;
          account_number?: string;
          id?: string;
          instructions?: string | null;
          is_active?: boolean;
          method?: Database["public"]["Enums"]["payment_method"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          ai_calls_per_day: number;
          ai_coding_test: boolean;
          ai_enabled: boolean;
          ai_interview: boolean;
          can_buy_credits: boolean;
          created_at: string;
          credit_cost_ai_10q: number;
          credit_cost_ai_coding: number;
          credit_cost_ai_grade_long: number;
          credit_cost_ai_grade_short: number;
          credit_cost_ai_interview: number;
          credit_cost_ai_long_10q: number;
          credit_cost_ai_mix_10q: number;
          credit_cost_ai_scan: number;
          credit_cost_ai_short_10q: number;
          credit_cost_ai_tf_10q: number;
          credit_cost_export: number;
          credit_cost_extra_participants: number;
          credit_cost_extra_quiz: number;
          credit_cost_session_launch: number;
          credits_per_month: number;
          custom_branding: boolean;
          description: string | null;
          email_template_allowed: boolean;
          features_list: string[] | null;
          file_export_watermark: boolean;
          id: string;
          is_active: boolean;
          max_hosts: number;
          name: string;
          participants_per_session: number;
          participants_total: number;
          price_pkr: number;
          question_bank: number;
          quizzes_per_day: number;
          scheduled_quizzes_per_day: number;
          sessions_total: number;
          slug: Database["public"]["Enums"]["plan_slug"];
          sort_order: number;
          tier: Database["public"]["Enums"]["plan_tier"];
          trial_ai_calls: number;
          trial_days: number;
          updated_at: string;
          watermark_enabled: boolean;
          white_label: boolean;
        };
        Insert: {
          ai_calls_per_day?: number;
          ai_coding_test?: boolean;
          ai_enabled?: boolean;
          ai_interview?: boolean;
          can_buy_credits?: boolean;
          created_at?: string;
          credit_cost_ai_10q?: number;
          credit_cost_ai_coding?: number;
          credit_cost_ai_grade_long?: number;
          credit_cost_ai_grade_short?: number;
          credit_cost_ai_interview?: number;
          credit_cost_ai_long_10q?: number;
          credit_cost_ai_mix_10q?: number;
          credit_cost_ai_scan?: number;
          credit_cost_ai_short_10q?: number;
          credit_cost_ai_tf_10q?: number;
          credit_cost_export?: number;
          credit_cost_extra_participants?: number;
          credit_cost_extra_quiz?: number;
          credit_cost_session_launch?: number;
          credits_per_month?: number;
          custom_branding?: boolean;
          description?: string | null;
          email_template_allowed?: boolean;
          features_list?: string[] | null;
          file_export_watermark?: boolean;
          id?: string;
          is_active?: boolean;
          max_hosts?: number;
          name: string;
          participants_per_session?: number;
          participants_total?: number;
          price_pkr?: number;
          question_bank?: number;
          quizzes_per_day?: number;
          scheduled_quizzes_per_day?: number;
          sessions_total?: number;
          slug: Database["public"]["Enums"]["plan_slug"];
          sort_order?: number;
          tier?: Database["public"]["Enums"]["plan_tier"];
          trial_ai_calls?: number;
          trial_days?: number;
          updated_at?: string;
          watermark_enabled?: boolean;
          white_label?: boolean;
        };
        Update: {
          ai_calls_per_day?: number;
          ai_coding_test?: boolean;
          ai_enabled?: boolean;
          ai_interview?: boolean;
          can_buy_credits?: boolean;
          created_at?: string;
          credit_cost_ai_10q?: number;
          credit_cost_ai_coding?: number;
          credit_cost_ai_grade_long?: number;
          credit_cost_ai_grade_short?: number;
          credit_cost_ai_interview?: number;
          credit_cost_ai_long_10q?: number;
          credit_cost_ai_mix_10q?: number;
          credit_cost_ai_scan?: number;
          credit_cost_ai_short_10q?: number;
          credit_cost_ai_tf_10q?: number;
          credit_cost_export?: number;
          credit_cost_extra_participants?: number;
          credit_cost_extra_quiz?: number;
          credit_cost_session_launch?: number;
          credits_per_month?: number;
          custom_branding?: boolean;
          description?: string | null;
          email_template_allowed?: boolean;
          features_list?: string[] | null;
          file_export_watermark?: boolean;
          id?: string;
          is_active?: boolean;
          max_hosts?: number;
          name?: string;
          participants_per_session?: number;
          participants_total?: number;
          price_pkr?: number;
          question_bank?: number;
          quizzes_per_day?: number;
          scheduled_quizzes_per_day?: number;
          sessions_total?: number;
          slug?: Database["public"]["Enums"]["plan_slug"];
          sort_order?: number;
          tier?: Database["public"]["Enums"]["plan_tier"];
          trial_ai_calls?: number;
          trial_days?: number;
          updated_at?: string;
          watermark_enabled?: boolean;
          white_label?: boolean;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          company_name: string | null;
          country: string | null;
          created_at: string;
          email: string | null;
          field_of_study: string | null;
          first_name: string | null;
          full_name: string | null;
          grade_year: string | null;
          id: string;
          industry: string | null;
          institution: string | null;
          last_name: string | null;
          logo_url: string | null;
          mobile: string | null;
          organization: string | null;
          other_details: string | null;
          preferred_language: string | null;
          referral: string | null;
          role: string | null;
          school: string | null;
          selected_plan: string | null;
          subject_taught: string | null;
          team_size: string | null;
          updated_at: string;
          use_cases: string[] | null;
          years_exp: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          company_name?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string | null;
          field_of_study?: string | null;
          first_name?: string | null;
          full_name?: string | null;
          grade_year?: string | null;
          id: string;
          industry?: string | null;
          institution?: string | null;
          last_name?: string | null;
          logo_url?: string | null;
          mobile?: string | null;
          organization?: string | null;
          other_details?: string | null;
          preferred_language?: string | null;
          referral?: string | null;
          role?: string | null;
          school?: string | null;
          selected_plan?: string | null;
          subject_taught?: string | null;
          team_size?: string | null;
          updated_at?: string;
          use_cases?: string[] | null;
          years_exp?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          company_name?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string | null;
          field_of_study?: string | null;
          first_name?: string | null;
          full_name?: string | null;
          grade_year?: string | null;
          id?: string;
          industry?: string | null;
          institution?: string | null;
          last_name?: string | null;
          logo_url?: string | null;
          mobile?: string | null;
          organization?: string | null;
          other_details?: string | null;
          preferred_language?: string | null;
          referral?: string | null;
          role?: string | null;
          school?: string | null;
          selected_plan?: string | null;
          subject_taught?: string | null;
          team_size?: string | null;
          updated_at?: string;
          use_cases?: string[] | null;
          years_exp?: string | null;
        };
        Relationships: [];
      };
      question_categories: {
        Row: {
          created_at: string;
          icon: string | null;
          id: string;
          name: string;
          owner_id: string;
          subject: string | null;
        };
        Insert: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          name: string;
          owner_id: string;
          subject?: string | null;
        };
        Update: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          subject?: string | null;
        };
        Relationships: [];
      };
      question_subcategories: {
        Row: {
          category_id: string;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          owner_id: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          owner_id: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_subcategories_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "question_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          acceptable_answers: string[] | null;
          category_id: string | null;
          correct_answer: string | null;
          created_at: string;
          difficulty: Database["public"]["Enums"]["difficulty"];
          explanation: string | null;
          grading_mode: string;
          id: string;
          language: string | null;
          max_points: number;
          model_answer: string | null;
          options: Json | null;
          owner_id: string;
          requires_manual_grading: boolean;
          rubric: string | null;
          source: Database["public"]["Enums"]["question_source"];
          subcategory_id: string | null;
          subject: string | null;
          text: string;
          time_seconds: number;
          topic: string | null;
          type: Database["public"]["Enums"]["question_type"];
          updated_at: string;
        };
        Insert: {
          acceptable_answers?: string[] | null;
          category_id?: string | null;
          correct_answer?: string | null;
          created_at?: string;
          difficulty?: Database["public"]["Enums"]["difficulty"];
          explanation?: string | null;
          grading_mode?: string;
          id?: string;
          language?: string | null;
          max_points?: number;
          model_answer?: string | null;
          options?: Json | null;
          owner_id: string;
          requires_manual_grading?: boolean;
          rubric?: string | null;
          source?: Database["public"]["Enums"]["question_source"];
          subcategory_id?: string | null;
          subject?: string | null;
          text: string;
          time_seconds?: number;
          topic?: string | null;
          type?: Database["public"]["Enums"]["question_type"];
          updated_at?: string;
        };
        Update: {
          acceptable_answers?: string[] | null;
          category_id?: string | null;
          correct_answer?: string | null;
          created_at?: string;
          difficulty?: Database["public"]["Enums"]["difficulty"];
          explanation?: string | null;
          grading_mode?: string;
          id?: string;
          language?: string | null;
          max_points?: number;
          model_answer?: string | null;
          options?: Json | null;
          owner_id?: string;
          requires_manual_grading?: boolean;
          rubric?: string | null;
          source?: Database["public"]["Enums"]["question_source"];
          subcategory_id?: string | null;
          subject?: string | null;
          text?: string;
          time_seconds?: number;
          topic?: string | null;
          type?: Database["public"]["Enums"]["question_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "question_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_subcategory_id_fkey";
            columns: ["subcategory_id"];
            isOneToOne: false;
            referencedRelation: "question_subcategories";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_answers: {
        Row: {
          answer: string | null;
          answered_at: string;
          attempt_id: string;
          graded_at: string | null;
          graded_by: string | null;
          graded_by_ai: boolean;
          grader_comment: string | null;
          id: string;
          is_correct: boolean | null;
          points_awarded: number | null;
          question_id: string;
          time_taken_seconds: number | null;
        };
        Insert: {
          answer?: string | null;
          answered_at?: string;
          attempt_id: string;
          graded_at?: string | null;
          graded_by?: string | null;
          graded_by_ai?: boolean;
          grader_comment?: string | null;
          id?: string;
          is_correct?: boolean | null;
          points_awarded?: number | null;
          question_id: string;
          time_taken_seconds?: number | null;
        };
        Update: {
          answer?: string | null;
          answered_at?: string;
          attempt_id?: string;
          graded_at?: string | null;
          graded_by?: string | null;
          graded_by_ai?: boolean;
          grader_comment?: string | null;
          id?: string;
          is_correct?: boolean | null;
          points_awarded?: number | null;
          question_id?: string;
          time_taken_seconds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "quiz_attempts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_attempts: {
        Row: {
          completed: boolean;
          completed_at: string | null;
          id: string;
          participant_email: string | null;
          participant_id: string | null;
          participant_name: string | null;
          score: number;
          session_id: string;
          started_at: string;
          total_questions: number;
          user_id: string | null;
        };
        Insert: {
          completed?: boolean;
          completed_at?: string | null;
          id?: string;
          participant_email?: string | null;
          participant_id?: string | null;
          participant_name?: string | null;
          score?: number;
          session_id: string;
          started_at?: string;
          total_questions?: number;
          user_id?: string | null;
        };
        Update: {
          completed?: boolean;
          completed_at?: string | null;
          id?: string;
          participant_email?: string | null;
          participant_id?: string | null;
          participant_name?: string | null;
          score?: number;
          session_id?: string;
          started_at?: string;
          total_questions?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: false;
            referencedRelation: "participants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "quiz_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_feedback: {
        Row: {
          comment: string | null;
          id: string;
          participant_email: string | null;
          participant_name: string;
          rating: number;
          session_id: string;
          submitted_at: string;
        };
        Insert: {
          comment?: string | null;
          id?: string;
          participant_email?: string | null;
          participant_name?: string;
          rating: number;
          session_id: string;
          submitted_at?: string;
        };
        Update: {
          comment?: string | null;
          id?: string;
          participant_email?: string | null;
          participant_name?: string;
          rating?: number;
          session_id?: string;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_feedback_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "quiz_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_session_participants: {
        Row: {
          participant_id: string;
          session_id: string;
        };
        Insert: {
          participant_id: string;
          session_id: string;
        };
        Update: {
          participant_id?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_session_participants_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: false;
            referencedRelation: "participants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_session_participants_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "quiz_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_session_questions: {
        Row: {
          id: string;
          position: number;
          question_id: string;
          session_id: string;
          time_seconds: number | null;
        };
        Insert: {
          id?: string;
          position?: number;
          question_id: string;
          session_id: string;
          time_seconds?: number | null;
        };
        Update: {
          id?: string;
          position?: number;
          question_id?: string;
          session_id?: string;
          time_seconds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_session_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_session_questions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "quiz_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_session_subtypes: {
        Row: {
          session_id: string;
          subtype_id: string;
        };
        Insert: {
          session_id: string;
          subtype_id: string;
        };
        Update: {
          session_id?: string;
          subtype_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_session_subtypes_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "quiz_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_session_subtypes_subtype_id_fkey";
            columns: ["subtype_id"];
            isOneToOne: false;
            referencedRelation: "participant_subtypes";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_sessions: {
        Row: {
          access_code: string | null;
          archived_at: string | null;
          category_id: string | null;
          completed_at: string | null;
          created_at: string;
          default_time_per_question: number | null;
          description: string | null;
          expires_at: string | null;
          id: string;
          is_open: boolean;
          language: string | null;
          mode: Database["public"]["Enums"]["session_mode"];
          owner_id: string;
          pause_offset_seconds: number;
          paused_at: string | null;
          reminder_sent: boolean;
          scheduled_at: string | null;
          show_results_after_quiz: boolean;
          started_at: string | null;
          status: Database["public"]["Enums"]["session_status"];
          subcategory_id: string | null;
          subject: string | null;
          title: string;
          topic: string | null;
          updated_at: string;
        };
        Insert: {
          access_code?: string | null;
          archived_at?: string | null;
          category_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          default_time_per_question?: number | null;
          description?: string | null;
          expires_at?: string | null;
          id?: string;
          is_open?: boolean;
          language?: string | null;
          mode?: Database["public"]["Enums"]["session_mode"];
          owner_id: string;
          pause_offset_seconds?: number;
          paused_at?: string | null;
          reminder_sent?: boolean;
          scheduled_at?: string | null;
          show_results_after_quiz?: boolean;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["session_status"];
          subcategory_id?: string | null;
          subject?: string | null;
          title: string;
          topic?: string | null;
          updated_at?: string;
        };
        Update: {
          access_code?: string | null;
          archived_at?: string | null;
          category_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          default_time_per_question?: number | null;
          description?: string | null;
          expires_at?: string | null;
          id?: string;
          is_open?: boolean;
          language?: string | null;
          mode?: Database["public"]["Enums"]["session_mode"];
          owner_id?: string;
          pause_offset_seconds?: number;
          paused_at?: string | null;
          reminder_sent?: boolean;
          scheduled_at?: string | null;
          show_results_after_quiz?: boolean;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["session_status"];
          subcategory_id?: string | null;
          subject?: string | null;
          title?: string;
          topic?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "question_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_sessions_subcategory_id_fkey";
            columns: ["subcategory_id"];
            isOneToOne: false;
            referencedRelation: "question_subcategories";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limit_ledger: {
        Row: {
          bucket: string;
          hit_count: number;
          identifier: string;
          window_start: string;
        };
        Insert: {
          bucket: string;
          hit_count?: number;
          identifier: string;
          window_start?: string;
        };
        Update: {
          bucket?: string;
          hit_count?: number;
          identifier?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      security_alerts: {
        Row: {
          actor_user_id: string | null;
          alert_type: string;
          created_at: string;
          details: Json;
          id: string;
          message: string;
          plan_owner_id: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          severity: string;
          status: string;
          title: string;
        };
        Insert: {
          actor_user_id?: string | null;
          alert_type: string;
          created_at?: string;
          details?: Json;
          id?: string;
          message: string;
          plan_owner_id?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          severity: string;
          status?: string;
          title: string;
        };
        Update: {
          actor_user_id?: string | null;
          alert_type?: string;
          created_at?: string;
          details?: Json;
          id?: string;
          message?: string;
          plan_owner_id?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          severity?: string;
          status?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "security_alerts_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "security_alerts_plan_owner_id_fkey";
            columns: ["plan_owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "security_alerts_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      trial_ai_usage: {
        Row: {
          created_at: string;
          id: string;
          trial_end: string;
          trial_start: string;
          updated_at: string;
          used_calls: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          trial_end?: string;
          trial_start?: string;
          updated_at?: string;
          used_calls?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          trial_end?: string;
          trial_start?: string;
          updated_at?: string;
          used_calls?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      user_credits: {
        Row: {
          balance: number;
          id: string;
          total_earned: number;
          total_spent: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance?: number;
          id?: string;
          total_earned?: number;
          total_spent?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          id?: string;
          total_earned?: number;
          total_spent?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_subscriptions: {
        Row: {
          assigned_by: string | null;
          created_at: string;
          expires_at: string | null;
          id: string;
          last_credit_refill_at: string;
          notes: string | null;
          plan_id: string;
          started_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          assigned_by?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          last_credit_refill_at?: string;
          notes?: string | null;
          plan_id: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          assigned_by?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          last_credit_refill_at?: string;
          notes?: string | null;
          plan_id?: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      activity_analytics_daily: {
        Row: {
          action_type: string | null;
          active_users: number | null;
          activity_count: number | null;
          day: string | null;
          module: string | null;
        };
        Relationships: [];
      };
      ai_usage_analytics_daily: {
        Row: {
          active_users: number | null;
          calls: number | null;
          credits_charged: number | null;
          day: string | null;
          estimated_cost: number | null;
          feature: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          total_tokens: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      _log_app_activity: {
        Args: {
          p_action_type: string;
          p_details?: Json;
          p_entity_id: string;
          p_entity_label: string;
          p_entity_type: string;
          p_message: string;
          p_module: string;
          p_plan_owner_id: string;
          p_risk_score?: number;
        };
        Returns: undefined;
      };
      _log_session_activity: {
        Args: {
          p_action_type: string;
          p_details?: Json;
          p_message: string;
          p_owner_id: string;
          p_risk_score?: number;
          p_session_id: string;
          p_session_title: string;
        };
        Returns: undefined;
      };
      _rl_check: {
        Args: {
          p_bucket: string;
          p_identifier: string;
          p_limit: number;
          p_window_seconds?: number;
        };
        Returns: boolean;
      };
      accept_company_invite: {
        Args: { p_host_user_id: string; p_member_id: string; p_token: string };
        Returns: boolean;
      };
      accept_org_invite: { Args: { p_token: string }; Returns: Json };
      activate_host_member: {
        Args: { p_host_user_id: string; p_member_id: string };
        Returns: boolean;
      };
      activate_payment: {
        Args: { p_admin_note?: string; p_payment_request_id: string };
        Returns: Json;
      };
      add_credits:
        | {
            Args: {
              p_amount: number;
              p_description?: string;
              p_performed_by?: string;
              p_reference_id?: string;
              p_type: Database["public"]["Enums"]["credit_tx_type"];
              p_user_id: string;
            };
            Returns: undefined;
          }
        | {
            Args: {
              p_action?: string;
              p_credits: number;
              p_description?: string;
              p_reference_id?: string;
              p_reference_type?: string;
              p_user_id: string;
            };
            Returns: Json;
          };
      admin_adjust_credits: {
        Args: {
          p_amount: number;
          p_description?: string;
          p_direction: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      approve_credit_request: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      approve_payment: {
        Args: {
          p_admin_id: string;
          p_admin_notes?: string;
          p_payment_id: string;
        };
        Returns: undefined;
      };
      archive_old_sessions: {
        Args: {
          p_answer_retention_days?: number;
          p_archive_after_days?: number;
          p_orphan_cleanup_days?: number;
        };
        Returns: Json;
      };
      assign_member_department: {
        Args: { p_department_id: string; p_org_id: string; p_user_id: string };
        Returns: Json;
      };
      check_email_exists: { Args: { p_email: string }; Returns: boolean };
      check_participant_email_in_subtype: {
        Args: { p_email: string; p_subtype_id: string };
        Returns: boolean;
      };
      cleanup_rate_limit_ledger: { Args: never; Returns: undefined };
      close_quiz_session: { Args: { p_session_id: string }; Returns: Json };
      complete_quiz_attempt: { Args: { p_attempt_id: string }; Returns: Json };
      consume_trial_ai_call: { Args: { p_user_id: string }; Returns: boolean };
      create_notification: {
        Args: {
          p_body?: string;
          p_link?: string;
          p_title: string;
          p_type?: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      decline_credit_request: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      deduct_credits: {
        Args: {
          p_amount: number;
          p_description?: string;
          p_reference_id?: string;
          p_type: Database["public"]["Enums"]["credit_tx_type"];
          p_user_id: string;
        };
        Returns: boolean;
      };
      ensure_my_plan: { Args: { p_plan_slug: string }; Returns: undefined };
      ensure_quiz_attempts_subtype: {
        Args: { p_owner_id: string };
        Returns: string;
      };
      expire_trials: { Args: never; Returns: undefined };
      explain_quiz_hot_path: {
        Args: {
          p_access_code?: string;
          p_owner_id?: string;
          p_plan: string;
          p_session_id?: string;
        };
        Returns: {
          plan: string;
        }[];
      };
      finalize_session_grading: {
        Args: { p_session_id: string };
        Returns: Json;
      };
      generate_session_access_code: { Args: never; Returns: string };
      get_admin_pending_payments: { Args: { p_status?: string }; Returns: Json };
      get_credit_cost: {
        Args: { p_action: string; p_participant_count?: number };
        Returns: number;
      };
      get_invite_for_token: { Args: { p_token: string }; Returns: Json };
      get_my_company_id: { Args: never; Returns: string };
      get_my_host_context: {
        Args: never;
        Returns: {
          admin_email: string;
          admin_name: string;
          admin_user_id: string;
          company_name: string;
          host_balance: number;
          host_total_earned: number;
          host_total_spent: number;
          member_credit_limit: number;
          member_credits_used: number;
          member_full_name: string;
          member_id: string;
          member_role: string;
          org_company_id: string;
          org_plan_name: string;
          org_plan_slug: string;
        }[];
      };
      get_my_recent_activity: {
        Args: { p_limit?: number };
        Returns: {
          action_type: string;
          actor_name: string;
          created_at: string;
          details: Json;
          entity_id: string;
          entity_label: string;
          entity_type: string;
          id: string;
          message: string;
          module: string;
          risk_score: number;
        }[];
      };
      get_org_dashboard_stats: { Args: { p_org_id: string }; Returns: Json };
      get_org_invite_info: { Args: { p_token: string }; Returns: Json };
      get_session_activity: {
        Args: { p_limit?: number; p_session_id: string };
        Returns: {
          action_type: string;
          actor_email: string;
          actor_name: string;
          created_at: string;
          details: Json;
          id: string;
          message: string;
          risk_score: number;
        }[];
      };
      get_session_for_join: { Args: { p_access_code: string }; Returns: Json };
      get_session_for_play: {
        Args: { p_access_code: string; p_attempt_id: string };
        Returns: Json;
      };
      get_session_leaderboard: { Args: { p_session_id: string }; Returns: Json };
      get_user_plan: { Args: { p_user_id: string }; Returns: Json };
      has_module_access: {
        Args: { p_module: string; p_user_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      increment_daily_usage: {
        Args: {
          p_participants?: number;
          p_sessions?: number;
          p_user_id: string;
        };
        Returns: undefined;
      };
      invite_org_member: {
        Args: {
          p_department_id?: string;
          p_email: string;
          p_org_id: string;
          p_role?: Database["public"]["Enums"]["org_member_role"];
        };
        Returns: Json;
      };
      is_enterprise_email_allowed: {
        Args: { p_email: string };
        Returns: boolean;
      };
      join_quiz_session: {
        Args: {
          p_access_code: string;
          p_email?: string;
          p_mobile?: string;
          p_name: string;
          p_roll_number?: string;
        };
        Returns: Json;
      };
      log_activity: {
        Args: {
          p_action_type: string;
          p_details?: Json;
          p_entity_id?: string;
          p_entity_label?: string;
          p_entity_type?: string;
          p_message?: string;
          p_metadata?: Json;
          p_module: string;
          p_plan_owner_id?: string;
          p_risk_score?: number;
        };
        Returns: string;
      };
      pause_quiz_session: { Args: { p_session_id: string }; Returns: Json };
      preview_company_invite: {
        Args: { p_member_id: string; p_token: string };
        Returns: {
          company_name: string;
          invited_email: string;
          is_pending: boolean;
        }[];
      };
      prune_activity_logs: {
        Args: { p_noise_days?: number; p_regular_days?: number };
        Returns: {
          deleted_noise: number;
          deleted_regular: number;
        }[];
      };
      prune_notifications: {
        Args: { p_read_days?: number; p_unread_days?: number };
        Returns: {
          deleted_read: number;
          deleted_unread: number;
        }[];
      };
      redeem_participant_invite: {
        Args: {
          p_email?: string;
          p_metadata?: Json;
          p_mobile?: string;
          p_name: string;
          p_token: string;
        };
        Returns: Json;
      };
      reject_payment: {
        Args: { p_admin_note: string; p_payment_request_id: string };
        Returns: Json;
      };
      resume_quiz_session: { Args: { p_session_id: string }; Returns: Json };
      send_app_email: {
        Args: { p_data: Json; p_type: string };
        Returns: undefined;
      };
      submit_quiz_answer: {
        Args: {
          p_answer: string;
          p_attempt_id: string;
          p_question_id: string;
          p_time_taken_seconds: number;
        };
        Returns: Json;
      };
      submit_quiz_answers_batch: { Args: { p_answers: Json }; Returns: Json };
      transfer_credits_to_host: {
        Args: {
          p_admin_id: string;
          p_amount: number;
          p_host_user_id: string;
          p_member_id: string;
          p_note?: string;
        };
        Returns: boolean;
      };
      warn_expiring_trials: { Args: never; Returns: undefined };
    };
    Enums: {
      app_role: "admin" | "teacher" | "student";
      company_type:
        | "school"
        | "university"
        | "college"
        | "training_center"
        | "corporate"
        | "government"
        | "ngo"
        | "other";
      credit_tx_type:
        | "plan_refill"
        | "manual_topup"
        | "payment_approved"
        | "ai_question_gen"
        | "ai_image_scan"
        | "ai_interview"
        | "ai_coding_test"
        | "extra_quiz"
        | "extra_participants"
        | "admin_adjustment"
        | "expiry"
        | "ai_grading";
      difficulty: "easy" | "medium" | "hard";
      member_role: "admin" | "host" | "viewer";
      member_status: "pending" | "active" | "suspended" | "removed";
      org_invite_status: "pending" | "accepted" | "expired" | "revoked";
      org_member_role: "org_admin" | "dept_admin" | "host";
      org_member_status: "invited" | "active" | "suspended";
      payment_method: "easypaisa" | "jazzcash" | "bank_transfer" | "other";
      payment_status: "pending" | "approved" | "rejected" | "refunded";
      plan_slug:
        | "individual_starter"
        | "individual_pro"
        | "individual_pro_plus"
        | "enterprise_starter"
        | "enterprise_pro"
        | "enterprise_elite"
        | "enterprise_free";
      plan_tier: "individual" | "enterprise";
      question_source: "manual" | "ai" | "ocr" | "import";
      question_type: "mcq" | "true_false" | "short_answer" | "long_answer";
      session_mode: "live" | "qr_link";
      session_status: "draft" | "scheduled" | "active" | "completed" | "expired" | "grading";
      subscription_status: "active" | "pending" | "suspended" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "teacher", "student"],
      company_type: [
        "school",
        "university",
        "college",
        "training_center",
        "corporate",
        "government",
        "ngo",
        "other",
      ],
      credit_tx_type: [
        "plan_refill",
        "manual_topup",
        "payment_approved",
        "ai_question_gen",
        "ai_image_scan",
        "ai_interview",
        "ai_coding_test",
        "extra_quiz",
        "extra_participants",
        "admin_adjustment",
        "expiry",
        "ai_grading",
      ],
      difficulty: ["easy", "medium", "hard"],
      member_role: ["admin", "host", "viewer"],
      member_status: ["pending", "active", "suspended", "removed"],
      org_invite_status: ["pending", "accepted", "expired", "revoked"],
      org_member_role: ["org_admin", "dept_admin", "host"],
      org_member_status: ["invited", "active", "suspended"],
      payment_method: ["easypaisa", "jazzcash", "bank_transfer", "other"],
      payment_status: ["pending", "approved", "rejected", "refunded"],
      plan_slug: [
        "individual_starter",
        "individual_pro",
        "individual_pro_plus",
        "enterprise_starter",
        "enterprise_pro",
        "enterprise_elite",
        "enterprise_free",
      ],
      plan_tier: ["individual", "enterprise"],
      question_source: ["manual", "ai", "ocr", "import"],
      question_type: ["mcq", "true_false", "short_answer", "long_answer"],
      session_mode: ["live", "qr_link"],
      session_status: ["draft", "scheduled", "active", "completed", "expired", "grading"],
      subscription_status: ["active", "pending", "suspended", "cancelled"],
    },
  },
} as const;
