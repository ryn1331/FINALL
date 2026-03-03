import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, currentForm } = await req.json();
    if (!transcript) throw new Error("No transcript provided");

    const apiKey = Deno.env.get("MISTRAL_API_KEY") || Deno.env.get("AI_API_KEY");
    const aiEndpoint = "https://api.mistral.ai/v1/chat/completions";
    if (!apiKey) throw new Error("MISTRAL_API_KEY not configured — ajoutez-la dans les secrets Supabase");

    const systemPrompt = `Tu es un assistant médical intelligent pour un registre du cancer au CHU Tlemcen, Algérie.
L'utilisateur dicte des informations sur un patient atteint de cancer. Tu dois extraire les champs pertinents depuis la transcription vocale.

Voici les champs possibles avec leur clé JSON :
- nom: Nom de famille du patient
- prenom: Prénom du patient
- dateNaissance: Date de naissance (format YYYY-MM-DD)
- sexe: "M" ou "F"
- telephone: Numéro de téléphone
- numDossier: Numéro de dossier
- commune: Commune de résidence (parmi: Tlemcen, Mansourah, Chetouane, Remchi, Ghazaouet, Maghnia, Sebdou, Hennaya, Nedroma, Beni Snous, Ouled Mimoun, Ain Tallout, Bab El Assa, Honaine)
- milieu: "urbain", "rural" ou "semi-urbain"
- profession: Profession du patient
- typeCancer: Type de cancer (parmi: Poumon, Colorectal, Sein, Prostate, Vessie, Estomac, Foie, Pancréas, Rein, Thyroïde, Leucémie, Lymphome, Mélanome, Col utérin, Ovaire, Cavité buccale, Larynx, Œsophage, Cerveau/SNC, Sarcome, Myélome, Autre)
- dateDiagnostic: Date du diagnostic (format YYYY-MM-DD)
- sourceInfo: Source d'information
- stadeTnm: Stade TNM (ex: T2N1M0)
- symptomes: Description des symptômes
- notes: Notes complémentaires
- resultatAnapath: Résultat histologique / anatomopathologique
- medecinAnapath: Nom du médecin pathologiste
- tabagisme: "oui", "non" ou "ancien"
- alcool: "oui", "non" ou "ancien"
- statutVital: "vivant", "decede" ou "perdu_de_vue"

Règles :
- Ne retourne QUE les champs que tu as pu identifier dans la transcription
- Sois intelligent : "Boudjemaa" est un nom, "Mohamed" est un prénom, "homme" → sexe "M", "femme" → sexe "F"
- Pour les dates relatives ("né en 1965"), calcule la date approximative
- Pour le darija/arabe : "rajel" → M, "mra" → F, "soukkar" → diabète (note), etc.
- Retourne UNIQUEMENT un objet JSON valide, sans explication
- Si un champ du formulaire est déjà rempli (fourni dans currentForm), ne le remplace PAS sauf si la transcription contient clairement une correction`;

    const userMessage = `Transcription vocale : "${transcript}"

Champs déjà remplis : ${JSON.stringify(currentForm || {})}

Extrais les champs et retourne uniquement le JSON.`;

    const response = await fetch(aiEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-large-latest",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI service error: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    
    // Extract JSON from response (might be wrapped in ```json ... ```)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const fields = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return new Response(JSON.stringify({ fields }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
