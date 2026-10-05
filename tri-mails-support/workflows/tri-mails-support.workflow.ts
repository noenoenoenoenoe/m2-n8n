const aI_Model_Gemini = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', version: 1.2, config: { name: 'AI Model Gemini', parameters: { modelName: 'models/gemini-flash-lite-latest', options: {} }, credentials: { googlePalmApi: newCredential('Troov CS autom (compte)', 'CREDENTIAL_ID') }, position: [568, 152], notes: 'Modèle Gemini Flash-Lite (le moins cher de la gamme Gemini).', notesInFlow: true } });

const iMAP_Support_Proximite = node({
  type: 'n8n-nodes-base.emailReadImap',
  version: 2.2,
  config: { name: 'IMAP Support Proximite', parameters: { format: 'resolved', options: {} }, credentials: { imap: newCredential('IMAP account', 'CREDENTIAL_ID') }, position: [-400, -176], notes: 'Surveille support@example.com (clients proximité).', notesInFlow: true }
});

const tag_Client_Size_Proximite = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: { name: 'Tag Client Size (Proximite)', parameters: { assignments: { assignments: [{ id: 'set-clientSize', name: 'clientSize', value: 'proximite', type: 'string' }, { id: 'set-clientSizeLabel', name: 'clientSizeLabel', value: 'Proximité', type: 'string' }, { id: 'set-receivingAddress', name: 'receivingAddress', value: 'support@example.com', type: 'string' }] }, includeOtherFields: true, options: {} }, position: [-176, -176], notes: 'Déduit la taille du client (proximité) à partir de la boîte de réception déclenchée.', notesInFlow: true }
});

const merge_Inbound_Mails = merge({
  version: 3.2,
  config: { name: 'Merge Inbound Mails', position: [48, -80], notes: 'Unifie les deux flux (support@ et supportdedie@) en un seul flux de traitement.', notesInFlow: true }
});

const tag_Client_Size_Grands_Comptes = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: { name: 'Tag Client Size (Grands Comptes)', parameters: { assignments: { assignments: [{ id: 'set-clientSize', name: 'clientSize', value: 'grands_comptes', type: 'string' }, { id: 'set-clientSizeLabel', name: 'clientSizeLabel', value: 'Grands Comptes', type: 'string' }, { id: 'set-receivingAddress', name: 'receivingAddress', value: 'support-grands-comptes@example.com', type: 'string' }] }, includeOtherFields: true, options: {} }, position: [-176, 16], notes: 'Déduit la taille du client (grands comptes) à partir de la boîte de réception déclenchée.', notesInFlow: true }
});

const iMAP_Support_Grands_Comptes = node({
  type: 'n8n-nodes-base.emailReadImap',
  version: 2.2,
  config: { name: 'IMAP Support Grands Comptes', parameters: { format: 'resolved', options: {} }, credentials: { imap: newCredential('IMAP account 2', 'CREDENTIAL_ID') }, position: [-400, 16], notes: 'Surveille support-grands-comptes@example.com (grands comptes).', notesInFlow: true }
});

const filter_Excluded_Mails = node({
  type: 'n8n-nodes-base.filter',
  version: 2.3,
  config: { name: 'Filter Excluded Mails', parameters: { conditions: { combinator: 'and', options: { caseSensitive: false, leftValue: '', typeValidation: 'loose', version: 2 }, conditions: [{ id: 'not-a-reply', leftValue: expr('{{ $json.headers && $json.headers[\'in-reply-to\'] ? true : false }}'), rightValue: false, operator: { type: 'boolean', operation: 'equals' } }, { id: 'not-automated-sender', leftValue: expr('{{ /noreply|no-reply|mailer-daemon|notifications@/i.test($json.from || \'\') }}'), rightValue: false, operator: { type: 'boolean', operation: 'equals' } }, { id: 'not-spam-newsletter', leftValue: expr('{{ /unsubscribe|newsletter|d.sabonner|promo/i.test($json.subject || \'\') || /unsubscribe|newsletter|d.sabonner|promo/i.test($json.text || $json.textPlain || \'\') }}'), rightValue: false, operator: { type: 'boolean', operation: 'equals' } }] }, looseTypeValidation: true, options: {} }, position: [272, -80], notes: 'Exclut spam/newsletters, expéditeurs automatiques, et réponses dans un fil déjà en cours (heuristique sur in-reply-to à affiner).', notesInFlow: true }
});

