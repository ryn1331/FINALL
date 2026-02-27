import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Tu es un expert en extraction de données à partir de rapports d'anatomopathologie en oncologie.
Tu reçois le texte extrait d'un PDF de rapport anapath. Extrais les informations suivantes et retourne un JSON :

{
  "medecinAnapath": "string ou null (nom du médecin anatomopathologiste)",
  "dateAnapath": "string (YYYY-MM-DD) ou null",
  "refAnapath": "string ou null (référence/numéro du rapport)",
  "typeCancer": "string ou null (type de cancer identifié)",
  "sousTypeCancer": "string ou null (sous-type histologique: adénocarcinome, carcinome épidermoïde, etc.)",
  "anomaliesMoleculaires": "string ou null (EGFR, ALK, KRAS, HER2, BRAF, PDL1, MSI, etc.)",
  "resultatAnapath": "string ou null (résumé concis du résultat)",
  "stadePathologique": "string ou null (pTNM si mentionné)",
  "grade": "string ou null (grade histologique si mentionné)",
  "marges": "string ou null (marges chirurgicales si mentionnées)"
}

Règles :
1. Normalise les types de cancer vers : Poumon, Colorectal, Sein, Prostate, Vessie, Estomac, Foie, Pancréas, Rein, Thyroïde, Leucémie, Lymphome, Mélanome, Col utérin, Ovaire, Cavité buccale, Larynx, Œsophage, Cerveau/SNC, Sarcome, Myélome, Autre.
2. Extrais TOUTES les anomalies moléculaires mentionnées, séparées par virgules.
3. Pour le résultat, fais un résumé concis et médical.
4. Si une info n'est pas dans le texte, mets null.
5. Retourne UNIQUEMENT le JSON, sans markdown.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('AI_API_KEY');
    const aiEndpoint = Deno.env.get('AI_CHAT_COMPLETIONS_URL') || 'https://api.openai.com/v1/chat/completions';
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await fetch(aiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Voici le texte extrait d'un rapport d'anatomopathologie :\n\n${text}\n\nExtrais les données en JSON.` },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Trop de requêtes, réessayez dans quelques instants.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'Crédits IA épuisés.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const errText = await aiResponse.text();
      throw new Error(`AI error: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    const parsed = JSON.parse(jsonStr);

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
