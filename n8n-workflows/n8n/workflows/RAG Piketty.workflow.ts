const embeddings_Gemini_Ingestion = embedding({ type: '@n8n/n8n-nodes-langchain.embeddingsGoogleGemini', version: 1, config: { name: 'Embeddings Gemini Ingestion', parameters: { modelName: 'models/gemini-embedding-2' }, credentials: { googlePalmApi: newCredential('Troov CS autom (noetroov@gmail.com)', 'C1vcOFnsXJ64YHaL') }, position: [1080, 220], notes: 'Vectorisation des chunks.', notesInFlow: true } });
const decoupage_Chunks = textSplitter({ type: '@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter', version: 1, config: { name: 'Decoupage Chunks', parameters: { chunkSize: 8000, chunkOverlap: 200, options: {} }, position: [1240, 440], notes: 'Chunking : 8000 caractères max, soit 1 chunk par document de 2 pages (moins d\'appels au quota gratuit Gemini).', notesInFlow: true } });
const chargeur_Pages = documentLoader({ type: '@n8n/n8n-nodes-langchain.documentDefaultDataLoader', version: 1.1, config: { name: 'Chargeur Pages', parameters: { dataType: 'json', jsonMode: 'expressionData', jsonData: expr('{{ $json.text }}'), textSplittingMode: 'custom', options: { metadata: { metadataValues: [{ name: 'titre', value: expr('{{ $json.titre }}') }, { name: 'page', value: expr('{{ $json.page }}') }] } } }, position: [1240, 220], notes: 'Augmentation : ajoute titre et page à chaque chunk.', notesInFlow: true, subnodes: { textSplitter: decoupage_Chunks } } });
const modele_Gemini = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', version: 1.2, config: { name: 'Modele Gemini', parameters: { modelName: 'models/gemini-flash-lite-latest', options: { temperature: 0.2 } }, credentials: { googlePalmApi: newCredential('Troov CS autom (noetroov@gmail.com)', 'C1vcOFnsXJ64YHaL') }, position: [220, 1040], notes: 'Génération : même modèle que le workflow support. Température basse pour coller au texte.', notesInFlow: true } });
const memoire_Chat = memory({ type: '@n8n/n8n-nodes-langchain.memoryPostgresChat', version: 1.4, config: { name: 'Memoire Chat', parameters: { sessionIdType: 'fromInput', tableName: 'rag_piketty_chat', contextWindowLength: 10 }, credentials: { postgres: newCredential('Supabase Postgres', 'UMR1L2xjBJ7tVbt6') }, position: [440, 1040], notes: 'Mémoire : 10 derniers messages par session, stockés dans Supabase.', notesInFlow: true } });
const embeddings_Gemini_Recherche = embedding({ type: '@n8n/n8n-nodes-langchain.embeddingsGoogleGemini', version: 1, config: { name: 'Embeddings Gemini Recherche', parameters: { modelName: 'models/gemini-embedding-2' }, credentials: { googlePalmApi: newCredential('Troov CS autom (noetroov@gmail.com)', 'C1vcOFnsXJ64YHaL') }, position: [660, 1240], notes: 'Même modèle d\'embedding que l\'ingestion (obligatoire).', notesInFlow: true } });
const recherche_Livre = tool({ type: '@n8n/n8n-nodes-langchain.vectorStorePGVector', version: 1.3, config: { name: 'Recherche Livre', parameters: { mode: 'retrieve-as-tool', toolDescription: 'Recherche sémantique dans le livre indexé (Le Capital au XXIe siècle, Thomas Piketty). Renvoie les passages les plus proches de la requête, avec leur numéro de page dans les métadonnées. À utiliser pour toute question sur le contenu du livre.', tableName: 'rag_piketty', topK: 8, includeDocumentMetadata: true, useReranker: false, options: {} }, credentials: { postgres: newCredential('Supabase Postgres', 'UMR1L2xjBJ7tVbt6') }, position: [660, 1040], notes: 'Recherche : 8 chunks les plus proches (cosine). Reranking Cohere prévu en V1.1.', notesInFlow: true, subnodes: { embedding: embeddings_Gemini_Recherche } } });

