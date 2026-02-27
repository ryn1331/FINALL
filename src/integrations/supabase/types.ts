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
      cancer_cases: {
        Row: {
          alcool: string | null
          anomalies_moleculaires: string | null
          base_diagnostic: string | null
          biologie_date: string | null
          biologie_fns: string | null
          biologie_globules: string | null
          cause_deces: string | null
          code_icdo: string | null
          comportement: string | null
          created_at: string
          created_by: string | null
          date_anapath: string | null
          date_deces: string | null
          date_derniere_nouvelle: string | null
          date_diagnostic: string
          grade: string | null
          id: string
          lateralite: string | null
          medecin_anapath: string | null
          methode_diagnostic: string | null
          milieu: string | null
          morphologie_icdo: string | null
          notes: string | null
          patient_id: string
          profession: string | null
          ref_anapath: string | null
          resultat_anapath: string | null
          source_info: string | null
          sous_type_cancer: string | null
          sportif: string | null
          stade_tnm: string | null
          statut: string
          statut_vital: string | null
          symptomes: string | null
          tabagisme: string | null
          topographie_icdo: string | null
          type_cancer: string
          updated_at: string
        }
        Insert: {
          alcool?: string | null
          anomalies_moleculaires?: string | null
          base_diagnostic?: string | null
          biologie_date?: string | null
          biologie_fns?: string | null
          biologie_globules?: string | null
          cause_deces?: string | null
          code_icdo?: string | null
          comportement?: string | null
          created_at?: string
          created_by?: string | null
          date_anapath?: string | null
          date_deces?: string | null
          date_derniere_nouvelle?: string | null
          date_diagnostic: string
          grade?: string | null
          id?: string
          lateralite?: string | null
          medecin_anapath?: string | null
          methode_diagnostic?: string | null
          milieu?: string | null
          morphologie_icdo?: string | null
          notes?: string | null
          patient_id: string
          profession?: string | null
          ref_anapath?: string | null
          resultat_anapath?: string | null
          source_info?: string | null
          sous_type_cancer?: string | null
          sportif?: string | null
          stade_tnm?: string | null
          statut?: string
          statut_vital?: string | null
          symptomes?: string | null
          tabagisme?: string | null
          topographie_icdo?: string | null
          type_cancer: string
          updated_at?: string
        }
        Update: {
          alcool?: string | null
          anomalies_moleculaires?: string | null
          base_diagnostic?: string | null
          biologie_date?: string | null
          biologie_fns?: string | null
          biologie_globules?: string | null
          cause_deces?: string | null
          code_icdo?: string | null
          comportement?: string | null
          created_at?: string
          created_by?: string | null
          date_anapath?: string | null
          date_deces?: string | null
          date_derniere_nouvelle?: string | null
          date_diagnostic?: string
          grade?: string | null
          id?: string
          lateralite?: string | null
          medecin_anapath?: string | null
          methode_diagnostic?: string | null
          milieu?: string | null
          morphologie_icdo?: string | null
          notes?: string | null
          patient_id?: string
          profession?: string | null
          ref_anapath?: string | null
          resultat_anapath?: string | null
          source_info?: string | null
          sous_type_cancer?: string | null
          sportif?: string | null
          stade_tnm?: string | null
          statut?: string
          statut_vital?: string | null
          symptomes?: string | null
          tabagisme?: string | null
          topographie_icdo?: string | null
          type_cancer?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancer_cases_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      cancer_rechutes: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          date_evenement: string
          description: string | null
          id: string
          localisation: string | null
          stade_tnm: string | null
          traitement_propose: string | null
          type_evenement: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          date_evenement: string
          description?: string | null
          id?: string
          localisation?: string | null
          stade_tnm?: string | null
          traitement_propose?: string | null
          type_evenement?: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          date_evenement?: string
          description?: string | null
          id?: string
          localisation?: string | null
          stade_tnm?: string | null
          traitement_propose?: string | null
          type_evenement?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancer_rechutes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cancer_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_comments: {
        Row: {
          case_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          case_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          case_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_comments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cancer_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_files: {
        Row: {
          case_id: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          mime_type: string | null
          notes: string | null
          patient_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          file_type?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          patient_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          patient_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cancer_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_files_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          adresse: string | null
          code_patient: string
          commune: string | null
          created_at: string
          created_by: string | null
          date_naissance: string | null
          id: string
          nom: string
          num_dossier: string | null
          prenom: string
          sexe: string
          telephone: string | null
          updated_at: string
          wilaya: string
        }
        Insert: {
          adresse?: string | null
          code_patient: string
          commune?: string | null
          created_at?: string
          created_by?: string | null
          date_naissance?: string | null
          id?: string
          nom: string
          num_dossier?: string | null
          prenom: string
          sexe: string
          telephone?: string | null
          updated_at?: string
          wilaya?: string
        }
        Update: {
          adresse?: string | null
          code_patient?: string
          commune?: string | null
          created_at?: string
          created_by?: string | null
          date_naissance?: string | null
          id?: string
          nom?: string
          num_dossier?: string | null
          prenom?: string
          sexe?: string
          telephone?: string | null
          updated_at?: string
          wilaya?: string
        }
        Relationships: []
      }
      population_reference: {
        Row: {
          annee: number
          created_at: string
          id: string
          population: number
          sexe: string
          tranche_age: string
          wilaya: string
        }
        Insert: {
          annee: number
          created_at?: string
          id?: string
          population?: number
          sexe: string
          tranche_age: string
          wilaya?: string
        }
        Update: {
          annee?: number
          created_at?: string
          id?: string
          population?: number
          sexe?: string
          tranche_age?: string
          wilaya?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          service: string | null
          specialite: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id?: string
          service?: string | null
          specialite?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          service?: string | null
          specialite?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rendez_vous: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string | null
          date_rdv: string
          duree_minutes: number
          id: string
          lieu: string | null
          medecin: string | null
          notes: string | null
          patient_id: string
          rappel_envoye: boolean
          statut: string
          titre: string
          type_rdv: string
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          date_rdv: string
          duree_minutes?: number
          id?: string
          lieu?: string | null
          medecin?: string | null
          notes?: string | null
          patient_id: string
          rappel_envoye?: boolean
          statut?: string
          titre: string
          type_rdv?: string
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          date_rdv?: string
          duree_minutes?: number
          id?: string
          lieu?: string | null
          medecin?: string | null
          notes?: string | null
          patient_id?: string
          rappel_envoye?: boolean
          statut?: string
          titre?: string
          type_rdv?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rendez_vous_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cancer_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendez_vous_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      traitements: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          date_debut: string
          date_fin: string | null
          effets_secondaires: string | null
          efficacite: string | null
          id: string
          medecin_traitant: string | null
          notes: string | null
          protocole: string | null
          type_traitement: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          date_debut: string
          date_fin?: string | null
          effets_secondaires?: string | null
          efficacite?: string | null
          id?: string
          medecin_traitant?: string | null
          notes?: string | null
          protocole?: string | null
          type_traitement: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          date_debut?: string
          date_fin?: string | null
          effets_secondaires?: string | null
          efficacite?: string | null
          id?: string
          medecin_traitant?: string | null
          notes?: string | null
          protocole?: string | null
          type_traitement?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traitements_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cancer_cases"
            referencedColumns: ["id"]
          },
        ]
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
      app_role:
        | "admin"
        | "medecin"
        | "epidemiologiste"
        | "anapath"
        | "assistante"
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
        "medecin",
        "epidemiologiste",
        "anapath",
        "assistante",
      ],
    },
  },
} as const