const analyze_Email_with_AI = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.9,
  config: { name: 'Analyze Email with AI', parameters: { promptType: 'define', text: expr('# Instructions\n<instructions>\n<goal>\nAnalyser un email support et retourner un objet JSON strict avec les champs summary, urgencyLevel, category et justification.\n</goal>\n\n<context>\nTu aides l\'équipe support d\'une plateforme municipale à trier ses emails.\nurgencyLevel doit valoir P1, P2 ou P3 :\n- P1 : service bloqué, usagers impactés en direct, problème de données/sécurité, ou client très mécontent avec relances répétées ou menace de résiliation.\n- P2 : à traiter dans la journée.\n- P3 : peut attendre quelques jours.\n</context>\n\n<rules>\n1. Réponds uniquement avec un objet JSON valide, sans texte autour.\n2. Champs attendus : summary (1-2 phrases), urgencyLevel (P1, P2 ou P3), category (courte étiquette), justification (1 phrase expliquant le niveau choisi).\n</rules>\n</instructions>\n\n# Email\n<email>\nDe: {{ $json.from }}\nSujet: {{ $json.subject }}\nContenu: {{ $json.text || $json.textPlain }}\n</email>'), messages: { messageValues: [{ message: 'Tu es un assistant qui aide une équipe support à trier ses emails et à répondre uniquement en JSON strict.' }] }, batching: {} }, position: [496, -80], notes: 'Appelle le LLM pour résumer le mail et déterminer urgence/catégorie. Réessayé automatiquement en cas de panne du fournisseur IA.', notesInFlow: true, retryOnFail: true, maxTries: 3, waitBetweenTries: 5000, subnodes: { model: aI_Model_Gemini } }
});

const parse_AI_Analysis = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Parse AI Analysis', parameters: { jsCode: 'const items = $input.all();\n// La chaîne IA ne renvoie que sa réponse : on récupère les champs du mail (expéditeur, taille client…) depuis le nœud de filtre.\nconst mails = $(\'Filter Excluded Mails\').all();\nreturn items.map((item, i) => {\n  const raw = (item.json.text || item.json.output || \'\').toString();\n  let parsed;\n  try {\n    const match = raw.match(/\\{[\\s\\S]*\\}/);\n    parsed = JSON.parse(match ? match[0] : raw);\n  } catch (e) {\n    parsed = {\n      urgencyLevel: \'P3\',\n      category: \'A trier\',\n      summary: \'Résumé IA indisponible (échec du parsing de la réponse).\',\n      justification: \'Analyse IA non exploitable, classée P3 par défaut pour ne pas la perdre.\'\n    };\n  }\n  return {\n    json: {\n      ...(mails[i] ? mails[i].json : {}),\n      urgencyLevel: parsed.urgencyLevel || \'P3\',\n      category: parsed.category || \'A trier\',\n      summary: parsed.summary || \'\',\n      justification: parsed.justification || \'\'\n    }\n  };\n});' }, position: [848, -80], notes: 'Parse la réponse JSON du LLM et retombe sur une classification P3 par défaut si le parsing échoue, pour ne jamais perdre un mail silencieusement.', notesInFlow: true }
});

const compute_Slack_Channel = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: { name: 'Compute Slack Channel', parameters: { assignments: { assignments: [{ id: 'set-slackChannel', name: 'slackChannel', value: expr('{{ $json.urgencyLevel === \'P1\' ? \'C0EXEMPLE01\' : $json.urgencyLevel === \'P2\' ? \'C0EXEMPLE02\' : \'C0EXEMPLE03\' }}'), type: 'string' }] }, includeOtherFields: true, options: {} }, position: [1072, -80], notes: 'Calcule le channel Slack cible selon l\'urgence (un channel par priorité). IDs des channels privés : C0EXEMPLE01 = cs-rdv-p1, C0EXEMPLE02 = cs-rdv-p2, C0EXEMPLE03 = cs-rdv-p3.', notesInFlow: true }
});

