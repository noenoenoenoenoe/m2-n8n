const modele_Generation = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', version: 1.2, config: { name: 'Modele Generation', parameters: { modelName: 'models/gemini-flash-lite-latest', options: { temperature: 0.2 } }, credentials: { googlePalmApi: newCredential('Troov CS autom (compte)', 'CREDENTIAL_ID') }, position: [2640, 112] } });

const pOST_rag_piketty_v3_ask = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'POST /rag-piketty-v3-ask', parameters: { httpMethod: 'POST', path: 'rag-piketty-v3-ask', responseMode: 'streaming', options: { allowedOrigins: '*' } }, position: [0, -48], webhookId: 'rag-piketty-v3-ask', notes: 'Trigger : POST { sessionId, chatInput } → réponse en flux (lignes JSON begin / item / end)', notesInFlow: true }
});

const configuration = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: { name: 'Configuration', parameters: { assignments: { assignments: [{ id: 'cfg-0', name: 'sessionId', value: expr('{{ $json.body.sessionId }}'), type: 'string' }, { id: 'cfg-1', name: 'question', value: expr('{{ $json.body.chatInput }}'), type: 'string' }, { id: 'cfg-2', name: 'topKCandidats', value: 20, type: 'number' }, { id: 'cfg-3', name: 'topKFinal', value: 5, type: 'number' }, { id: 'cfg-4', name: 'poidsVecteurs', value: 0.5, type: 'number' }, { id: 'cfg-5', name: 'modele', value: 'gemini-flash-lite-latest', type: 'string' }, { id: 'cfg-6', name: 't0', value: expr('{{ Date.now() }}'), type: 'number' }] }, options: {} }, position: [224, -48], notes: '1. Contexte : réglages (topK, poids, modèle) réunis ici.', notesInFlow: true }
});

const historique = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: { name: 'Historique', parameters: { operation: 'executeQuery', query: 'SELECT coalesce(json_agg(json_build_object(\'role\', role, \'contenu\', contenu) ORDER BY id), \'[]\'::json) AS historique\nFROM (SELECT id, role, contenu FROM rag_piketty_v3_chat WHERE session_id = $1 ORDER BY id DESC LIMIT 10) t;', options: { queryReplacement: expr('{{ [ $json.sessionId ] }}') } }, credentials: { postgres: newCredential('Supabase Postgres', 'CREDENTIAL_ID') }, position: [448, -48], notes: '1. Contexte : 10 derniers messages de la session (toujours une ligne, même vide).', notesInFlow: true }
});

const assembler_Contexte = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: { name: 'Assembler Contexte', parameters: { assignments: { assignments: [{ id: 'ctx-0', name: 'sessionId', value: expr('{{ $(\'Configuration\').item.json.sessionId }}'), type: 'string' }, { id: 'ctx-1', name: 'question', value: expr('{{ $(\'Configuration\').item.json.question }}'), type: 'string' }, { id: 'ctx-2', name: 'topKCandidats', value: expr('{{ $(\'Configuration\').item.json.topKCandidats }}'), type: 'number' }, { id: 'ctx-3', name: 'topKFinal', value: expr('{{ $(\'Configuration\').item.json.topKFinal }}'), type: 'number' }, { id: 'ctx-4', name: 'poidsVecteurs', value: expr('{{ $(\'Configuration\').item.json.poidsVecteurs }}'), type: 'number' }, { id: 'ctx-5', name: 'modele', value: expr('{{ $(\'Configuration\').item.json.modele }}'), type: 'string' }, { id: 'ctx-6', name: 't0', value: expr('{{ $(\'Configuration\').item.json.t0 }}'), type: 'number' }, { id: 'ctx-7', name: 'historique_texte', value: expr('{{ ($json.historique || []).length ? $json.historique.map(m => (m.role === \'user\' ? \'Utilisateur : \' : \'Assistant : \') + String(m.contenu).slice(0, 1500)).join(\'\\n\') : \'(aucun)\' }}'), type: 'string' }, { id: 'ctx-8', name: 't_contexte', value: expr('{{ Date.now() }}'), type: 'number' }] }, options: {} }, position: [656, -48], notes: 'Met l\'historique sous forme de texte pour les modèles (nœud Set : évite le démarrage du moteur de code).', notesInFlow: true }
});

