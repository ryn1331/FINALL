import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { case_id, action, webhook_url } = await req.json();

    if (!case_id || !action) {
      return new Response(JSON.stringify({ error: "case_id et action requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update case status
    const newStatus = action === "valider" ? "valide" : action === "rejeter" ? "rejete" : null;
    if (!newStatus) {
      return new Response(JSON.stringify({ error: "Action invalide. Utilisez 'valider' ou 'rejeter'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: caseData, error: caseError } = await supabase
      .from("cancer_cases")
      .update({ statut: newStatus })
      .eq("id", case_id)
      .select("*, patients(nom, prenom, sexe, commune, date_naissance)")
      .single();

    if (caseError) {
      return new Response(JSON.stringify({ error: caseError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If webhook_url is provided, forward to n8n
    let webhookResponse = null;
    if (webhook_url) {
      try {
        const payload = {
          event: "case_validation",
          action: newStatus,
          timestamp: new Date().toISOString(),
          case: {
            id: caseData.id,
            type_cancer: caseData.type_cancer,
            code_icdo: caseData.code_icdo,
            stade_tnm: caseData.stade_tnm,
            date_diagnostic: caseData.date_diagnostic,
            resultat_anapath: caseData.resultat_anapath,
            statut: newStatus,
            notes: caseData.notes,
          },
          patient: {
            nom: caseData.patients?.nom,
            prenom: caseData.patients?.prenom,
            sexe: caseData.patients?.sexe,
            commune: caseData.patients?.commune,
            date_naissance: caseData.patients?.date_naissance,
          },
        };

        const n8nRes = await fetch(webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        webhookResponse = {
          status: n8nRes.status,
          ok: n8nRes.ok,
        };
      } catch (webhookErr: any) {
        webhookResponse = { error: webhookErr.message };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        case: caseData,
        webhook: webhookResponse,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