const notify_Slack_Support_Channel = node({
  type: 'n8n-nodes-base.slack',
  version: 2.7,
  config: { name: 'Notify Slack Support Channel', parameters: { select: 'channel', channelId: { __rl: true, mode: 'id', value: expr('{{ $json.slackChannel }}') }, text: expr('*{{ $json.clientSize === \'proximite\' ? \'🏘️ PROXIMITÉ\' : \'🏢 GRANDS COMPTES\' }} — Nouveau mail support {{ $json.urgencyLevel }}*\n*De:* {{ $json.from && $json.from.text ? $json.from.text : $json.from }}\n*Adresse de réception:* {{ $json.receivingAddress }} ({{ $json.clientSizeLabel }})\n*Résumé:* {{ $json.summary }}\n*Urgence:* {{ $json.urgencyLevel }} — {{ $json.justification }}\n*Lien:* (à compléter selon décision Freshdesk / lien mail)'), otherOptions: {} }, credentials: { slackApi: newCredential('Slack API', 'CREDENTIAL_ID') }, position: [1296, -80], webhookId: '00000000-0000-0000-0000-000000000000', notes: 'Poste la notification dans le channel Slack dédié. Réessayé automatiquement en cas de panne Slack.', notesInFlow: true, retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }
});

const log_History_Todo_Freshdesk_or_Sheet = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'Log History (Todo Freshdesk or Sheet)', position: [1520, -80], notes: 'Placeholder pour l\'historique (date, adresse, client, urgence, catégorie, résumé) : destination réelle (Freshdesk ou autre) à décider (point ouvert des specs).', notesInFlow: true }
});

const wf = workflow('KKkCgBZuaB9xQMEF', 'Support - Tri et notification des mails (v2)', { description: 'Brouillon de workflow triant les emails support (proximité vs grands comptes) par urgence via IA, puis notifiant le channel Slack dédié. Plusieurs éléments sont des placeholders en attente de décisions (fournisseur IA, noms de channels, historique Freshdesk).', executionOrder: 'v1', availableInMCP: true, binaryMode: 'separate', errorWorkflow: 'qxiolQ3TqUKnBt4v' });