const routing = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: { name: 'Routing', parameters: { method: 'POST', url: expr('https://generativelanguage.googleapis.com/v1beta/models/{{ $(\'Configuration\').item.json.modele }}:generateContent'), authentication: 'predefinedCredentialType', nodeCredentialType: 'googlePalmApi', sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ systemInstruction: { parts: [{ text: "Tu es le module de routage d\'un assistant qui répond à des questions sur le livre « Le Capital au XXIe siècle » de Thomas Piketty.\\nÀ partir de l\'historique de la conversation et du dernier message, renvoie un JSON :\\n- type : « salutation » (bonjour, merci, au revoir…), « hors_sujet » (question clairement sans lien avec l\'économie, le capital, les inégalités, l\'histoire économique ou le livre), sinon « livre ». En cas de doute, « livre ».\\n- requete : la question réécrite pour être compréhensible seule, sans l\'historique (ex. « Et aux États-Unis ? » après une question sur r > g devient « r > g et inégalités aux États-Unis selon Piketty »).\\n- mots_cles : 2 à 6 mots-clés ou expressions courtes, tels que le livre les emploierait (ex. « première loi fondamentale », « esclavage », « croissance démographique »).\\n- Écris requete et mots_cles en français correct, AVEC tous les accents (ex. « inégalités », « États-Unis », « démographique ») : la recherche par mots-clés ne trouve rien sans les accents.\\n- partie / chapitre : seulement si le message cite explicitement une partie ou un chapitre du livre (ex. « chapitre 4 »), sinon chaîne vide." }] }, contents: [{ role: \'user\', parts: [{ text: \'Historique :\\n\' + $json.historique_texte + \'\\n\\nDernier message : \' + $json.question }] }], generationConfig: { temperature: 0, responseMimeType: \'application/json\', responseSchema: {"type": "OBJECT", "properties": {"type": {"type": "STRING", "enum": ["livre", "salutation", "hors_sujet"]}, "requete": {"type": "STRING"}, "mots_cles": {"type": "ARRAY", "items": {"type": "STRING"} }, "partie": {"type": "STRING"}, "chapitre": {"type": "STRING"} }, "required": ["type", "requete", "mots_cles", "partie", "chapitre"]} } }) }}'), options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 5000 } }, credentials: { googlePalmApi: newCredential('Troov CS autom (compte)', 'CREDENTIAL_ID') }, position: [864, -48], notes: '2. Routing : type, requête autonome, mots-clés, filtres (JSON imposé).', notesInFlow: true, onError: 'continueRegularOutput' }
});

const lire_Routing = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: { name: 'Lire Routing', parameters: { mode: 'raw', jsonOutput: expr('{{ (() => { const ctx = $(\'Assembler Contexte\').item.json;\nconst body = $json.body ?? $json;\nlet r = null;\ntry { r = JSON.parse(body.candidates[0].content.parts[0].text); } catch (e) { r = null; }\nconst repli = !r || ![\'livre\', \'salutation\', \'hors_sujet\'].includes(r.type);\nif (repli) r = { type: \'livre\', requete: ctx.question, mots_cles: [], partie: \'\', chapitre: \'\' };\nconst cite = /\\b(chapitre|partie)\\b/i.test(ctx.question);\nconst mots = (Array.isArray(r.mots_cles) ? r.mots_cles : []).map((m) => String(m).replace(/["()]/g, \' \').trim()).filter(Boolean);\nreturn { ...ctx, type: r.type, requete: String(r.requete || ctx.question), mots_cles: mots,\n  requete_mots_cles: mots.length ? mots.join(\' or \') : String(r.requete || ctx.question),\n  partie: cite ? String(r.partie || \'\') : \'\', chapitre: cite ? String(r.chapitre || \'\') : \'\',\n  routing_repli: repli, routing_erreur: body.error ? String(body.error.message || body.error).slice(0, 200) : ($json.error ? String($json.error.message || $json.error).slice(0, 200) : null), t_routing: Date.now() }; })() }}'), options: {} }, position: [1088, -48], notes: 'Repli : question brute, type livre.', notesInFlow: true }
});

const type_Livre = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: { name: 'Type Livre', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 1 }, conditions: [{ id: 'type-livre', leftValue: expr('{{ $json.type }}'), rightValue: 'livre', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, options: {} }, position: [1312, -48] }
});

const embedding_Requete = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: { name: 'Embedding Requete', parameters: { method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent', authentication: 'predefinedCredentialType', nodeCredentialType: 'googlePalmApi', sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ model: \'models/gemini-embedding-2\', content: { parts: [{ text: $json.requete }] }, taskType: \'RETRIEVAL_QUERY\' }) }}'), options: {} }, credentials: { googlePalmApi: newCredential('Troov CS autom (compte)', 'CREDENTIAL_ID') }, position: [1520, -128], notes: '3. Recherche : vecteur de la requête (RETRIEVAL_QUERY).', notesInFlow: true, retryOnFail: true, maxTries: 2, waitBetweenTries: 2000 }
});

