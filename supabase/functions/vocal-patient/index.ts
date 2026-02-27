import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const currentYear = new Date().getFullYear();

const SYSTEM_PROMPT = `Tu es un assistant médical expert en extraction de données patient à partir de dictées vocales en milieu hospitalier algérien.
Tu comprends parfaitement :
- Le français standard et médical
- L'arabe dialectal algérien (darija) écrit en lettres latines ou arabes
- Le mélange français/darija courant en Algérie (ex: "had lpatient", "3andou", "mrid b", "sakan f")
- Le langage naturel et informel des médecins qui dictent rapidement avec hésitations

Tu dois extraire TOUTES les informations mentionnées et retourner ce JSON :

{
  "nom": "string ou null",
  "prenom": "string ou null",
  "dateNaissance": "string (YYYY-MM-DD) ou null",
  "sexe": "string (M ou F) ou null",
  "commune": "string ou null",
  "telephone": "string ou null",
  "numDossier": "string ou null",
  "typeCancer": "string ou null",
  "sousTypeCancer": "string ou null",
  "codeIcdo": "string ou null",
  "stadeTnm": "string (TxNxMx) ou null",
  "stadeChiffre": "string (I/II/III/IV) ou null",
  "anomaliesMoleculaires": "string ou null",
  "dateDiagnostic": "string (YYYY-MM-DD) ou null",
  "medecinAnapath": "string ou null",
  "dateAnapath": "string (YYYY-MM-DD) ou null",
  "refAnapath": "string ou null",
  "resultatAnapath": "string ou null",
  "biologieFns": "string ou null",
  "biologieGlobules": "string ou null",
  "biologieDate": "string (YYYY-MM-DD) ou null",
  "tabagisme": "string (non/oui/ancien) ou null",
  "tabagismeAnnees": "string ou null",
  "alcool": "string (non/oui/ancien) ou null",
  "sportif": "string (non/oui/occasionnel) ou null",
  "symptomes": "string ou null",
  "notes": "string ou null"
}

Règles CRITIQUES :

1. CALCUL DE L'ÂGE : Si le médecin dit un âge (ex: "58 ans", "3andou 58 sna"), calcule : ${currentYear} - âge = année de naissance, 1er janvier par défaut. Ex: "58 ans" → "${currentYear - 58}-01-01"

2. SEXE : Déduis du prénom si non explicite. Prénoms masculins courants : Mohamed, Ahmed, Rayane, Youcef, Karim, Ali, Omar, Rachid, Samir, Abdelkader, Noureddine, Amine, Bilal, Zakaria, Mustapha, Sofiane, Walid, Farid, Redouane, Mourad, Djamel, Hamza, Nadir, Toufik. Prénoms féminins : Fatima, Amina, Khadija, Meriem, Sarah, Yasmine, Nadia, Samira, Leila, Houria, Djamila, Wafa, Imane, Asma, Amel, Nawal, Soumia, Lamia, Rania, Kheira, Aicha, Wahiba, Nassima. "Rajel/راجل" = M, "Mra/مرا" = F.

3. COMMUNES DE TLEMCEN : Normalise vers : Tlemcen, Mansourah, Chetouane, Remchi, Ghazaouet, Maghnia, Sebdou, Hennaya, Nedroma, Beni Snous, Ouled Mimoun, Ain Tallout, Bab El Assa, Honaine. Comprends les variantes darija (ex: "Tremcen"→"Tlemcen", "sakan f Maghnia"→"Maghnia", "men Remchi"→"Remchi").

4. TYPE DE CANCER : Normalise vers : Poumon, Colorectal, Sein, Prostate, Vessie, Estomac, Foie, Pancréas, Rein, Thyroïde, Leucémie, Lymphome, Mélanome, Col utérin, Ovaire, Cavité buccale, Larynx, Œsophage, Cerveau/SNC, Sarcome, Myélome, Autre. Comprends : "cancer dial ri2a/الرئة"→Poumon, "cancer del ma3da"→Estomac, "sratane"→cancer, "cancer dyal ssder"→Sein, "cancer du colon/côlon"→Colorectal, "cancer de la gorge"→Larynx, "cancer du sang"→Leucémie.

5. SOUS-TYPE : Extrais le sous-type histologique si mentionné : adénocarcinome, carcinome épidermoïde, carcinome à petites cellules, carcinome canalaire, carcinome lobulaire, etc.

6. STADE TNM : "T2N1M0"→stadeTnm="T2N1M0". Si le médecin dit juste un stade chiffré (I, II, III, IV, 1, 2, 3, 4), mets-le dans stadeChiffre (en chiffres romains). "stade 2"→stadeChiffre="II", "stade avancé"→stadeChiffre="IV".

7. ANOMALIES MOLÉCULAIRES : EGFR, ALK, KRAS, HER2, BRAF, ROS1, PDL1, MSI, etc. Sépare par virgules.

8. BIOLOGIE : "FNS normale"→biologieFns="Normale", "globules blancs 12000"→biologieGlobules="GB: 12000", "hémoglobine 10"→biologieFns="Hb: 10 g/dL".

9. MODE DE VIE : "fumeur"/"yedakhane"→tabagisme="oui", "fumeur depuis 20 ans"→tabagisme="oui", tabagismeAnnees="20", "ma ycherb-ch"→alcool="non", "ydir sport"→sportif="oui".

10. TÉLÉPHONE : Extrais et normalise. "numéro 05 55 12 34 56"→telephone="0555123456".

11. N° DOSSIER : "dossier numéro 2024-456"→numDossier="2024-456".

12. MÉDECIN ANAPATH : "résultats de docteur Benmansour"→medecinAnapath="Dr. Benmansour", "anapath de Benali"→medecinAnapath="Dr. Benali".

13. LANGAGE NATUREL : Ignore les hésitations ("bon", "euh", "alors", "donc", "voilà", "comment dire"). Ex: "bon le patient s'appelle Rayane Karaslimane" → nom="Karaslimane", prenom="Rayane".

14. DICTÉE PARTIELLE : Si certaines infos manquent, mets null. Ne déduis JAMAIS un type de cancer ou diagnostic non explicitement mentionné.

15. DATE DIAGNOSTIC : "aujourd'hui"/"lyoum" → "${new Date().toISOString().split('T')[0]}". "le mois dernier" → calcule approximativement.

16. SYMPTÔMES : Extrais et combine tous les symptômes mentionnés : "toux", "douleur thoracique", "amaigrissement", "dyspnée", "hémoptysie", "3andou so3al w wja3 f ssder"→"Toux, douleur thoracique".

17. Retourne UNIQUEMENT le JSON, sans texte autour, sans markdown, sans explication.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { transcription } = await req.json();

    if (!transcription) {
      return new Response(
        JSON.stringify({ error: 'transcription is required' }),
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
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Voici la dictée vocale d'un médecin :\n\n"${transcription}"\n\nExtrais les données patient en JSON.` },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI service error: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

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
