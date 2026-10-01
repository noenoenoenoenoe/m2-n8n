# Spec | Tri et notification des mails support

> Statut : en test — validée le 29/09, mise à jour le 30/09 · Workflow : « Support - Tri et notification des mails (v2) »

## Contexte
Troov reçoit les demandes clients sur deux adresses support. L'équipe support (2 personnes) doit repérer rapidement les demandes urgentes et savoir de quel type de client elles viennent, sans surveiller les boîtes mail en continu.

## Déclencheur & livrables

### Déclencheur
Un nouveau mail arrive sur l'une des deux adresses :
- support@example.com → clients proximité
- support-grands-comptes@example.com → grands comptes

La taille du client est déduite de l'adresse de réception.

### Cas exclus (aucune notification)
- Spam, newsletters, publicités
- Réponses dans un fil de discussion déjà en cours
- Mails automatiques (notifications d'outils, accusés de réception, absences)

### Livrable 1 : notification Slack
Postée dans un channel dédié aux mails (distinct des channels Typeform), selon l'urgence : **un channel privé par priorité** (`cs-rdv-p1`, `cs-rdv-p2`, `cs-rdv-p3`). Le type de client (proximité / grands comptes) est indiqué en tête de chaque notification.

**Niveaux d'urgence**
- **P1** : au moins un des cas suivants
  - service bloqué (la mairie ne peut plus prendre de RDV ou gérer sa file)
  - usagers impactés en direct
  - problème de données ou de sécurité (perte, fuite, accès non autorisé)
  - client très mécontent, relances répétées ou menace de résiliation
- **P2** : à traiter dans la journée
- **P3** : peut attendre quelques jours

**Contenu de la notification**
- Expéditeur (nom, email) et commune / organisation
- Résumé de la demande en 1–2 phrases
- Niveau d'urgence et justification
- Lien vers le mail ou le ticket d'origine

### Livrable 2 : historique pour analyse
Chaque mail traité est enregistré avec : date, adresse de réception, client, urgence, catégorie, résumé. Objectif : analyser les demandes récurrentes pour préparer de futures réponses automatiques (hors périmètre de ce workflow). Destination : Freshdesk s'il est conservé, sinon à choisir.

## Écosystème technique

| Outil | Rôle | Accès |
|---|---|---|
| Private Email (Namecheap) | Boîtes support@ et supportdedie@ (relève IMAP) | ✅ Identifiants des 2 boîtes |
| Slack | Notifications (3 channels privés) | ✅ Admin (channels + app) |
| Google Gemini Flash-Lite | Résumé, urgence, catégorie | ✅ Choisi pour son coût |
| Freshdesk | Ticketing, en test | ✅ Admin (API + règles) |
| n8n Cloud | Exécution | ✅ Instance en place, clé API REST configurée |

## Contraintes opérationnelles
- **Volume** : moins de 50 mails/jour sur les deux adresses.
- **Budget IA** : pas de plafond défini, à fixer après un mois de fonctionnement.
- **Gestion des erreurs** : si un outil (IA, Slack…) est en panne, le traitement est réessayé plusieurs fois, puis Noé est alerté par le workflow d'erreur « Support - Alerte erreurs ». Aucun mail ne doit être perdu ni ignoré en silence ; une réponse d'IA inexploitable est classée P3 par défaut.
- **Données sensibles** : les mails peuvent contenir des données personnelles d'usagers (noms, téléphones, motifs de RDV). Règle de traitement (envoi à l'IA, contenu affiché sur Slack) à valider en interne avant la mise en prod. Les channels de notification sont privés.

## Simplifications
- **Retenues** : 3 channels (un par priorité) au lieu de 6 (taille × priorité), le type de client étant affiché dans le message ; réutilisation du workflow d'erreur existant ; historique reporté tant que la décision Freshdesk n'est pas prise.
- **Écartées** : aucune pour l'instant.

## Critères de réussite

| # | Entrée | Résultat attendu | Statut (30/09) |
|---|---|---|---|
| 1 | Mail urgent sur support@ (« plus aucune prise de RDV possible ») | Notification P1 dans `cs-rdv-p1`, en-tête PROXIMITÉ | ✅ |
| 2 | Mail sur supportdedie@ à traiter dans la journée | Notification P2 dans `cs-rdv-p2`, en-tête GRANDS COMPTES | ✅ |
| 3 | Question non urgente sur support@ | Notification P3 dans `cs-rdv-p3`, en-tête PROXIMITÉ | ✅ |
| 4 | Réponse (« Répondre ») à un mail déjà reçu | Aucune notification | ⏳ à tester |
| 5 | Newsletter ou expéditeur automatique (noreply) | Aucune notification | ⏳ à tester |
| 6 | Slack indisponible ou erreur d'envoi | Alerte d'erreur reçue par Noé | ✅ (constaté le 30/09) |

## Points ouverts
1. Freshdesk conservé ou non : détermine le lien vers le ticket dans la notification et le lieu de l'historique.
2. Validation RGPD interne.
3. Hébergement n8n définitif (Cloud ou auto-hébergé).
4. ~~Choix du fournisseur d'IA~~ → Gemini Flash-Lite.
5. ~~Noms des channels Slack~~ → `cs-rdv-p1` / `p2` / `p3` (privés, visés par ID).