const recherche_Hybride = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: { name: 'Recherche Hybride', parameters: { operation: 'executeQuery', query: 'WITH q AS (\n  SELECT $1::vector AS v, websearch_to_tsquery(\'french\', $2) AS tq\n),\nvec AS (\n  SELECT c.id, row_number() OVER (ORDER BY c.embedding <=> q.v) AS r\n  FROM rag_piketty_v2_chunks c, q\n  WHERE ($5 = \'\' OR c.metadata->>\'partie\' ILIKE \'%\' || $5 || \'%\')\n    AND ($6 = \'\' OR c.metadata->>\'chapitre\' ILIKE \'%\' || $6 || \'%\')\n  ORDER BY c.embedding <=> q.v\n  LIMIT $4::int\n),\nkw AS (\n  SELECT c.id, row_number() OVER (ORDER BY ts_rank(c.mots_cles, q.tq) DESC) AS r\n  FROM rag_piketty_v2_chunks c, q\n  WHERE c.mots_cles @@ q.tq\n    AND ($5 = \'\' OR c.metadata->>\'partie\' ILIKE \'%\' || $5 || \'%\')\n    AND ($6 = \'\' OR c.metadata->>\'chapitre\' ILIKE \'%\' || $6 || \'%\')\n  ORDER BY ts_rank(c.mots_cles, q.tq) DESC\n  LIMIT $4::int\n),\nfusion AS (\n  SELECT coalesce(vec.id, kw.id) AS id,\n         coalesce($3::float / (60 + vec.r), 0) + coalesce((1 - $3::float) / (60 + kw.r), 0) AS score,\n         vec.r AS rang_vecteur, kw.r AS rang_mots_cles\n  FROM vec FULL OUTER JOIN kw ON vec.id = kw.id\n)\nSELECT f.id, c.metadata->>\'section\' AS section, c.metadata->>\'chapitre\' AS chapitre, c.metadata->>\'page\' AS page,\n       round(f.score::numeric, 5) AS score, f.rang_vecteur, f.rang_mots_cles, c.chunk\nFROM fusion f JOIN rag_piketty_v2_chunks c ON c.id = f.id\nORDER BY f.score DESC\nLIMIT $4::int;\n', options: { queryReplacement: expr('{{ [ \'[\' + $json.embedding.values.join(\',\') + \']\', $(\'Lire Routing\').item.json.requete_mots_cles, $(\'Lire Routing\').item.json.poidsVecteurs, $(\'Lire Routing\').item.json.topKCandidats, $(\'Lire Routing\').item.json.partie, $(\'Lire Routing\').item.json.chapitre ] }}') } }, credentials: { postgres: newCredential('Supabase Postgres', 'CREDENTIAL_ID') }, position: [1728, -128], notes: '3. Recherche hybride : vecteurs + mots-clés, fusion des rangs pondérée (0,5 / 0,5), 20 candidats.', notesInFlow: true, alwaysOutputData: true }
});

const preparer_Reranking = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: { name: 'Preparer Reranking', parameters: { mode: 'raw', jsonOutput: expr('{{ (() => { const r = $(\'Lire Routing\').item.json;\nconst cands = $input.all().map((i) => i.json).filter((c) => c.id);\nconst candidats_texte = cands.map((c, k) => `[${c.id}] Section : ${c.section} (p. ${c.page})\\n${String(c.chunk).replace(/^Partie :[^\\n]*\\nChapitre :[^\\n]*\\nSection :[^\\n]*\\n\\n/, \'\').slice(0, 1500)}`).join(\'\\n\\n---\\n\\n\');\nreturn { ...r, candidats: cands, candidats_texte, t_recherche: Date.now() }; })() }}'), options: {} }, position: [1952, -128], notes: 'Regroupe les 20 candidats et prépare leur texte (1 500 car. chacun) pour le reranking.', notesInFlow: true, executeOnce: true }
});

