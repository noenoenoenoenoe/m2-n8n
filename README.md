# m2-n8n

Automatisation du support client avec n8n, et skills Claude Code utilisées pour les concevoir, les construire et les relire.

| Dossier | Contenu |
|---|---|
| [`n8n-workflows/`](n8n-workflows/) | Workflows n8n versionnés en TypeScript (`@n8n/workflow-sdk`), synchronisés avec l'instance via `n8ncli`. Workflow principal : **Tri Et Notification Mails Support (Test V3)** (relève IMAP → analyse d'urgence par IA → notification Slack par priorité). |
| [`claude-skills/`](claude-skills/) | Skills Claude Code en français, selon une méthode **10 / 80 / 10** : `interview` (avant de construire), *doubt-driven dev* (à venir), `hostile-review` (avant de déclarer terminé). |

## Données anonymisées

Les workflows publiés ici sont une **copie anonymisée** : les adresses mail, IDs Slack, IDs de credentials, IDs et chemins de webhooks et l'ID de projet n8n ont été remplacés par des valeurs d'exemple (`example.com`, `C0EXEMPLE01`, `CREDENTIAL_ID`…). Aucun secret (token, mot de passe, clé API) n'est versionné.

Ces fichiers servent à la lecture. Pour les réutiliser, remplacer les valeurs d'exemple par les vôtres et connecter vos propres credentials dans n8n.
