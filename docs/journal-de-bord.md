# Journal de bord

Une entrée par surprise ou décision, pas par action.

## 2026-09-29 — Fournisseur d'IA : Gemini Flash-Lite
- **Constat** : il fallait un modèle pour résumer chaque mail et en estimer l'urgence, avec moins de 50 mails par jour.
- **Cause** : pas de contrainte de fournisseur, budget à fixer après un mois.
- **Décision** : Gemini Flash-Lite, le moins cher de la gamme Gemini, suffisant pour une classification en trois niveaux.

## 2026-09-30 — 3 channels Slack par priorité au lieu de 6
- **Constat** : la spec prévoyait un channel par combinaison taille de client × priorité (6 channels).
- **Cause** : l'équipe agit d'abord selon l'urgence ; le type de client est une information, pas un critère de tri.
- **Décision** : 3 channels privés (`cs-rdv-p1`, `cs-rdv-p2`, `cs-rdv-p3`), avec le type de client en tête de chaque message.

## 2026-09-30 — Un push qui affiche « succès » sans rien enregistrer
- **Constat** : `n8ncli push` affichait « UPDATED / Push complete », mais l'instance gardait l'ancienne version. Le statut local disait ensuite que tout était à jour, et les push suivants ne prévoyaient plus rien.
- **Cause** : vérifiée. Avec seulement l'accès MCP, l'envoi n'était pas enregistré ; ensuite, des conflits détectés étaient ignorés en silence (« Skipping » affiché au-dessus de « Push complete »).
- **Décision** : clé API REST ajoutée à `n8ncli` ; chaque push est désormais vérifié en relisant la version déployée.

## 2026-09-30 — Credentials connectés dans l'interface, invisibles pour l'outil
- **Constat** : les credentials IMAP, Gemini et Slack avaient été connectés dans n8n, mais `n8ncli status` indiquait qu'il n'y avait rien à récupérer. Un push depuis la copie locale les aurait effacés.
- **Cause** : le statut ne compare que l'état local à la dernière synchronisation, pas au contenu réel de l'instance.
- **Décision** : toujours faire `n8ncli diff --semantic` avant un push, et repartir de la version déployée si elle a changé.

## 2026-09-30 — Champs du mail perdus après l'analyse IA
- **Constat** : lors des premiers tests, le type de client et l'expéditeur étaient vides dans la notification.
- **Cause** : vérifiée dans les exécutions. Le nœud IA (LLM Chain) ne renvoie que la réponse du modèle ; les champs du mail disparaissent.
- **Décision** : le nœud qui lit la réponse de l'IA récupère les champs du mail depuis le nœud de filtre précédent.

## 2026-09-30 — « De : [object Object] » dans Slack
- **Constat** : l'expéditeur s'affichait `[object Object]`.
- **Cause** : le déclencheur IMAP fournit `from` sous forme d'objet.
- **Décision** : afficher `from.text`.

## 2026-09-30 — `channel_not_found` sur les channels privés
- **Constat** : Slack refusait l'envoi, d'abord avec les noms des channels, puis avec leurs IDs.
- **Cause** : vérifiée. Le bot invité dans les channels n'était pas celui du credential utilisé par le workflow.
- **Décision** : channels visés par ID, et bon bot invité dans les 3 channels. Les 3 notifications de test sont ensuite arrivées.

## 2026-09-30 — Alerte en cas de panne : réutiliser l'existant
- **Constat** : la spec demandait que Noé soit alerté en cas de panne.
- **Cause** : un workflow d'erreur (« Support - Alerte erreurs », message Slack privé) existait déjà, dans la première version faite à la main.
- **Décision** : il est branché comme workflow d'erreur de la V3. Il s'est déclenché comme prévu lors des échecs Slack du 30/09.