const formulaire_Livre = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.6,
  config: { name: 'Formulaire Livre', parameters: { formTitle: 'RAG : indexer un livre', formDescription: 'Envoie un PDF (avec couche texte). Chaque envoi remplace le livre déjà indexé.', formFields: { values: [{ fieldLabel: 'Livre (PDF)', fieldName: 'livre', fieldType: 'file', multipleFiles: false, acceptFileTypes: '.pdf', requiredField: true }, { fieldLabel: 'Titre du livre', fieldName: 'titre', fieldType: 'text', placeholder: 'Le Capital au XXIe siècle', requiredField: true }] }, responseMode: 'onReceived', options: { respondWithOptions: { values: { formSubmittedText: 'Livre reçu. L\'indexation tourne en arrière-plan (~30 min pour un livre de 1000 pages, à cause du quota gratuit Gemini). N\'envoie pas le fichier une deuxième fois. Le chat garde l\'ancien index jusqu\'à la fin.' } } } }, position: [100, 750], webhookId: 'b008de22-00d5-4309-925e-9d4a91b4a93c', notes: 'Entrée : PDF + titre. Répond tout de suite, l\'indexation continue en arrière-plan.', notesInFlow: true }
});

const extraire_Texte_PDF = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: { name: 'Extraire Texte PDF', parameters: { operation: 'pdf', binaryPropertyName: 'livre', options: { joinPages: false } }, position: [220, 0], notes: 'Extraction : texte page par page (garde le numéro de page pour les citations).', notesInFlow: true }
});

const nettoyer_Pages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Nettoyer Pages', parameters: { jsCode: "// Cleaning + augmentation : pages regroupées par 2 (1 chunk = 2 pages), titre et pages en métadonnées,\n// puis découpage en lots de ~75 000 caractères pour rester sous le quota gratuit Gemini (~30 000 tokens/min).\nconst titre = $('Formulaire Livre').first().json.titre;\nconst raw = $input.first().json.text;\nconst pages = Array.isArray(raw) ? raw : String(raw ?? '').split('\\f');\nconst PAGES_PAR_DOC = 2;\nconst BUDGET_LOT = 75000;\n\nconst clean = (t) => String(t ?? '')\n  .replace(/OceanofPDF\\.com/gi, '')          // filigrane du PDF\n  .replace(/[ \\t]*\\n[ \\t]*/g, '\\n')\n  .replace(/\\n{3,}/g, '\\n\\n')\n  .replace(/[ \\t]{2,}/g, ' ')\n  .trim();\n\nconst utiles = [];\npages.forEach((p, i) => {\n  const text = clean(p);\n  if (text.length >= 50) utiles.push({ text, page: i + 1 });\n});\nif (utiles.length === 0) {\n  throw new Error('Aucun texte exploitable dans le PDF (PDF scanné sans couche texte ?)');\n}\n\nconst docs = [];\nfor (let i = 0; i < utiles.length; i += PAGES_PAR_DOC) {\n  const groupe = utiles.slice(i, i + PAGES_PAR_DOC);\n  const debut = groupe[0].page, fin = groupe[groupe.length - 1].page;\n  docs.push({ text: groupe.map((g) => g.text).join('\\n\\n'), page: debut === fin ? String(debut) : `${debut}-${fin}`, titre });\n}\n\nconst lots = [];\nlet courant = [], taille = 0;\nfor (const d of docs) {\n  if (courant.length && taille + d.text.length > BUDGET_LOT) { lots.push(courant); courant = []; taille = 0; }\n  courant.push(d); taille += d.text.length;\n}\nif (courant.length) lots.push(courant);\n\nreturn lots.map((docsDuLot, i) => ({ json: { lot: i + 1, nbLots: lots.length, docs: docsDuLot } }));" }, position: [440, 0], notes: 'Cleaning : retire le filigrane, normalise les espaces (les tirets de fin de ligne sont gardés : ce sont des mots composés). Augmentation : 2 pages par document, titre + pages en métadonnées. Regroupe en lots (quota Gemini).', notesInFlow: true }
});

