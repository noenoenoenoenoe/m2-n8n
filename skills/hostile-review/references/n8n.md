# Hostile review d'un workflow n8n

À lire en plus de SKILL.md quand le livrable est un workflow n8n, surtout dans un repo géré avec `n8ncli`. À transmettre au relecteur dans la partie « Moyens de vérifier » du brief.

## Relire ce qui tourne vraiment

- **Ne pas se fier à la copie locale.** Récupérer la version déployée dans un dossier temporaire (`n8ncli pull <id> --force` depuis une copie du dossier `n8n/`), puis la comparer au fichier local. Un écart est un défaut Important.
- **Ne pas se fier à « Push complete ».** `n8ncli` peut afficher ce message alors que le workflow a été ignoré pour conflit, ou que l'envoi n'a rien enregistré. Seule une relecture de la version déployée prouve le déploiement.
- **Vérifier l'état d'activation** : un workflow à déclencheur automatique (IMAP, planification, webhook) doit être activé, sinon il ne tourne pas.

## Lire les exécutions réelles

- Utiliser l'API REST de n8n (`GET /api/v1/executions?workflowId=<id>` puis `GET /api/v1/executions/<id>?includeData=true`) avec la clé API configurée pour `n8ncli`. Selon l'instance, les commandes `n8ncli logs` / `n8ncli execution` peuvent ne pas fonctionner (erreur MCP `get_execution not found`).
- Pour chaque exécution : quel nœud a produit combien d'éléments, où ça s'est arrêté, quelle erreur.
- **Relancer une exécution (`/retry`) a des effets de bord** (messages envoyés, données écrites) : c'est une vérification à proposer, pas à exécuter.

## Points à vérifier nœud par nœud

- **Champs perdus en route** : chaque expression `{{ $json.x }}` d'un nœud doit correspondre à un champ réellement présent dans la sortie du nœud précédent. Les nœuds IA de type chaîne (LLM Chain) ne renvoient que la réponse du modèle : les champs d'origine disparaissent.
- **Types inattendus** : un champ objet affiché comme texte donne `[object Object]` (ex. `from` du déclencheur IMAP : utiliser `from.text`).
- **Filtres** : que devient un élément qui ne passe pas ? Est-ce voulu, et est-ce tracé ? Tester mentalement chaque condition avec une valeur vide ou absente.
- **Réponses d'IA inexploitables** : que se passe-t-il si le JSON du modèle est invalide ou incomplet ? Il faut un repli, jamais une perte silencieuse.
- **Destinations** : canaux Slack visés par ID pour les canaux privés, bot du credential utilisé bien invité (sinon `channel_not_found`) ; adresses, feuilles et tables existantes.
- **Credentials** : chaque nœud qui en a besoin en a un. Rien d'écrit en dur dans les paramètres (tokens, mots de passe).
- **Pannes** : réessais configurés sur les nœuds externes (IA, Slack, API) ; workflow d'erreur branché (`errorWorkflow`) et qui prévient bien quelqu'un.
- **Doublons** : un même événement relevé deux fois (réactivation, relève IMAP, webhook rejoué) produit-il deux notifications ou deux écritures ?
- **Notes du workflow** : les sticky notes « Specs » et « À finaliser » reflètent-elles l'état réel ? Une note fausse est un défaut Mineur, ou Important si elle cache un point ouvert.

## Données sensibles

- Quelles données partent vers le modèle d'IA et vers les outils de sortie (Slack, tableur) ? Est-ce conforme à ce que la spec autorise ?
- Les canaux de sortie qui contiennent des données personnelles sont-ils privés ?
