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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      billing_queue: {
        Row: {
          amount: number | null
          client_id: number
          client_name: string
          client_phone: string
          created_at: string | null
          days_overdue: number | null
          due_date: string | null
          id: number
          message: string | null
          owner_id: string | null
          sent_at: string | null
          status: string
          type: string
        }
        Insert: {
          amount?: number | null
          client_id: number
          client_name: string
          client_phone: string
          created_at?: string | null
          days_overdue?: number | null
          due_date?: string | null
          id?: number
          message?: string | null
          owner_id?: string | null
          sent_at?: string | null
          status?: string
          type: string
        }
        Update: {
          amount?: number | null
          client_id?: number
          client_name?: string
          client_phone?: string
          created_at?: string | null
          days_overdue?: number | null
          due_date?: string | null
          id?: number
          message?: string | null
          owner_id?: string | null
          sent_at?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_settings: {
        Row: {
          key: string
          owner_id: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          owner_id?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          owner_id?: string | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      bills_payable: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          current_installment: number | null
          description: string
          due_date: string
          id: number
          installments_count: number | null
          notes: string | null
          owner_id: string | null
          paid_date: string | null
          parent_bill_id: number | null
          payment_type: string
          status: string
          supplier: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          current_installment?: number | null
          description: string
          due_date: string
          id?: number
          installments_count?: number | null
          notes?: string | null
          owner_id?: string | null
          paid_date?: string | null
          parent_bill_id?: number | null
          payment_type?: string
          status?: string
          supplier?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          current_installment?: number | null
          description?: string
          due_date?: string
          id?: number
          installments_count?: number | null
          notes?: string | null
          owner_id?: string | null
          paid_date?: string | null
          parent_bill_id?: number | null
          payment_type?: string
          status?: string
          supplier?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_payable_parent_bill_id_fkey"
            columns: ["parent_bill_id"]
            isOneToOne: false
            referencedRelation: "bills_payable"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          amount: number | null
          city: string | null
          created_at: string | null
          document: string | null
          due_date: string | null
          email: string | null
          id: number
          is_active: boolean | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string
          phone2: string | null
          state: string | null
          traccar_email: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          amount?: number | null
          city?: string | null
          created_at?: string | null
          document?: string | null
          due_date?: string | null
          email?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone: string
          phone2?: string | null
          state?: string | null
          traccar_email?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          amount?: number | null
          city?: string | null
          created_at?: string | null
          document?: string | null
          due_date?: string | null
          email?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string
          phone2?: string | null
          state?: string | null
          traccar_email?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          content: string
          created_at: string | null
          id: number
          is_active: boolean | null
          name: string
          owner_id: string | null
          type: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          owner_id?: string | null
          type: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          owner_id?: string | null
          type?: string
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
  public: {
    Enums: {},
  },
} as const
