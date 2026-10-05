# Interview d'un workflow n8n

À lire en plus de SKILL.md quand l'idée est un workflow n8n, surtout dans un repo géré avec `n8ncli`.

## Avant la première question

- Lister les workflows existants (`n8n/workflows/`, y compris les sous-dossiers) : un workflow proche existe peut-être déjà et peut être copié ou étendu.
- Lire les specs précédentes (`specs/`) et les sticky notes « Specs » des workflows existants.
- Repérer les **credentials déjà connectés** (références `newCredential(...)` dans les fichiers) et le **workflow d'erreur** existant (réglage `errorWorkflow`) : les réutiliser vaut mieux que d'en créer.

## Questions propres à n8n

Les ajouter aux thèmes de SKILL.md quand elles changent la construction.

**Déclencheur**
- Quel type : webhook (l'outil source appelle n8n), relève périodique (IMAP, planification), déclenchement manuel ?
- Pour une relève : à quelle fréquence ? Que faire des éléments déjà traités (marquer comme lu, dédoublonner) ?
- Le même événement peut-il arriver deux fois ? Si oui, que doit-il se passer ?

**Données**
- À quoi ressemble concrètement un élément entrant ? Demander un exemple réel (mail, payload, ligne de tableau).
- Quels champs sont indispensables à la sortie ? D'où vient chacun ?

**IA** (si l'idée en contient)
- Qu'est-ce que l'IA décide exactement ? Une règle simple suffirait-elle ?
- Quel fournisseur et quel budget ? Quelles données partent vers le modèle (RGPD) ?
- Que faire si la réponse de l'IA est inexploitable ? (Par défaut : classement de repli, jamais de perte silencieuse.)

**Sorties**
- Où va le résultat : quel outil, quel canal, quelle personne ? Canal public ou privé ?
- Faut-il garder un historique ? Où (outil existant, Google Sheet, table n8n) ?

**Pannes et exploitation**
- Qui est prévenu en cas d'échec ? Réutiliser le workflow d'erreur existant si possible.
- Combien de réessais avant d'alerter ?
- Instance : n8n Cloud ou auto-hébergée ? Le workflow doit-il tourner en continu (activé) ?

## Leviers de simplification propres à n8n

- **Un nœud natif** plutôt qu'un nœud Code, quand il existe.
- **Un seul workflow** tant qu'aucune partie n'est réutilisée ailleurs ; pas de sous-workflows par principe.
- **Des règles (nœud Filter / If)** avant un modèle d'IA.
- **Un Google Sheet ou une table n8n** comme historique, avant d'intégrer un outil de ticketing.
- **Un déclenchement manuel** pour une première version, puis l'automatique une fois le résultat validé.
- **Réutiliser les credentials et le workflow d'erreur** déjà en place.

## Pièges connus à intégrer dans la spec

Retours d'expérience, à transformer en critères de réussite ou en points ouverts :
- **Nœuds IA de type chaîne (LLM Chain)** : ils ne renvoient que la réponse du modèle. Les champs d'origine (expéditeur, métadonnées) doivent être récupérés depuis un nœud précédent.
- **Déclencheur IMAP** : le champ `from` est un objet. Utiliser `from.text` pour l'afficher.
- **Slack, canaux privés** : viser le canal par son **ID** (commence par `C`) et inviter le **bot du credential utilisé** dans chaque canal. Sinon Slack renvoie `channel_not_found`.
- **Réponses dans un fil de mails** : se détectent par l'en-tête `in-reply-to`, à valider avec un vrai « Répondre ».

## Où enregistrer la spec

- Fichier : `specs/AAAA-MM-JJ-<nom-du-workflow>.md` à la racine du repo des workflows, commité après validation.
- Une fois le workflow construit, reprendre la spec dans une sticky note **« Specs »** du workflow, pour qu'elle soit visible dans n8n.
