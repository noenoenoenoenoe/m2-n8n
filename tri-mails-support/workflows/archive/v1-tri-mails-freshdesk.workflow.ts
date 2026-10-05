const webhook_R_ception_ticket_Freshdesk = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Webhook - Réception ticket Freshdesk', parameters: { httpMethod: 'POST', path: 'freshdesk-ticket', options: {} }, position: [-240, -352], webhookId: '00000000-0000-0000-0000-000000000000' }
});

const set_Normaliser_donn_es_ticket = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: { name: 'Set - Normaliser données ticket', parameters: { options: {} }, position: [-16, -352] }
});

const filtre_Exclure_mails_automatiques = node({
  type: 'n8n-nodes-base.filter',
  version: 2.3,
  config: { name: 'Filtre - Exclure mails automatiques', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 }, conditions: [{ id: '46814872-2a75-4bf4-916c-c3dc875fa057', leftValue: '', rightValue: '', operator: { type: 'string', operation: 'equals', name: 'filter.operator.equals' } }], combinator: 'and' }, options: {} }, position: [208, -352] }
});

const iA_Analyser_mail = node({
  type: '@n8n/n8n-nodes-langchain.informationExtractor',
  version: 1.2,
  config: { name: 'IA - Analyser mail', parameters: { options: {} }, position: [432, -352] }
});

const filtre_Exclure_spams = node({
  type: 'n8n-nodes-base.filter',
  version: 2.3,
  config: { name: 'Filtre - Exclure spams', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 }, conditions: [{ id: '0180357d-4c93-4fd8-aa7d-42f601e5f826', leftValue: '', rightValue: '', operator: { type: 'string', operation: 'equals', name: 'filter.operator.equals' } }], combinator: 'and' }, options: {} }, position: [784, -352] }
});

const slack_Notifier_channel_mails = node({
  type: 'n8n-nodes-base.slack',
  version: 2.7,
  config: { name: 'Slack - Notifier channel mails', parameters: { otherOptions: {} }, position: [1008, -352], webhookId: '00000000-0000-0000-0000-000000000000' }
});

const freshdesk_Renseigner_urgence_et_cat_gorie = node({
  type: 'n8n-nodes-base.freshdesk',
  version: 1,
  config: { name: 'Freshdesk - Renseigner urgence et catégorie', parameters: { operation: 'update', updateFields: {} }, position: [1232, -352] }
});

const wf = workflow('1522NJ1YFdzW7ZzL', 'Support - Tri et notification des mails', { executionOrder: 'v1', binaryMode: 'separate', timeSavedMode: 'fixed', errorWorkflow: 'qxiolQ3TqUKnBt4v', callerPolicy: 'workflowsFromSameOwner', availableInMCP: true });

export default wf
  .add(webhook_R_ception_ticket_Freshdesk)
  .to(set_Normaliser_donn_es_ticket)
  .to(filtre_Exclure_mails_automatiques)
  .to(iA_Analyser_mail)
  .to(filtre_Exclure_spams)
  .to(slack_Notifier_channel_mails)
  .to(freshdesk_Renseigner_urgence_et_cat_gorie)
  .add(sticky('# Specs | Tri et notification des mails support\n\n## Contexte\nTroov reçoit les demandes clients sur deux adresses support. L\'équipe support\n(2 personnes) doit repérer rapidement les demandes urgentes et savoir de quel\ntype de client elles viennent, sans surveiller les boîtes mail en continu.\n\n## 1. Déclencheur & Livrables\n\n### Déclencheur\nUn nouveau mail arrive sur l\'une des deux adresses :\n- support@example.com → clients proximité\n- support-grands-comptes@example.com → grands comptes\n\n### Mails exclus (aucune notification)\n- Spam, newsletters, publicités\n- Réponses dans un fil de discussion déjà en cours\n- Mails automatiques (notifications d\'outils, accusés de réception, absences)\n\n### Livrable 1 : notification Slack\nPostée dans un channel dédié aux mails (distinct des channels Typeform), selon\nla taille du client × l\'urgence :\n\n| | P1 | P2 | P3 |\n|---|---|---|---|\n| Proximité | channel dédié | channel dédié | channel dédié |\n| Grands comptes | channel dédié | channel dédié | channel dédié |\n\nLa taille du client est déduite de l\'adresse de réception.\n\n**Définition des niveaux d\'urgence**\n- **P1** : au moins un des cas suivants\n  - service bloqué (la mairie ne peut plus prendre de RDV ou gérer sa file)\n  - usagers impactés en direct\n  - problème de données ou de sécurité (perte, fuite, accès non autorisé)\n  - client très mécontent, relances répétées ou menace de résiliation\n- **P2** : à traiter dans la journée\n- **P3** : peut attendre quelques jours\n\n**Contenu de la notification**\n- Expéditeur (nom, email) et commune / organisation\n- Résumé de la demande en 1–2 phrases\n- Niveau d\'urgence et justification\n- Lien vers le mail ou le ticket d\'origine\n\n### Livrable 2 : historique pour analyse\nChaque mail traité est enregistré avec : date, adresse de réception, client,\nurgence, catégorie, résumé.\n- Si Freshdesk est conservé : informations enregistrées sur le ticket Freshdesk\n- Sinon : dans un tableau\nObjectif : analyser les demandes récurrentes pour préparer de futures réponses\nautomatiques (hors périmètre de ce workflow).\n\n## 2. Écosystème technique\n\n| Outil | Rôle | Accès |\n|---|---|---|\n| Private Email (Namecheap) | Boîtes support@ et supportdedie@ | ✅ Identifiants des 2 boîtes |\n| Slack | Notifications | ✅ Admin (channels + app) |\n| Freshdesk | Ticketing, en test | ✅ Admin (API + règles) |\n| IA (analyse des mails) | Résumé, urgence, catégorie | ⏳ Fournisseur à choisir, pas de contrainte |\n| Plateforme n8n | Exécution | ✅ Budget OK, ⏳ Cloud ou auto-hébergé à choisir |\n\n## 3. Contraintes opérationnelles\n\n- **Volume** : moins de 50 mails/jour sur les deux adresses\n- **Budget IA** : pas de plafond défini, à fixer après un mois de fonctionnement\n- **Gestion des erreurs** : si un outil (IA, Slack…) est en panne, le traitement\n  est réessayé plusieurs fois, puis Noé est alerté. Aucun mail ne doit être\n  perdu ni ignoré en silence.\n- **Données sensibles** : les mails peuvent contenir des données personnelles\n  d\'usagers (noms, téléphones, motifs de RDV). Règle de traitement (envoi à\n  l\'IA, contenu affiché sur Slack) à valider en interne avant la mise en prod.\n\n## Points ouverts\n1. Freshdesk conservé ou non (détermine le point d\'entrée des mails et le lieu\n   de l\'historique)\n2. Validation RGPD interne\n3. Choix du fournisseur d\'IA\n4. Choix de l\'hébergement n8n\n5. Noms des 6 channels Slack dédiés aux mails\n', [], { name: 'Sticky Note', width: 368, position: [-256, -736] }))