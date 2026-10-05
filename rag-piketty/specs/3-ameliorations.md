# Spec | RAG Piketty : améliorations inspirées du template « RAG expert doc n8n »

> Statut : validée, construite et vérifiée (après hostile review) · Date : 2026-10-01

## Contexte
On a comparé notre RAG au template de Lucas Peyrin (importé sur n8n, `V4p2HJfzyvCKrDeb`). Trois points sont à reprendre avant le rendu du M2 :
- maintenir Supabase éveillé ;
- documenter le canevas étape par étape ;
- structurer le prompt.

Le point 4, des morceaux plus petits, viendra plus tard. Il demande d'activer la facturation Gemini.

## Déclencheur & livrables

### 1. Maintien en éveil de Supabase
- **Pourquoi** : un projet Supabase gratuit est mis en pause après 7 jours d'inactivité. Le RAG serait alors hors service si le correcteur teste le lien plus tard.
- **Quoi** : un 4e déclencheur dans le workflow `RAG Piketty`. Un *Schedule Trigger* tous les 6 jours lance un nœud Postgres (credential `Supabase Postgres`) avec `SELECT count(*) AS lignes FROM rag_piketty;`.
- Si la requête échoue (base en pause, table absente), l'exécution échoue et le workflow d'erreur existant est déclenché.
- Bonus : le résultat donne le nombre de morceaux indexés (505 attendus). On le voit dans l'historique des exécutions.

### 2. Notes pédagogiques sur le canevas
Une note par étape, en français, courte : ce que fait l'étape, et pourquoi on l'a réglée ainsi. Elle reprend nos vrais choix et nos vraies mesures.
- **Ingestion** : formulaire, extraction page par page, nettoyage (filigrane, tirets gardés), table de construction, regroupement par 2 pages et lots, boucle + pause quota (100 textes/min, ~30 000 tokens/min), vectorisation `gemini-embedding-2`, publication en une transaction.
- **Réponse** : entrées (chat hébergé + page), agent (sélection, reformulation, génération), recherche (8 morceaux, métadonnées `page`), mémoire Postgres (10 messages, session), modèle Gemini.
- **Maintien en éveil** : pourquoi tous les 6 jours.
- La note « Specs » est mise à jour : liens vers les 3 specs, liens publics (page, formulaire), points ouverts à jour.
- Le workflow `RAG Piketty Page` reçoit une note qui explique le bac à sable, `allowedOrigins` et `build.py`.
- **Pas de** notes de mise en place façon tutoriel (SQL, clés) : le setup est documenté dans les specs du repo.

### 3. Prompt structuré
Le message système de l'agent est réécrit en sections XML (`<role>`, `<goal>`, `<method>`, `<citations>`, `<special_cases>`, `<output_format>`), comme le template. **Toutes nos règles actuelles sont conservées mot pour mot sur le fond** :
- sélection et reformulation ;
- uniquement les extraits ;
- citations « extrait » (p. X) avec l'exemple concret ;
- pas de LaTeX ;
- phrase exacte « Je ne trouve pas cette information dans le livre. » ;
- mention « livre de 2013 » pour les questions sur aujourd'hui.

On ajoute une règle reprise du template : ne pas parler de l'outil ni du fonctionnement RAG dans la réponse.

## Hypothèses
- Une requête SQL passée par le pooler compte comme de l'activité pour Supabase (supposé). Le template, lui, passe par l'API REST. Si le projet est quand même mis en pause, on ajoutera un appel REST.
- L'ingestion, la page et les données en base ne sont pas modifiées.

## Critères de réussite
1. Le déclencheur « tous les 6 jours » est actif. Une exécution manuelle du nœud Postgres renvoie `lignes = 505`.
2. En ouvrant le workflow, chaque étape a sa note. Aucune note ne contient d'information fausse par rapport à ce qui tourne : modèles, tailles, tables, URLs.
3. Après la réécriture du prompt, les 3 questions de référence donnent le même comportement :
   - « Résume la thèse r > g » : citations avec pages, cartes Sources, pas de `$` ;
   - « Et aux États-Unis ? » : la conversation garde le contexte ;
   - Guez de Balzac : phrase exacte de repli.
   - Aucune réponse ne mentionne « outil », « base de données » ou « RAG ».
4. `n8ncli validate` passe, et la version en ligne correspond au fichier local.

## Points ouverts
1. Le workflow d'erreur partagé avec Troov envoie toujours un message « tri des mails ». Hors périmètre ici.
2. Point 4 (morceaux de 1000-1500 caractères) : après activation de la facturation Gemini.

## Résultats de vérification (2026-10-01)
- **Réveil** : la requête `SELECT count(*) AS lignes FROM rag_piketty;` renvoie `505`. Elle a été exécutée avec le même credential, depuis le workflow de diagnostic, puis le 2026-10-01 par l'utilisateur, sur le nœud « Compter Index » lui-même, dans l'éditeur : `lignes = 505`.
- **Notes** : placées par rapport aux positions réellement déployées (n8n réorganise les nœuds au push). Pour chaque nœud, la note la plus proche est la sienne, et il n'y a aucun chevauchement. La note « Découpage + vectorisation » couvre 4 nœuds éloignés (jusqu'à environ 350 px).
- **Prompt** : 3 séries des 3 questions de référence (exécutions 79 à 87). Sur 33 références de page, 32 sont numériques et font partie des pages renvoyées par la recherche. 1 est l'identifiant interne d'un morceau, malgré la consigne : la page la retire et n'en fait pas de carte. Aucun `$`, aucun mot interdit, phrase de repli exacte.
- **Synchronisation** : `n8ncli diff --semantic` vide pour les deux workflows.

## Constats
- `n8ncli push` régénère l'identifiant du Chat Trigger (« Chat Livre ») et du Wait (« Pause Quota ») à chaque envoi. L'URL du chat de secours n'est donc pas stable : la page utilise un webhook à chemin fixe.
- Le modèle confond parfois `page` et `id` dans les résultats de recherche (environ 1 référence sur 30). Piste pour plus tard : rendre la métadonnée plus explicite (`pages: "p. 525-526"`) à la prochaine ingestion.
