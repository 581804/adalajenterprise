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
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          label: string | null
          line1: string
          line2: string | null
          phone: string | null
          postal_code: string
          region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          label?: string | null
          line1: string
          line2?: string | null
          phone?: string | null
          postal_code: string
          region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          label?: string | null
          line1?: string
          line2?: string | null
          phone?: string | null
          postal_code?: string
          region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          variant_id: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          variant_id?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          code: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          min_subtotal_cents: number
          starts_at: string | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at: string
          usage_limit: number | null
          used_count: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_subtotal_cents?: number
          starts_at?: string | null
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_subtotal_cents?: number
          starts_at?: string | null
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      fee_categories: {
        Row: {
          amount_cents: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          percent: number
          scope: string
          tax_rate_id: string | null
          taxable: boolean
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          percent?: number
          scope?: string
          tax_rate_id?: string | null
          taxable?: boolean
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          percent?: number
          scope?: string
          tax_rate_id?: string | null
          taxable?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_categories_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          order_id: string
          product_id: string | null
          quantity: number
          title: string
          unit_price_cents: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          order_id: string
          product_id?: string | null
          quantity: number
          title: string
          unit_price_cents: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          title?: string
          unit_price_cents?: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json
          created_at: string
          currency: string
          discount_cents: number
          discount_code: string | null
          email: string
          fee_cents: number
          id: string
          notes: string | null
          order_number: string
          shipping_address: Json
          shipping_cents: number
          shipping_method: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_address?: Json
          created_at?: string
          currency?: string
          discount_cents?: number
          discount_code?: string | null
          email: string
          fee_cents?: number
          id?: string
          notes?: string | null
          order_number?: string
          shipping_address?: Json
          shipping_cents?: number
          shipping_method?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_address?: Json
          created_at?: string
          currency?: string
          discount_cents?: number
          discount_code?: string | null
          email?: string
          fee_cents?: number
          id?: string
          notes?: string | null
          order_number?: string
          shipping_address?: Json
          shipping_cents?: number
          shipping_method?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_published: boolean
          seo: Json
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          seo?: Json
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          seo?: Json
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          option_values: Json
          price_cents: number | null
          product_id: string
          sku: string | null
          sort_order: number
          stock: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          option_values?: Json
          price_cents?: number | null
          product_id: string
          sku?: string | null
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          option_values?: Json
          price_cents?: number | null
          product_id?: string
          sku?: string | null
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          compare_at_cents: number | null
          created_at: string
          currency: string
          description: string | null
          fee_category_id: string | null
          id: string
          images: Json
          is_featured: boolean
          price_cents: number
          price_includes_tax: boolean
          seo: Json
          short_description: string | null
          sku: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          tags: string[]
          tax_rate_id: string | null
          title: string
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          category_id?: string | null
          compare_at_cents?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          fee_category_id?: string | null
          id?: string
          images?: Json
          is_featured?: boolean
          price_cents?: number
          price_includes_tax?: boolean
          seo?: Json
          short_description?: string | null
          sku?: string | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          tags?: string[]
          tax_rate_id?: string | null
          title: string
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          category_id?: string | null
          compare_at_cents?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          fee_category_id?: string | null
          id?: string
          images?: Json
          is_featured?: boolean
          price_cents?: number
          price_includes_tax?: boolean
          seo?: Json
          short_description?: string | null
          sku?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          tags?: string[]
          tax_rate_id?: string | null
          title?: string
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_fee_category_id_fkey"
            columns: ["fee_category_id"]
            isOneToOne: false
            referencedRelation: "fee_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shipping_rates: {
        Row: {
          estimated_days: string | null
          free_over_cents: number | null
          id: string
          is_active: boolean
          min_order_cents: number
          name: string
          price_cents: number
          zone_id: string
        }
        Insert: {
          estimated_days?: string | null
          free_over_cents?: number | null
          id?: string
          is_active?: boolean
          min_order_cents?: number
          name: string
          price_cents?: number
          zone_id: string
        }
        Update: {
          estimated_days?: string | null
          free_over_cents?: number | null
          id?: string
          is_active?: boolean
          min_order_cents?: number
          name?: string
          price_cents?: number
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          countries: string[]
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          countries?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          countries?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          accent_color: string
          announcement: Json
          banners: Json
          brand_name: string
          contact_email: string | null
          contact_phone: string | null
          currency: string
          currency_symbol: string
          favicon_url: string | null
          footer_nav: Json
          header_nav: Json
          id: number
          logo_url: string | null
          primary_color: string
          seo: Json
          social_links: Json
          tagline: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string
          announcement?: Json
          banners?: Json
          brand_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          currency?: string
          currency_symbol?: string
          favicon_url?: string | null
          footer_nav?: Json
          header_nav?: Json
          id?: number
          logo_url?: string | null
          primary_color?: string
          seo?: Json
          social_links?: Json
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string
          announcement?: Json
          banners?: Json
          brand_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          currency?: string
          currency_symbol?: string
          favicon_url?: string | null
          footer_nav?: Json
          header_nav?: Json
          id?: number
          logo_url?: string | null
          primary_color?: string
          seo?: Json
          social_links?: Json
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          country: string
          id: string
          is_active: boolean
          name: string
          rate_percent: number
          region: string | null
        }
        Insert: {
          country: string
          id?: string
          is_active?: boolean
          name: string
          rate_percent?: number
          region?: string | null
        }
        Update: {
          country?: string
          id?: string
          is_active?: boolean
          name?: string
          rate_percent?: number
          region?: string | null
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
      app_role: "admin" | "customer"
      discount_type: "percent" | "fixed" | "free_shipping"
      order_status:
        | "pending"
        | "paid"
        | "fulfilled"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded"
      product_status: "draft" | "active" | "archived"
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
      app_role: ["admin", "customer"],
      discount_type: ["percent", "fixed", "free_shipping"],
      order_status: [
        "pending",
        "paid",
        "fulfilled",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      product_status: ["draft", "active", "archived"],
    },
  },
} as const