const vider_Index = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: { name: 'Vider Index', parameters: { operation: 'executeQuery', query: 'DROP TABLE IF EXISTS rag_piketty_new;', options: {} }, credentials: { postgres: newCredential('Supabase Postgres', 'UMR1L2xjBJ7tVbt6') }, position: [660, 0], notes: 'Vide la table de construction rag_piketty_new. L\'index en ligne (rag_piketty) n\'est remplacé qu\'à la fin, si tous les lots ont réussi.', notesInFlow: true, executeOnce: true }
});

const reprendre_Lots = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Reprendre Lots', parameters: { jsCode: "return $('Nettoyer Pages').all();" }, position: [880, 0], notes: 'Récupère les lots (le nœud Postgres ne renvoie que le résultat de la requête).', notesInFlow: true }
});

const stocker_Vecteurs = node({
  type: '@n8n/n8n-nodes-langchain.vectorStorePGVector',
  version: 1.3,
  config: { name: 'Stocker Vecteurs', parameters: { mode: 'insert', tableName: 'rag_piketty_new', embeddingBatchSize: 100, options: {} }, credentials: { postgres: newCredential('Supabase Postgres', 'UMR1L2xjBJ7tVbt6') }, position: [1540, 80], notes: 'Vectorisation : stocke les chunks dans Supabase (table de construction rag_piketty_new, créée automatiquement).', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000, notesInFlow: true, subnodes: { embedding: embeddings_Gemini_Ingestion, documentLoader: chargeur_Pages } }
});

const boucle_Lots = splitInBatches({ version: 3, config: { name: 'Boucle Lots', parameters: { batchSize: 1, options: {} }, position: [1100, 0], notes: 'Un lot (~75 000 caractères) à la fois.', notesInFlow: true } });

const eclater_Lot = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: { name: 'Eclater Lot', parameters: { fieldToSplitOut: 'docs', options: {} }, position: [1320, 80], notes: 'Un item par document (2 pages).', notesInFlow: true }
});

const pause_Quota = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Pause Quota', parameters: { resume: 'timeInterval', amount: 66, unit: 'seconds' }, position: [1760, 80], executeOnce: true, notes: 'Attend 66 s entre deux lots : quota gratuit Gemini (~30 000 tokens/min).', notesInFlow: true }
});

const publier_Index = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.7,
  config: { name: 'Publier Index', parameters: { operation: 'executeQuery', query: 'BEGIN;\nDROP TABLE IF EXISTS rag_piketty;\nALTER TABLE rag_piketty_new RENAME TO rag_piketty;\nALTER INDEX IF EXISTS rag_piketty_new_pkey RENAME TO rag_piketty_pkey;\nCOMMIT;', options: {} }, credentials: { postgres: newCredential('Supabase Postgres', 'UMR1L2xjBJ7tVbt6') }, position: [1320, -120], executeOnce: true, notes: 'Tous les lots ont réussi : remplace l\'index en ligne par le nouveau, en une transaction.', notesInFlow: true }
});

const chat_Livre = trigger({
  type: '@n8n/n8n-nodes-langchain.chatTrigger',
  version: 1.5,
  config: { name: 'Chat Livre', parameters: { public: true, mode: 'hostedChat', authentication: 'none', initialMessages: 'Bonjour ! Pose-moi une question sur « Le Capital au XXIe siècle » de Thomas Piketty.', options: { title: 'RAG Piketty', subtitle: 'Réponses tirées uniquement du livre, avec citations', inputPlaceholder: 'Ta question sur le livre…' } }, position: [0, 820], webhookId: 'ffb2b99f-cd15-478f-bc25-153cc5626bbb', notes: 'Input : chat public.', notesInFlow: true }
});

