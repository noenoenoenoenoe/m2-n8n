const embeddings_Gemini_Ingestion = embedding({ type: '@n8n/n8n-nodes-langchain.embeddingsGoogleGemini', version: 1, config: { name: 'Embeddings Gemini Ingestion', parameters: { modelName: 'models/gemini-embedding-2' }, credentials: { googlePalmApi: newCredential('Troov CS autom (compte)', 'CREDENTIAL_ID') }, position: [1488, 416], notes: 'Vectorisation des chunks.', notesInFlow: true } });
const decoupage_Chunks = textSplitter({ type: '@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter', version: 1, config: { name: 'Decoupage Chunks', parameters: { chunkSize: 8000, chunkOverlap: 200, options: {} }, position: [1200, 720], notes: 'Chunking : 8000 caractères max, soit 1 chunk par document de 2 pages (moins d\'appels au quota gratuit Gemini).', notesInFlow: true } });
const chargeur_Pages = documentLoader({ type: '@n8n/n8n-nodes-langchain.documentDefaultDataLoader', version: 1.1, config: { name: 'Chargeur Pages', parameters: { jsonMode: 'expressionData', jsonData: expr('{{ $json.text }}'), textSplittingMode: 'custom', options: { metadata: { metadataValues: [{ name: 'titre', value: expr('{{ $json.titre }}') }, { name: 'page', value: expr('{{ $json.page }}') }] } } }, position: [1488, 624], notes: 'Augmentation : ajoute titre et page à chaque chunk.', notesInFlow: true, subnodes: { textSplitter: decoupage_Chunks } } });
const modele_Gemini = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', version: 1.2, config: { name: 'Modele Gemini', parameters: { modelName: 'models/gemini-flash-lite-latest', options: { temperature: 0.2 } }, credentials: { googlePalmApi: newCredential('Troov CS autom (compte)', 'CREDENTIAL_ID') }, position: [400, 1280], notes: 'Génération : même modèle que le workflow support. Température basse pour coller au texte.', notesInFlow: true } });
const memoire_Chat = memory({ type: '@n8n/n8n-nodes-langchain.memoryPostgresChat', version: 1.4, config: { name: 'Memoire Chat', parameters: { sessionIdType: 'customKey', sessionKey: expr('{{ $(\'POST /rag-piketty-ask\').isExecuted ? $(\'POST /rag-piketty-ask\').item.json.body.sessionId : $(\'Chat Livre\').item.json.sessionId }}'), tableName: 'rag_piketty_chat', contextWindowLength: 10 }, credentials: { postgres: newCredential('Supabase Postgres', 'CREDENTIAL_ID') }, position: [400, 1472], notes: 'Mémoire : 10 derniers messages par session, stockés dans Supabase.', notesInFlow: true } });
const embeddings_Gemini_Recherche = embedding({ type: '@n8n/n8n-nodes-langchain.embeddingsGoogleGemini', version: 1, config: { name: 'Embeddings Gemini Recherche', parameters: { modelName: 'models/gemini-embedding-2' }, credentials: { googlePalmApi: newCredential('Troov CS autom (compte)', 'CREDENTIAL_ID') }, position: [0, 1632], notes: 'Même modèle d\'embedding que l\'ingestion (obligatoire).', notesInFlow: true } });
const recherche_Livre = tool({ type: '@n8n/n8n-nodes-langchain.vectorStorePGVector', version: 1.3, config: { name: 'Recherche Livre', parameters: { mode: 'retrieve-as-tool', toolDescription: 'Recherche sémantique dans le livre indexé (Le Capital au XXIe siècle, Thomas Piketty). Renvoie les passages les plus proches de la requête, avec leur numéro de page dans les métadonnées. À utiliser pour toute question sur le contenu du livre.', tableName: 'rag_piketty', topK: 8, options: {} }, credentials: { postgres: newCredential('Supabase Postgres', 'CREDENTIAL_ID') }, position: [400, 1632], notes: 'Recherche : 8 chunks les plus proches (cosine). Reranking Cohere prévu en V1.1.', notesInFlow: true, subnodes: { embedding: embeddings_Gemini_Recherche } } });

