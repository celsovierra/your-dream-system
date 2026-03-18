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
      client_billing_config: {
        Row: {
          amount: number
          auto_charge: boolean
          billing_cycle: string
          cobrar: boolean
          created_at: string
          desconto: number
          due_day: number
          id: string
          next_due_date: string | null
          tenant_id: string
          updated_at: string
          user_id: number
          user_name: string | null
          user_phone: string | null
        }
        Insert: {
          amount?: number
          auto_charge?: boolean
          billing_cycle?: string
          cobrar?: boolean
          created_at?: string
          desconto?: number
          due_day?: number
          id?: string
          next_due_date?: string | null
          tenant_id: string
          updated_at?: string
          user_id: number
          user_name?: string | null
          user_phone?: string | null
        }
        Update: {
          amount?: number
          auto_charge?: boolean
          billing_cycle?: string
          cobrar?: boolean
          created_at?: string
          desconto?: number
          due_day?: number
          id?: string
          next_due_date?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: number
          user_name?: string | null
          user_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_billing_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      contract_invites: {
        Row: {
          client_data: Json | null
          client_name: string | null
          client_user_id: number | null
          created_at: string
          expires_at: string
          google_drive_file_id: string | null
          google_drive_file_url: string | null
          id: string
          signed_at: string | null
          status: string
          template_id: string | null
          tenant_id: string
          token: string
        }
        Insert: {
          client_data?: Json | null
          client_name?: string | null
          client_user_id?: number | null
          created_at?: string
          expires_at?: string
          google_drive_file_id?: string | null
          google_drive_file_url?: string | null
          id?: string
          signed_at?: string | null
          status?: string
          template_id?: string | null
          tenant_id: string
          token?: string
        }
        Update: {
          client_data?: Json | null
          client_name?: string | null
          client_user_id?: number | null
          created_at?: string
          expires_at?: string
          google_drive_file_id?: string | null
          google_drive_file_url?: string | null
          id?: string
          signed_at?: string | null
          status?: string
          template_id?: string | null
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_invites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_drive_config: {
        Row: {
          client_id: string | null
          client_secret: string | null
          created_at: string
          folder_id: string | null
          id: string
          refresh_token: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string
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
      tenant_whatsapp_config: {
        Row: {
          api_key: string | null
          api_url: string | null
          created_at: string
          id: string
          instance_name: string | null
          is_active: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          is_active?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          is_active?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_whatsapp_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          admin_email: string | null
          admin_password: string | null
          api_url: string | null
          created_at: string
          id: string
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          admin_email?: string | null
          admin_password?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          admin_email?: string | null
          admin_password?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string
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
