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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      branches: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          created_at: string
          id: string
          report_date: string
          summary: string | null
          tasks_completed: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_date?: string
          summary?: string | null
          tasks_completed?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          report_date?: string
          summary?: string | null
          tasks_completed?: number | null
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          recorded_by: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          recorded_by: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          recorded_by?: string
        }
        Relationships: []
      }
      finished_products: {
        Row: {
          branch_id: string | null
          completed_at: string
          id: string
          location: string
          product_type: string
          production_cost: number
          production_order_id: string
          status: Database["public"]["Enums"]["product_status"]
        }
        Insert: {
          branch_id?: string | null
          completed_at?: string
          id?: string
          location?: string
          product_type: string
          production_cost?: number
          production_order_id: string
          status?: Database["public"]["Enums"]["product_status"]
        }
        Update: {
          branch_id?: string | null
          completed_at?: string
          id?: string
          location?: string
          product_type?: string
          production_cost?: number
          production_order_id?: string
          status?: Database["public"]["Enums"]["product_status"]
        }
        Relationships: [
          {
            foreignKeyName: "finished_products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_products_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_materials: {
        Row: {
          category: string
          created_at: string
          id: string
          min_stock_level: number
          name: string
          quantity: number
          supplier_id: string | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          min_stock_level?: number
          name: string
          quantity?: number
          supplier_id?: string | null
          unit: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          min_stock_level?: number
          name?: string
          quantity?: number
          supplier_id?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_services: {
        Row: {
          category: string
          condition: string | null
          created_at: string
          id: string
          location: string | null
          name: string
          quantity: number
          updated_at: string
        }
        Insert: {
          category: string
          condition?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          category?: string
          condition?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_configs: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          stage: Database["public"]["Enums"]["production_stage"] | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          stage?: Database["public"]["Enums"]["production_stage"] | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          stage?: Database["public"]["Enums"]["production_stage"] | null
          user_id?: string
        }
        Relationships: []
      }
      product_material_usage: {
        Row: {
          created_at: string
          id: string
          material_id: string
          production_order_id: string
          quantity_used: number
          stage: Database["public"]["Enums"]["production_stage"] | null
          status: string
          worker_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          production_order_id: string
          quantity_used: number
          stage?: Database["public"]["Enums"]["production_stage"] | null
          status?: string
          worker_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          production_order_id?: string
          quantity_used?: number
          stage?: Database["public"]["Enums"]["production_stage"] | null
          status?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_material_usage_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "inventory_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_material_usage_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          batch_number: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_stage: Database["public"]["Enums"]["production_stage"]
          expected_completion_date: string | null
          id: string
          notes: string | null
          product_code: string | null
          product_type: string
          production_cost: number | null
          started_at: string
          status: Database["public"]["Enums"]["product_status"]
        }
        Insert: {
          batch_number?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: Database["public"]["Enums"]["production_stage"]
          expected_completion_date?: string | null
          id?: string
          notes?: string | null
          product_code?: string | null
          product_type: string
          production_cost?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["product_status"]
        }
        Update: {
          batch_number?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: Database["public"]["Enums"]["production_stage"]
          expected_completion_date?: string | null
          id?: string
          notes?: string | null
          product_code?: string | null
          product_type?: string
          production_cost?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["product_status"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_muted: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_muted?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_muted?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          finished_product_id: string
          id: string
          mpesa_code: string
          product_type: string
          sales_officer_id: string
          selling_price: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          finished_product_id: string
          id?: string
          mpesa_code: string
          product_type: string
          sales_officer_id: string
          selling_price: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          finished_product_id?: string
          id?: string
          mpesa_code?: string
          product_type?: string
          sales_officer_id?: string
          selling_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "finished_products"
            referencedColumns: ["id"]
          },
        ]
      }
      service_sales: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          description: string | null
          id: string
          mpesa_code: string
          sales_officer_id: string
          service_name: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          description?: string | null
          id?: string
          mpesa_code: string
          sales_officer_id: string
          service_name: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          description?: string | null
          id?: string
          mpesa_code?: string
          sales_officer_id?: string
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_inventory: {
        Row: {
          branch_id: string
          finished_product_id: string
          id: string
          transferred_at: string
          transferred_by: string | null
        }
        Insert: {
          branch_id: string
          finished_product_id: string
          id?: string
          transferred_at?: string
          transferred_by?: string | null
        }
        Update: {
          branch_id?: string
          finished_product_id?: string
          id?: string
          transferred_at?: string
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_inventory_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "finished_products"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_assignments: {
        Row: {
          id: string
          stage: Database["public"]["Enums"]["production_stage"]
          user_id: string
        }
        Insert: {
          id?: string
          stage: Database["public"]["Enums"]["production_stage"]
          user_id: string
        }
        Update: {
          id?: string
          stage?: Database["public"]["Enums"]["production_stage"]
          user_id?: string
        }
        Relationships: []
      }
      stage_logs: {
        Row: {
          completed_at: string | null
          id: string
          notes: string | null
          production_order_id: string
          stage: Database["public"]["Enums"]["production_stage"]
          started_at: string
          worker_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          notes?: string | null
          production_order_id: string
          stage: Database["public"]["Enums"]["production_stage"]
          started_at?: string
          worker_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          notes?: string | null
          production_order_id?: string
          stage?: Database["public"]["Enums"]["production_stage"]
          started_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_logs_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact: string | null
          created_at: string
          email: string | null
          id: string
          name: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          payment_method: string | null
          reference_number: string | null
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          reference_number?: string | null
          type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          reference_number?: string | null
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          approved_earnings: number
          id: string
          paid_earnings: number
          pending_earnings: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_earnings?: number
          id?: string
          paid_earnings?: number
          pending_earnings?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_earnings?: number
          id?: string
          paid_earnings?: number
          pending_earnings?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_production_stage: {
        Args: {
          _current_stage: Database["public"]["Enums"]["production_stage"]
          _order_id: string
          _worker_id: string
        }
        Returns: undefined
      }
      create_production_batch: {
        Args: {
          p_batch_number: string
          p_created_by?: string
          p_expected_completion_date?: string
          p_notes?: string
          p_product_type: string
          p_quantity: number
        }
        Returns: {
          batch_number: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_stage: Database["public"]["Enums"]["production_stage"]
          expected_completion_date: string | null
          id: string
          notes: string | null
          product_code: string | null
          product_type: string
          production_cost: number | null
          started_at: string
          status: Database["public"]["Enums"]["product_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "production_orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_product_code: { Args: { p_type: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "inventory_officer"
        | "workshop_worker"
        | "sales_officer"
      payment_type: "daily_wage" | "per_stage" | "per_product" | "commission"
      product_status: "in_production" | "completed" | "transferred" | "sold"
      production_stage:
        | "wood_cutting"
        | "frame_assembly"
        | "board_fitting"
        | "sanding"
        | "fabric_lining"
        | "painting"
        | "handle_installation"
        | "glass_installation"
        | "final_assembly"
        | "quality_inspection"
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
      app_role: [
        "admin",
        "inventory_officer",
        "workshop_worker",
        "sales_officer",
      ],
      payment_type: ["daily_wage", "per_stage", "per_product", "commission"],
      product_status: ["in_production", "completed", "transferred", "sold"],
      production_stage: [
        "wood_cutting",
        "frame_assembly",
        "board_fitting",
        "sanding",
        "fabric_lining",
        "painting",
        "handle_installation",
        "glass_installation",
        "final_assembly",
        "quality_inspection",
      ],
    },
  },
} as const