const formulaire_Livre = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.6,
  config: { name: 'Formulaire Livre', parameters: { formTitle: 'RAG : indexer un livre', formDescription: 'Envoie un PDF (avec couche texte). Chaque envoi remplace le livre déjà indexé.', formFields: { values: [{ fieldLabel: 'Livre (PDF)', fieldType: 'file', fieldName: 'livre', multipleFiles: false, acceptFileTypes: '.pdf', requiredField: true }, { fieldLabel: 'Titre du livre', fieldName: 'titre', placeholder: 'Le Capital au XXIe siècle', requiredField: true }] }, options: { respondWithOptions: { values: { formSubmittedText: 'Livre reçu. L\'indexation tourne en arrière-plan (~30 min pour un livre de 1000 pages, à cause du quota gratuit Gemini). N\'envoie pas le fichier une deuxième fois. Le chat garde l\'ancien index jusqu\'à la fin.' } } } }, position: [0, 80], webhookId: '00000000-0000-0000-0000-000000000000', notes: 'Entrée : PDF + titre. Répond tout de suite, l\'indexation continue en arrière-plan.', notesInFlow: true }
});

const extraire_Texte_PDF = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: { name: 'Extraire Texte PDF', parameters: { operation: 'pdf', binaryPropertyName: 'livre', options: { joinPages: false } }, position: [224, 80], notes: 'Extraction : texte page par page (garde le numéro de page pour les citations).', notesInFlow: true }
});

const nettoyer_Pages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Nettoyer Pages', parameters: { jsCode: '// Cleaning + augmentation : pages regroupées par 2 (1 chunk = 2 pages), titre et pages en métadonnées,\n// puis découpage en lots de ~75 000 caractères pour rester sous le quota gratuit Gemini (~30 000 tokens/min).\nconst titre = $(\'Formulaire Livre\').first().json.titre;\nconst raw = $input.first().json.text;\nconst pages = Array.isArray(raw) ? raw : String(raw ?? \'\').split(\'\\f\');\nconst PAGES_PAR_DOC = 2;\nconst BUDGET_LOT = 75000;\n\nconst clean = (t) => String(t ?? \'\')\n  .replace(/OceanofPDF\\.com/gi, \'\')          // filigrane du PDF\n  .replace(/[ \\t]*\\n[ \\t]*/g, \'\\n\')\n  .replace(/\\n{3,}/g, \'\\n\\n\')\n  .replace(/[ \\t]{2,}/g, \' \')\n  .trim();\n\nconst utiles = [];\npages.forEach((p, i) => {\n  const text = clean(p);\n  if (text.length >= 50) utiles.push({ text, page: i + 1 });\n});\nif (utiles.length === 0) {\n  throw new Error(\'Aucun texte exploitable dans le PDF (PDF scanné sans couche texte ?)\');\n}\n\nconst docs = [];\nfor (let i = 0; i < utiles.length; i += PAGES_PAR_DOC) {\n  const groupe = utiles.slice(i, i + PAGES_PAR_DOC);\n  const debut = groupe[0].page, fin = groupe[groupe.length - 1].page;\n  docs.push({ text: groupe.map((g) => g.text).join(\'\\n\\n\'), page: debut === fin ? String(debut) : `${debut}-${fin}`, titre });\n}\n\nconst lots = [];\nlet courant = [], taille = 0;\nfor (const d of docs) {\n  if (courant.length && taille + d.text.length > BUDGET_LOT) { lots.push(courant); courant = []; taille = 0; }\n  courant.push(d); taille += d.text.length;\n}\nif (courant.length) lots.push(courant);\n\nreturn lots.map((docsDuLot, i) => ({ json: { lot: i + 1, nbLots: lots.length, docs: docsDuLot } }));' }, position: [448, 80], notes: 'Cleaning : retire le filigrane, normalise les espaces (les tirets de fin de ligne sont gardés : ce sont des mots composés). Augmentation : 2 pages par document, titre + pages en métadonnées. Regroupe en lots (quota Gemini).', notesInFlow: true }
});