const reranking = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: { name: 'Reranking', parameters: { method: 'POST', url: expr('https://generativelanguage.googleapis.com/v1beta/models/{{ $(\'Configuration\').item.json.modele }}:generateContent'), authentication: 'predefinedCredentialType', nodeCredentialType: 'googlePalmApi', sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ systemInstruction: { parts: [{ text: "Tu sélectionnes les extraits du livre « Le Capital au XXIe siècle » les plus utiles pour répondre à une question.\\nRenvoie UNIQUEMENT les identifiants des 5 extraits les plus pertinents, du plus utile au moins utile. N\'inclus pas un extrait sans rapport avec la question (renvoie alors moins de 5 identifiants)." }] }, contents: [{ role: \'user\', parts: [{ text: \'Question : \' + $json.requete + \'\\n\\n\' + $json.candidats_texte }] }], generationConfig: { temperature: 0, maxOutputTokens: 200, responseMimeType: \'application/json\', responseSchema: {"type": "OBJECT", "properties": {"ids": {"type": "ARRAY", "items": {"type": "STRING"} } }, "required": ["ids"]} } }) }}'), options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 4000 } }, credentials: { googlePalmApi: newCredential('Troov CS autom (compte)', 'CREDENTIAL_ID') }, position: [2160, -128], notes: '4. Reranking : Gemini note chaque candidat (0-10).', notesInFlow: true, onError: 'continueRegularOutput' }
});

const lire_Reranking = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: { name: 'Lire Reranking', parameters: { mode: 'raw', jsonOutput: expr('{{ (() => { const p = $(\'Preparer Reranking\').item.json;\nconst body = $json.body ?? $json;\nconst topK = Number(p.topKFinal) || 5;\nlet ids = null;\ntry { ids = JSON.parse(body.candidates[0].content.parts[0].text).ids; } catch (e) { ids = null; }\nconst parId = Object.fromEntries((p.candidats || []).map((c) => [c.id, c]));\nlet retenus, repli = false;\nconst valides = Array.isArray(ids) ? [...new Set(ids)].filter((id) => parId[id]) : [];\nif (valides.length) { retenus = valides.slice(0, topK).map((id) => parId[id]); }\nelse { repli = true; retenus = (p.candidats || []).slice(0, topK); }\nconst contexte = retenus.map((c) => `[Extrait] Section : ${c.section} | Chapitre : ${c.chapitre} | pages : ${c.page}\\n${c.chunk}`).join(\'\\n\\n---\\n\\n\');\nreturn { ...p, candidats: undefined, candidats_texte: undefined, retenus: retenus.map((c) => ({ id: c.id, section: c.section, page: c.page })), contexte: contexte || \'(aucun extrait pertinent)\', rerank_repli: repli, t_reranking: Date.now() }; })() }}'), options: {} }, position: [2384, -128], notes: 'Garde les 5 meilleurs. Repli : ordre de la recherche.', notesInFlow: true }
});

const generation = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: { name: 'Generation', parameters: { promptType: 'define', text: expr('{{ \'Historique de la conversation :\\n\' + $json.historique_texte + \'\\n\\nExtraits du livre :\\n\' + $json.contexte + \'\\n\\nQuestion : \' + $json.question }}'), options: { systemMessage: '<role>\\nTu es un assistant spécialiste du livre « Le Capital au XXIe siècle » de Thomas Piketty (publié en 2013). Tu réponds en français, uniquement à partir des extraits du livre fournis.\\n</role>\\n\\n<citations>\\n- Appuie chaque affirmation sur un court extrait exact du livre entre guillemets français, suivi immédiatement des pages entre parenthèses, tirées du champ « pages » de l\'extrait. Exemple : Piketty montre que « les patrimoines issus du passé se recapitalisent plus vite que le rythme de progression de la production » (p. 63-64).\\n- N\'invente jamais un numéro de page ni une citation.\\n</citations>\\n\\n<special_cases>\\n- Si les extraits ne contiennent pas la réponse, réponds exactement : « Je ne trouve pas cette information dans le livre. » Ne confirme ni n\'infirme rien d\'autre.\\n- Si la question porte sur « aujourd\'hui » ou l\'actualité, réponds à partir du livre et précise que le livre date de 2013 et ne couvre pas la situation actuelle.\\n</special_cases>\\n\\n<output_format>\\n- Markdown simple : paragraphes courts, listes à puces, gras pour les notions clés.\\n- N\'utilise jamais de LaTeX ni de symbole $ : écris les formules en texte simple, par exemple r > g.\\n- Ne mentionne jamais les « extraits fournis », la recherche ni le fonctionnement interne : réponds comme quelqu\'un qui cite directement le livre.\\n</output_format>', maxIterations: 1, enableStreaming: true } }, position: [2640, -128], notes: '5. Génération en streaming (AI Agent sans outil, mêmes règles de citation).', notesInFlow: true, retryOnFail: true, maxTries: 2, waitBetweenTries: 500, subnodes: { model: modele_Generation } }
});

