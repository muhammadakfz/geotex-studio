export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          is_public?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      diagrams: {
        Row: {
          id: string;
          project_id: string;
          owner_id: string;
          name: string;
          description: string | null;
          diagram_type: "geometry" | "physics" | "calculus" | "custom";
          object_model: Json;
          active_preset: string | null;
          thumbnail_svg: string | null;
          latest_tikz_code: string | null;
          latest_lint_score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          owner_id: string;
          name: string;
          description?: string | null;
          diagram_type: "geometry" | "physics" | "calculus" | "custom";
          object_model: Json;
          active_preset?: string | null;
          thumbnail_svg?: string | null;
          latest_tikz_code?: string | null;
          latest_lint_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          diagram_type?: "geometry" | "physics" | "calculus" | "custom";
          object_model?: Json;
          active_preset?: string | null;
          thumbnail_svg?: string | null;
          latest_tikz_code?: string | null;
          latest_lint_score?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      diagram_versions: {
        Row: {
          id: string;
          diagram_id: string;
          owner_id: string;
          version_number: number;
          object_model: Json;
          tikz_code: string | null;
          linter_score: number | null;
          lint_results: Json;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          diagram_id: string;
          owner_id: string;
          version_number: number;
          object_model: Json;
          tikz_code?: string | null;
          linter_score?: number | null;
          lint_results?: Json;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          notes?: string | null;
          tikz_code?: string | null;
          linter_score?: number | null;
          lint_results?: Json;
        };
        Relationships: [];
      };
      style_presets: {
        Row: {
          id: string;
          owner_id: string | null;
          name: string;
          category: "olympiad" | "physics" | "paper" | "beamer" | "teaching" | "custom";
          config: Json;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          name: string;
          category: "olympiad" | "physics" | "paper" | "beamer" | "teaching" | "custom";
          config: Json;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          category?: "olympiad" | "physics" | "paper" | "beamer" | "teaching" | "custom";
          config?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      lint_runs: {
        Row: {
          id: string;
          diagram_id: string;
          owner_id: string;
          score: number;
          grade: "A" | "B" | "C" | "D";
          findings: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          diagram_id: string;
          owner_id: string;
          score: number;
          grade: "A" | "B" | "C" | "D";
          findings?: Json;
          created_at?: string;
        };
        Update: {
          findings?: Json;
          score?: number;
          grade?: "A" | "B" | "C" | "D";
        };
        Relationships: [];
      };
      export_history: {
        Row: {
          id: string;
          diagram_id: string;
          owner_id: string;
          export_format: "tikz" | "tex" | "pgfplots";
          tikz_code: string;
          required_packages: string[];
          is_grayscale_safe: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          diagram_id: string;
          owner_id: string;
          export_format: "tikz" | "tex" | "pgfplots";
          tikz_code: string;
          required_packages?: string[];
          is_grayscale_safe?: boolean;
          created_at?: string;
        };
        Update: {
          tikz_code?: string;
          required_packages?: string[];
          is_grayscale_safe?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];