const vider_Index = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: { name: 'Vider Index', parameters: { operation: 'executeQuery', query: 'DROP TABLE IF EXISTS rag_piketty_new;', options: {} }, credentials: { postgres: newCredential('Supabase Postgres', 'CREDENTIAL_ID') }, position: [640, 80], notes: 'Vide la table de construction rag_piketty_new. L\'index en ligne (rag_piketty) n\'est remplacé qu\'à la fin, si tous les lots ont réussi.', notesInFlow: true, executeOnce: true }
});

const reprendre_Lots = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Reprendre Lots', parameters: { jsCode: 'return $(\'Nettoyer Pages\').all();' }, position: [864, 80], notes: 'Récupère les lots (le nœud Postgres ne renvoie que le résultat de la requête).', notesInFlow: true }
});

const boucle_Lots = node({
  type: 'n8n-nodes-base.splitInBatches',
  version: 3,
  config: { name: 'Boucle Lots', parameters: { options: {} }, position: [1168, 80], notes: 'Un lot (~75 000 caractères) à la fois.', notesInFlow: true }
});

const publier_Index = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: { name: 'Publier Index', parameters: { operation: 'executeQuery', query: 'BEGIN;\nDROP TABLE IF EXISTS rag_piketty;\nALTER TABLE rag_piketty_new RENAME TO rag_piketty;\nALTER INDEX IF EXISTS rag_piketty_new_pkey RENAME TO rag_piketty_pkey;\nCOMMIT;', options: {} }, credentials: { postgres: newCredential('Supabase Postgres', 'CREDENTIAL_ID') }, position: [1568, 0], notes: 'Tous les lots ont réussi : remplace l\'index en ligne par le nouveau, en une transaction.', notesInFlow: true, executeOnce: true }
});

const eclater_Lot = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: { name: 'Eclater Lot', parameters: { fieldToSplitOut: 'docs', options: {} }, position: [1568, 192], notes: 'Un item par document (2 pages).', notesInFlow: true }
});

const stocker_Vecteurs = node({
  type: '@n8n/n8n-nodes-langchain.vectorStorePGVector',
  version: 1.3,
  config: { name: 'Stocker Vecteurs', parameters: { mode: 'insert', tableName: 'rag_piketty_new', embeddingBatchSize: 100, options: {} }, credentials: { postgres: newCredential('Supabase Postgres', 'CREDENTIAL_ID') }, position: [1856, 352], notes: 'Vectorisation : stocke les chunks dans Supabase (table de construction rag_piketty_new, créée automatiquement).', notesInFlow: true, retryOnFail: true, maxTries: 3, waitBetweenTries: 5000, subnodes: { embedding: embeddings_Gemini_Ingestion, documentLoader: chargeur_Pages } }
});

const pause_Quota = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Pause Quota', parameters: { amount: 66 }, position: [2272, 448], webhookId: '00000000-0000-0000-0000-000000000000', notes: 'Attend 66 s entre deux lots : quota gratuit Gemini (~30 000 tokens/min).', notesInFlow: true, executeOnce: true }
});

const chat_Livre = trigger({
  type: '@n8n/n8n-nodes-langchain.chatTrigger',
  version: 1.5,
  config: { name: 'Chat Livre', parameters: { public: true, initialMessages: 'Bonjour ! Pose-moi une question sur « Le Capital au XXIe siècle » de Thomas Piketty.', options: { inputPlaceholder: 'Ta question sur le livre…', subtitle: 'Réponses tirées uniquement du livre, avec citations', title: 'RAG Piketty' } }, position: [480, 1104], webhookId: '00000000-0000-0000-0000-000000000000', notes: 'Input : chat public.', notesInFlow: true }
});