const enregistrer_Echange = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: { name: 'Enregistrer Echange', parameters: { operation: 'executeQuery', query: 'INSERT INTO rag_piketty_v3_chat (session_id, role, contenu) VALUES ($1, \'user\', $2), ($1, \'assistant\', $3) RETURNING id;', options: { queryReplacement: expr('{{ [ $(\'Lire Reranking\').item.json.sessionId, $(\'Lire Reranking\').item.json.question, $json.output ] }}') } }, credentials: { postgres: newCredential('Supabase Postgres', 'CREDENTIAL_ID') }, position: [2976, -128], notes: 'Historique : enregistré après la réponse (déjà envoyée en flux).', notesInFlow: true }
});

const reponse_Directe = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Reponse Directe', parameters: { respondWith: 'text', responseBody: expr('{{ $json.type === \'salutation\' ? "Bonjour ! Posez-moi une question sur « Le Capital au XXIe siècle » de Thomas Piketty : je vous répondrai à partir du livre, avec les pages citées." : "Je ne trouve pas cette information dans le livre." }}'), options: { enableStreaming: true } }, position: [1552, 160], notes: 'Salutation / hors sujet : réponse fixe, en flux, sans recherche.', notesInFlow: true }
});

const enregistrer_Echange_Direct = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: { name: 'Enregistrer Echange Direct', parameters: { operation: 'executeQuery', query: 'INSERT INTO rag_piketty_v3_chat (session_id, role, contenu) VALUES ($1, \'user\', $2), ($1, \'assistant\', $3) RETURNING id;', options: { queryReplacement: expr('{{ [ $(\'Lire Routing\').item.json.sessionId, $(\'Lire Routing\').item.json.question, $(\'Lire Routing\').item.json.type === \'salutation\' ? "Bonjour ! Posez-moi une question sur « Le Capital au XXIe siècle » de Thomas Piketty : je vous répondrai à partir du livre, avec les pages citées." : "Je ne trouve pas cette information dans le livre." ] }}') } }, credentials: { postgres: newCredential('Supabase Postgres', 'CREDENTIAL_ID') }, position: [1760, 160], notes: 'Historique : enregistré après la réponse directe.', notesInFlow: true }
});

const wf = workflow('2hOCE4ROHLre6h5L', 'RAG Piketty · V3 · Réponse en 5 étapes', { description: 'Answering en 5 étapes (contexte, routing, recherche hybride, reranking, génération) sur rag_piketty_v2_chunks. POST /webhook/rag-piketty-v3-ask.', executionOrder: 'v1', availableInMCP: true, errorWorkflow: 'qxiolQ3TqUKnBt4v', binaryMode: 'separate' });

export default wf
  .add(sticky('# Specs | RAG Piketty V3 : answering en 5 étapes\n\nSpec : `specs/2026-10-01-rag-piketty-v3-answering.md`. Entrée : `POST /webhook/rag-piketty-v3-ask` { sessionId, chatInput } → { output, etapes, duree_ms }.\n\n1. **Contexte** : nœud Configuration (topK 20 → 5, poids vecteurs 0,5, modèle) + 10 derniers messages (`rag_piketty_v3_chat`).\n2. **Routing** : Gemini Flash-Lite en JSON imposé (type, requête autonome, mots-clés AVEC accents, filtres). Repli : question brute.\n3. **Recherche hybride** : vecteur (RETRIEVAL_QUERY) + plein texte français sur `rag_piketty_v2_chunks`, fusion des rangs 0,5 / 0,5, 20 candidats.\n4. **Reranking** : Gemini note les candidats (1 500 premiers caractères), on garde les 5 meilleurs. Repli : ordre de la recherche.\n5. **Génération** : mêmes règles de citation que V1/V2. Salutation / hors sujet : réponse directe, sans recherche.\n\n**Mesuré** : ~7-10 s par question (dont ~1,7 s de démarrage du moteur de code n8n au 1er nœud Code). Niveau gratuit : 3 appels de génération par question, limite 15/min.\n\n**Points ouverts** : section C (« Les étapes de la croissance démographique ») retrouvée 1 fois sur 3 ; reranking limité aux 1 500 premiers caractères ; coût fixe du nœud Code.', [], { name: 'Specs Sticky Note', color: 2, width: 560, height: 640, position: [-640, -400] }))
  .add(pOST_rag_piketty_v3_ask)
  .to(configuration)
  .to(historique)
  .to(assembler_Contexte)
  .to(routing)
  .to(lire_Routing)
  .to(type_Livre.onTrue(embedding_Requete
    .to(recherche_Hybride)
    .to(preparer_Reranking)
    .to(reranking)
    .to(lire_Reranking)
    .to(generation)
    .to(enregistrer_Echange)).onFalse(reponse_Directe
    .to(enregistrer_Echange_Direct)))