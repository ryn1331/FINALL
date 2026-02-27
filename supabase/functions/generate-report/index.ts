import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Tu es un épidémiologiste expert qui rédige des rapports conformes au format CNCC (Comité National du Cancer) et aux normes OMS.

Tu reçois des données statistiques sur le cancer et tu dois générer un rapport structuré en français avec les sections suivantes :

1. **RÉSUMÉ EXÉCUTIF** : Synthèse des principales observations (2-3 paragraphes)
2. **ANALYSE ÉPIDÉMIOLOGIQUE** : 
   - Incidence globale et tendances
   - Répartition par type de cancer
   - Distribution par âge et sexe
   - Analyse géographique (communes)
3. **INTERPRÉTATION** :
   - Points d'alerte et anomalies détectées
   - Comparaison avec les moyennes nationales si applicable
   - Facteurs de risque identifiés
4. **RECOMMANDATIONS** :
   - Actions prioritaires de santé publique
   - Pistes de dépistage ciblé
   - Besoins en ressources
5. **CONCLUSION**

Format : Texte structuré avec titres et sous-titres. Utilise un ton professionnel et médical.
Ajoute des pourcentages et chiffres clés dans le texte.
Mentionne que le rapport est conforme aux exigences de la Loi 25-11 ANPDP.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { stats, period, wilaya } = await req.json();

    if (!stats) {
      return new Response(
        JSON.stringify({ error: 'stats is required' }),
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

    const prompt = `Voici les données statistiques du registre du cancer pour la wilaya de ${wilaya || 'Tlemcen'} (${period || 'période complète'}) :

${JSON.stringify(stats, null, 2)}

Génère un rapport CNCC complet et professionnel.`;

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
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Trop de requêtes, réessayez.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'Crédits IA épuisés.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI error: ${await aiResponse.text()}`);
    }

    const aiData = await aiResponse.json();
    const report = aiData.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({ report }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