const agent_RAG = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: { name: 'Agent RAG', parameters: { promptType: 'define', text: expr('{{ $json.chatInput || $json.body.chatInput }}'), options: { systemMessage: '<role>\nTu es un assistant spécialiste du livre « Le Capital au XXIe siècle » de Thomas Piketty (publié en 2013). Tu réponds en français, uniquement à partir du texte du livre.\n</role>\n\n<goal>\nRépondre de façon exacte et sourcée aux questions sur le livre, en t\'appuyant exclusivement sur les extraits renvoyés par l\'outil « Recherche Livre ».\n</goal>\n\n<method>\n1. Sélection : si le message est une salutation ou une simple formule de politesse, réponds brièvement sans chercher. Pour toute autre question, utilise l\'outil « Recherche Livre ».\n2. Recherche : reformule la question en une requête de recherche courte et précise, avec les mots-clés que le livre emploierait (ex. « concentration du patrimoine France », « part du revenu des 50 % les plus pauvres »). Pour une question large, fais 2 ou 3 recherches sur des angles différents.\n3. Génération : réponds UNIQUEMENT à partir des extraits renvoyés par l\'outil. N\'utilise jamais tes connaissances générales.\n</method>\n\n<citations>\n- Appuie chaque affirmation sur un court extrait exact du livre entre guillemets français, suivi immédiatement des pages entre parenthèses, tirées du champ « page » des métadonnées. Exemple : Piketty montre que « les patrimoines issus du passé se recapitalisent plus vite que le rythme de progression de la production » (p. 63-64).\n- Le numéro de page est UNIQUEMENT la valeur du champ « page » des métadonnées, par exemple 525-526. N\'utilise jamais le champ « id » (une suite de lettres, de chiffres et de tirets) comme numéro de page.\n- N\'invente jamais un numéro de page ni une citation.\n</citations>\n\n<special_cases>\n- Si les extraits ne contiennent pas la réponse, réponds exactement : « Je ne trouve pas cette information dans le livre. » Ne confirme ni n\'infirme rien d\'autre.\n- Si la question porte sur « aujourd\'hui » ou l\'actualité, réponds à partir du livre et précise que le livre date de 2013 et ne couvre pas la situation actuelle.\n</special_cases>\n\n<output_format>\n- Markdown simple : paragraphes courts, listes à puces, gras pour les notions clés.\n- N\'utilise jamais de LaTeX ni de symbole $ (pas de $r > g$) : écris les formules en texte simple, par exemple r > g.\n- Ne mentionne jamais l\'outil de recherche, la base de données, les « extraits fournis » ni le fonctionnement interne : réponds comme quelqu\'un qui cite directement le livre.\n</output_format>', maxIterations: 6 } }, position: [784, 1472], notes: 'Sélection (chercher ou non), reformulation de la requête, génération avec citations.', notesInFlow: true, subnodes: { model: modele_Gemini, memory: memoire_Chat, tools: [recherche_Livre] } }
});

const pOST_rag_piketty_ask = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'POST /rag-piketty-ask', parameters: { httpMethod: 'POST', path: 'rag-piketty-ask', responseMode: 'lastNode', options: { allowedOrigins: '*' } }, position: [480, 1808], webhookId: 'rag-piketty-ask', notes: 'Input de l\'interface sur mesure : POST { sessionId, chatInput } → { output }. Chemin fixe, contrairement au chat hébergé.', notesInFlow: true }
});

const reveil_Supabase = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.4,
  config: { name: 'Reveil Supabase', parameters: { rule: { interval: [{ daysInterval: 6 }] } }, position: [0, 2000], notes: 'Tous les 6 jours : Supabase gratuit se met en pause après 7 jours sans activité.', notesInFlow: true }
});

const compter_Index = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: { name: 'Compter Index', parameters: { operation: 'executeQuery', query: 'SELECT count(*) AS lignes FROM rag_piketty;', options: {} }, credentials: { postgres: newCredential('Supabase Postgres', 'CREDENTIAL_ID') }, position: [224, 2000], notes: 'Petite requête qui garde la base active et affiche le nombre de morceaux indexés (505 attendus).', notesInFlow: true }
});