export default wf
  .add(sticky('# Specs | Tri et notification des mails support\n\n## Contexte\nTroov reçoit les demandes clients sur deux adresses support. L\'équipe support\n(2 personnes) doit repérer rapidement les demandes urgentes et savoir de quel\ntype de client elles viennent, sans surveiller les boîtes mail en continu.\n\n## 1. Déclencheur & Livrables\n\n### Déclencheur\nUn nouveau mail arrive sur l\'une des deux adresses :\n- support@example.com → clients proximité\n- support-grands-comptes@example.com → grands comptes\n\n### Mails exclus (aucune notification)\n- Spam, newsletters, publicités\n- Réponses dans un fil de discussion déjà en cours\n- Mails automatiques (notifications d\'outils, accusés de réception, absences)\n\n### Livrable 1 : notification Slack\nPostée dans un channel dédié aux mails (distinct des channels Typeform), selon\nl\'urgence : un channel par priorité (P1, P2, P3). Le type de client\n(proximité / grands comptes) est indiqué en tête de chaque notification.\n\nLa taille du client est déduite de l\'adresse de réception.\n\n**Définition des niveaux d\'urgence**\n- **P1** : au moins un des cas suivants\n  - service bloqué (la mairie ne peut plus prendre de RDV ou gérer sa file)\n  - usagers impactés en direct\n  - problème de données ou de sécurité (perte, fuite, accès non autorisé)\n  - client très mécontent, relances répétées ou menace de résiliation\n- **P2** : à traiter dans la journée\n- **P3** : peut attendre quelques jours\n\n**Contenu de la notification**\n- Expéditeur (nom, email) et commune / organisation\n- Résumé de la demande en 1–2 phrases\n- Niveau d\'urgence et justification\n- Lien vers le mail ou le ticket d\'origine\n\n### Livrable 2 : historique pour analyse\nChaque mail traité est enregistré avec : date, adresse de réception, client,\nurgence, catégorie, résumé.\n- Si Freshdesk est conservé : informations enregistrénalyser les demandes récurrentes pour préparer de futures réponses\nautomatiques (hors périmètre de ce workflow).\n\n## 2. Écosystème technique\n\n| Outil | Rôle | Accès |\n|---|---|---|\n| Private Email (Namecheap) | Boîtes support@ et supportdedie@ | ✅ Identifiants des 2 boîtes |\n| Slack | Notifications | ✅ Admin (channels + app) |\n| Freshdesk | Ticketing, en test | ✅ Admin (API + règles) |\n| IA (analyse des mails) | Résumé, urgence, catégorie | ⏳ Fournisseur à choisir, pas de contrainte |\n| Plateforme n8n | Exécution | ✅ Budget OK, ⏳ Cloud ou auto-hébergé à choisir |\n\n## 3. Contraintes opérationnelles\n\n- **Volume** : moins de 50 mails/jour sur les deux adresses\n- **Budget IA** : pas de plafond défini, à fixer après un mois de fonctionnement\n- **Gestion des erreurs** : si un outil (IA, Slack…) est en panne, le traitement\n  est réessayé plusieurs fois, puis Noé est alerté. Aucun mail ne doit être\n  perdu ni ignoré en silence.\n- **Données sensibles** : les mails peuvent contenir des données personnelles\n  d\'usagers (noms, téléphones, motifs de RDV). Règle de traitement (envoi à\n  l\'IA, contenu affiché sur Slack) à valider en interne avant la mise en prod.\n\n## Points ouverts\n1. Freshdesk conservé ou non (détermine le point d\'entrée des mails et le lieu\n   de l\'historique)\n2. Validation RGPD interne\n3. Choix du fournisseur d\'IA\n4. Choix de l\'hébergement n8n\n5. ~~Noms des channels Slack~~ → cs-rdv-p1 / p2 / p3 (privés)\n', [], { name: 'Specs Sticky Note', width: 380, position: [-768, -400] }))
  .add(sticky('## État au 30/09 — à finaliser avant mise en prod\n\n**Testé et OK** : relève IMAP des 2 boîtes, filtre, classement Gemini (P1/P2/P3), notification dans cs-rdv-p1/p2/p3 avec type de client en tête, alerte d\'erreur à Noé.\n\n**Reste à tester**\n- Réponse dans un fil existant (en-tête in-reply-to) : ne doit pas notifier.\n- Exclusion des newsletters et des expéditeurs automatiques.\n\n**Points ouverts**\n- **Lien vers le mail / ticket** dans la notification : dépend de la décision Freshdesk.\n- **Historique (Freshdesk ou autre)** : le nœud de log est un placeholder tant que la décision n\'est pas prise.\n- **RGPD** : contenu envoyé à l\'IA et affiché sur Slack à valider en interne.\n', [], { name: 'Todo Sticky Note', color: 4, width: 380, position: [-336, -400] }))
  .add(iMAP_Support_Proximite)
  .to(tag_Client_Size_Proximite)
  .add(iMAP_Support_Grands_Comptes)
  .to(tag_Client_Size_Grands_Comptes)
  .add(tag_Client_Size_Proximite.to(merge_Inbound_Mails.input(0)))
  .add(tag_Client_Size_Grands_Comptes.to(merge_Inbound_Mails.input(1)))
  .add(merge_Inbound_Mails)
  .to(filter_Excluded_Mails
  .to(analyze_Email_with_AI)
  .to(parse_AI_Analysis)
  .to(compute_Slack_Channel)
  .to(notify_Slack_Support_Channel)
  .to(log_History_Todo_Freshdesk_or_Sheet))