const agent_RAG = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: { name: 'Agent RAG', parameters: { promptType: 'auto', options: { systemMessage: 'Tu es un assistant qui répond à des questions sur le livre « Le Capital au XXIe siècle » de Thomas Piketty (publié en 2013).\n\n## Méthode\n1. Sélection : si le message est une salutation ou une simple formule de politesse, réponds brièvement sans chercher. Pour toute autre question, utilise l\'outil « Recherche Livre ».\n2. Recherche : reformule la question en une requête de recherche courte et précise, avec les mots-clés que le livre emploierait (ex. « concentration du patrimoine France », « part du revenu des 50 % les plus pauvres »). Pour une question large, fais 2 ou 3 recherches sur des angles différents.\n3. Génération : réponds en français, UNIQUEMENT à partir des extraits renvoyés par l\'outil. N\'utilise jamais tes connaissances générales.\n\n## Citations (obligatoires)\n- Appuie chaque affirmation sur un court extrait entre guillemets suivi des pages, tirées du champ « page » des métadonnées : « … » (p. 312-313).\n- N\'invente jamais un numéro de page ni une citation.\n\n## Cas particuliers\n- Si les extraits ne contiennent pas la réponse, réponds exactement : « Je ne trouve pas cette information dans le livre. » Ne confirme ni n\'infirme rien d\'autre.\n- Si la question porte sur « aujourd\'hui » ou l\'actualité, réponds à partir du livre et précise que le livre date de 2013 et ne couvre pas la situation actuelle.', maxIterations: 6 } }, position: [440, 820], notes: 'Sélection (chercher ou non), reformulation de la requête, génération avec citations.', notesInFlow: true, subnodes: { model: modele_Gemini, memory: memoire_Chat, tools: [recherche_Livre] } }
});

const wf = workflow('wkmqCiBLXzLE5wq0', 'RAG Piketty', { description: 'RAG sur « Le Capital au XXIe siècle » : ingestion d\'un PDF via formulaire (Supabase PGVector + embeddings Gemini), puis questions via un chat public (agent Gemini, citations des pages).', executionOrder: 'v1', availableInMCP: true, binaryMode: 'separate', errorWorkflow: 'qxiolQ3TqUKnBt4v' });

export default wf
  .add(sticky('# Specs | RAG Piketty\n\nSpec complète : `specs/2026-09-30-rag-piketty.md`\n\n## Ingestion (formulaire)\nExtraction (page par page) → Cleaning (Code) → Vidage de la table de construction → Augmentation (2 pages par document, titre, pages) → lots de ~75 000 caractères, pause de 66 s entre lots (quota gratuit Gemini) → Chunking 8000 → Vectorisation (Gemini `gemini-embedding-2`) → Supabase PGVector `rag_piketty_new` → à la fin, remplacement de `rag_piketty` en une transaction.\n\n## Réponse (chat public)\nInput → Agent : sélection (chercher ou non) + reformulation → Recherche (8 chunks) → Génération Gemini avec citations « … » (p. X). Hors livre : « Je ne trouve pas cette information dans le livre. »\n\nMémoire : Postgres Chat Memory (Supabase), 10 messages.\n\n## Points ouverts\n1. Quota gratuit Gemini partagé avec le chat : si 429, baisser BUDGET_LOT.\n2. Workflow d\'erreur partagé avec Troov (message « tri des mails ») : à rendre générique.\n3. Pas de verrou contre deux envois simultanés du formulaire.\n4. Reranking Cohere : V1.1.\n', [], { name: 'Specs Sticky Note', color: 2, width: 420, height: 560, position: [-520, -40] }))
  .add(sticky('## 1. Ingestion\nExtraction → Cleaning → Vidage → Chunking + Augmentation → Vectorisation', [extraire_Texte_PDF, nettoyer_Pages, vider_Index, reprendre_Lots, stocker_Vecteurs, embeddings_Gemini_Ingestion, chargeur_Pages, decoupage_Chunks], { name: 'Ingestion Sticky Note', width: 1340, height: 700, position: [-60, -140] }))
  .add(sticky('## 2. Réponse\nInput → Sélection + reformulation (agent) → Recherche → Génération', [formulaire_Livre, chat_Livre, agent_RAG, modele_Gemini, memoire_Chat, recherche_Livre, embeddings_Gemini_Recherche], { name: 'Reponse Sticky Note', width: 900, height: 620, position: [-60, 700] }))
  .add(formulaire_Livre)
  .to(extraire_Texte_PDF)
  .to(nettoyer_Pages)
  .to(vider_Index)
  .to(reprendre_Lots)
  .to(boucle_Lots
    .onDone(publier_Index)
    .onEachBatch(eclater_Lot.to(stocker_Vecteurs).to(pause_Quota).to(nextBatch(boucle_Lots))))
  .add(chat_Livre)
  .to(agent_RAG)