const wf = workflow('wkmqCiBLXzLE5wq0', 'RAG Piketty', { description: 'RAG sur « Le Capital au XXIe siècle » : ingestion d\'un PDF via formulaire (Supabase PGVector + embeddings Gemini), puis questions via un chat public (agent Gemini, citations des pages).', executionOrder: 'v1', availableInMCP: true, binaryMode: 'separate', errorWorkflow: 'qxiolQ3TqUKnBt4v' });

export default wf
  .add(sticky('# Specs | RAG Piketty\n\nRAG sur « Le Capital au XXIe siècle » (Thomas Piketty, 2013) : on envoie le PDF, on pose des questions, l\'agent répond **uniquement avec le livre** et **cite les pages**.\n\n**Specs (repo `m2-n8n/n8n-workflows/specs/`)**\n- `2026-09-30-rag-piketty.md` : le RAG\n- `2026-09-30-rag-piketty-interface.md` : la page\n- `2026-10-01-rag-piketty-ameliorations.md` : réveil Supabase, notes, prompt\n\n**Liens publics**\n- Page : https://votre-instance.app.n8n.cloud/webhook/rag-piketty (workflow « RAG Piketty Page »)\n- Formulaire d\'ingestion : https://votre-instance.app.n8n.cloud/form/00000000-0000-0000-0000-000000000000\n- Chat de secours : URL publique dans le nœud « Chat Livre ». Elle change à chaque `n8ncli push` (l\'identifiant du Chat Trigger est régénéré) : la page, elle, utilise un chemin fixe\n\n**Pile** : n8n Cloud · Gemini (`gemini-embedding-2`, `gemini-flash-lite-latest`) · Supabase Postgres + pgvector\n\n**Points ouverts**\n1. Workflow d\'erreur partagé avec Troov (message « tri des mails »).\n2. Pas de verrou contre deux envois simultanés du formulaire.\n3. Le chat consomme le même quota Gemini que l\'ingestion : ne pas l\'utiliser pendant une ingestion.\n4. Hypothèse non vérifiée : une requête SQL via le pooler suffit à éviter la mise en pause de Supabase (à contrôler à J+8).\n5. Chat de secours à supprimer après le rendu.\n6. Morceaux de 1000-1500 caractères quand la facturation Gemini sera activée.\n7. Reranking (Cohere).', [], { name: 'Specs Sticky Note', color: 2, width: 520, height: 1000, position: [-896, -176] }))
  .add(sticky('## 1. Entrée\nLe formulaire reçoit le **PDF** et le **titre**. Il répond tout de suite (« ~30 min ») : l\'indexation continue en arrière-plan.', [], { name: 'Note Etape 1', width: 300, height: 150, position: [-320, 0] }))
  .add(sticky('## 2. Extraction\nTexte **page par page** (`joinPages: false`) : on garde le numéro de page pour les citations. 1046 pages lues.', [], { name: 'Note Etape 2', width: 300, height: 128, position: [-16, 224] }))
  .add(sticky('## 3. Nettoyage + augmentation\nRetire le filigrane « OceanofPDF.com », normalise les espaces, écarte les pages de moins de 50 caractères (vides ou presque) : 1009 utiles. Les tirets de fin de ligne sont **gardés** (mots composés : « États-Unis »).\nRegroupe **2 pages par document** (505) avec les métadonnées `titre` et `page`, puis en **24 lots** de ≤ 75 000 caractères.', [], { name: 'Note Etape 3', width: 300, height: 260, position: [320, 240] }))
  .add(sticky('## 4. Table de construction\nOn vide `rag_piketty_new`, pas l\'index en ligne : si l\'ingestion casse en route, le chat garde l\'ancien index.\n« Reprendre Lots » récupère les lots (Postgres ne renvoie que son propre résultat).', [], { name: 'Note Etape 4', width: 300, height: 194, position: [624, -144] }))
  .add(sticky('## 5. Boucle par lots\nUn lot à la fois, puis on éclate le lot en documents (un item = 2 pages).', [], { name: 'Note Etape 5', width: 300, height: 106, position: [1232, -64] }))
  .add(sticky('## 6. Découpage + vectorisation\nDécoupage à 8000 caractères : chaque document de 2 pages (≤ 7831) donne **1 morceau**. Embeddings `gemini-embedding-2` (3072 dimensions, 8192 tokens en entrée), stockés dans `rag_piketty_new`. 3 essais en cas d\'erreur.', [], { name: 'Note Etape 6', width: 396, height: 178, position: [1424, 784] }))
  .add(sticky('## 7. Pause quota\n**66 s** entre deux lots : la clé Gemini gratuite est limitée à **100 textes/min** et **~30 000 tokens/min** (mesuré). Ingestion complète : ~28 min.', [], { name: 'Note Etape 7', width: 300, height: 150, position: [2272, 272] }))
  .add(sticky('## 8. Publication\nQuand **tous** les lots ont réussi : en une transaction, `rag_piketty` est supprimée et `rag_piketty_new` prend sa place.', [], { name: 'Note Etape 8', width: 300, height: 150, position: [1552, -176] }))
  .add(sticky('## Entrée : chat hébergé\n**Chat Livre** : le chat public hébergé par n8n, gardé en secours pour la démo. Son URL change à chaque `n8ncli push` : la récupérer dans ce nœud.', [], { name: 'Note Etape 9', width: 300, height: 150, position: [160, 1024] }))
  .add(sticky('## Entrée : la page\n**POST /rag-piketty-ask** : reçoit `{ sessionId, chatInput }` de la page et renvoie `{ output }`. Chemin fixe, contrairement au chat hébergé. Ouvert à toutes les origines (`allowedOrigins: \'*\'`) car la page est servie dans un bac à sable (origine `null`).', [], { name: 'Note Etape 14', width: 300, height: 216, position: [432, 1952] }))
  .add(sticky('## Agent RAG\n**Sélection** (chercher ou non), **reformulation** de la question en mots-clés du livre (2-3 recherches si la question est large), **génération** en français avec citations « extrait » (p. X). Hors livre : « Je ne trouve pas cette information dans le livre. » Prompt structuré en sections XML.', [], { name: 'Note Etape 10', width: 300, height: 238, position: [624, 1200] }))
  .add(sticky('## Recherche\nOutil « Recherche Livre » : les **8 morceaux** les plus proches dans `rag_piketty` (distance cosinus), avec la métadonnée `page`. Même modèle d\'embedding que l\'ingestion (obligatoire).', [], { name: 'Note Etape 11', width: 300, height: 172, position: [112, 1792] }))
  .add(sticky('## Mémoire + modèle\n**Postgres Chat Memory** (`rag_piketty_chat`, Supabase) : 10 derniers messages par session, persistants. La session vient de la page (`#s=…` dans l\'URL) ou du chat hébergé.\nModèle : `gemini-flash-lite-latest`, température 0,2.', [], { name: 'Note Etape 12', width: 300, height: 216, position: [80, 1328] }))
  .add(sticky('## Réveil Supabase\nUn projet Supabase gratuit est **mis en pause après 7 jours** sans activité : le RAG tomberait. Tous les 6 jours, une petite requête garde la base active et compte les morceaux (505 attendus). En cas d\'échec, le workflow d\'erreur est déclenché.', [], { name: 'Note Etape 13', width: 300, height: 216, position: [-16, 2144] }))
  .add(formulaire_Livre)
  .to(extraire_Texte_PDF)
  .to(nettoyer_Pages)
  .to(vider_Index)
  .to(reprendre_Lots)
  .to(splitInBatches(boucle_Lots)
  .onEachBatch(eclater_Lot
    .to(stocker_Vecteurs)
    .to(pause_Quota)
    .to(nextBatch(boucle_Lots)))
  .onDone(publier_Index))
  .add(chat_Livre)
  .to(agent_RAG)
  .add(pOST_rag_piketty_ask)
  .to(agent_RAG)
  .add(reveil_Supabase)
  .to(compter_Index)