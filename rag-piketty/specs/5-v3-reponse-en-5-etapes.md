# Spec | RAG Piketty V3 : workflow d'answering en 5 étapes (contexte, routing, recherche hybride, reranking, génération)

> Statut : validée (trigger 1a confirmé) · Date : 2026-10-01

## Contexte
La V2 répond avec un agent LangChain : il décide seul quand chercher, sa recherche est vectorielle uniquement, et il met de 5 à 60 s à répondre. L'ingestion V2 stocke déjà, pour chaque chunk (= une section du livre), un vecteur **et** des mots-clés (`rag_piketty_v2_chunks.mots_cles`). Objectif : un **workflow d'answering séparé**, en étapes explicites, **juste et le plus rapide possible**, qui exploite ces mots-clés.

## Déclencheur & livrables

### Déclencheur
`POST /webhook/rag-piketty-v3-ask` avec `{ sessionId, chatInput }` → `{ output }`. Même format que V1 et V2. La page de comparaison reçoit un 3e bouton **V3**.

### Cas exclus
- Pas de modification de l'ingestion V2, ni de V1 / V2 (workflows, tables, pages).
- Pas d'agent LangChain : des nœuds simples et des appels directs à Gemini.

### Livrables

#### Workflow n8n `RAG Piketty V3 Answering`

| # | Étape | Nœuds | Détail |
|---|---|---|---|
| 0 | **Trigger** | Webhook POST | `sessionId`, `chatInput` |
| 1 | **Contexte** | Set « Configuration » + Postgres | Configuration réunie en un seul endroit : `topK_candidats = 20`, `topK_final = 5`, `poids_vecteurs = 0.6`, `poids_mots_cles = 0.4`, modèle `gemini-flash-lite-latest`. Historique : les **10 derniers messages** de la session, lus dans `rag_piketty_v3_chat` |
| 2 | **Routing** | HTTP Gemini Flash-Lite (sortie JSON) + Code de contrôle | 1 appel, qui renvoie `type` (`livre` / `salutation` / `hors_sujet`), une **requête autonome** reformulée à partir de l'historique, des `mots_cles` et des `filtres` (`partie` / `chapitre` s'ils sont cités). Si le JSON est invalide, repli sur la question brute et type `livre`. `salutation` et `hors_sujet` vont directement à la génération, sans recherche |
| 3 | **Recherche hybride** | HTTP Gemini (embedding de la requête, `RETRIEVAL_QUERY`) + Postgres | Une requête SQL avec deux classements de 20 candidats chacun : proximité de sens (`embedding <=> vecteur`) et mots-clés (`mots_cles @@ websearch_to_tsquery('french', …)`, `ts_rank`). Fusion pondérée des rangs : `score = 0.6 / (60 + rang_vecteur) + 0.4 / (60 + rang_mots_cles)`. Filtres éventuels de partie ou de chapitre. Renvoie les 20 meilleurs avec `section`, `chapitre`, `page` |
| 4 | **Reranking** | HTTP Gemini Flash-Lite (sortie JSON) + Code | 1 appel : le modèle note la pertinence de chaque candidat pour la question (0-10). On garde les **5 meilleurs**. Si le JSON est invalide, repli sur l'ordre de la recherche hybride |
| 5 | **Génération** | HTTP Gemini Flash-Lite + Postgres | Mêmes règles que V1 et V2 : réponse uniquement à partir des extraits, citations « extrait » (p. X) avec la page du chunk, phrase exacte « Je ne trouve pas cette information dans le livre. », mention 2013 pour « aujourd'hui », pas de LaTeX. La question et la réponse sont enregistrées dans `rag_piketty_v3_chat`. Réponse `{ output }` |

- Chaque étape mesure sa **durée** (horodatage dans les données de l'exécution), pour trouver ce qui ralentit.
- Les notes sur le canevas nomment les 5 étapes.

#### Page de comparaison
Un 3e bouton **V3 · pipeline** dans `interface/rag-piketty-v2.html`, avec sa propre session.

## Écosystème technique

| Outil | Rôle | Accès |
|---|---|---|
| n8n Cloud + `n8ncli` | Workflow V3 | ✅ |
| Supabase Postgres | Lecture de `rag_piketty_v2_chunks`, écriture de `rag_piketty_v3_chat` | ✅ |
| Gemini (credential existant) | `gemini-embedding-2` (requête), `gemini-flash-lite-latest` (routing, reranking, génération) | ✅ niveau gratuit |

## Contraintes opérationnelles
- **Rapidité** : le plus rapide possible, mesuré étape par étape. Chaque question coûte **3 appels de génération** (routing, reranking, génération) et **1 embedding**.
- **Quota** : niveau gratuit, **15 appels de génération par minute** (mesuré). Le maximum est donc d'environ 5 questions par minute, tous workflows confondus.
- **Erreurs** : un 429 renvoie une erreur lisible à la page, qui propose de réessayer. Le workflow d'erreur existant est branché.
- **Données** : aucune donnée sensible.

## Simplifications
- **Retenues** : pas d'agent ; ingestion réutilisée telle quelle ; configuration réunie dans un seul nœud Set.
- **Écartées** :
  - le reranking fusionné avec la génération (on garde 5 étapes distinctes, plus lisibles) ;
  - le routing par règles (choix utilisateur : routing par Gemini) ;
  - un service de reranking dédié (Jina, Cohere).

## Hypothèses
- Gemini Flash-Lite accepte une sortie JSON imposée (`responseMimeType: application/json`) via l'API REST.
- `websearch_to_tsquery('french', …)` sur la requête reformulée trouve des mots-clés présents dans `mots_cles` (testé : « première loi fondamentale » remonte la bonne section).
- La recherche SQL exacte sur 217 vecteurs de 3072 dimensions répond en moins de 300 ms.
- Trigger : V3 dans la page de comparaison (confirmé par l’utilisateur).

## Critères de réussite
1. **A, B, C, en 3 séries**, sessions neuves : V3 fait **au moins aussi bien que la V1** sur les 3 critères de la spec V2 (bonne section, pages correctes et resserrées, réponse au moins aussi précise), jugés à la main.
2. **Suivi** : « Résume la thèse r > g » puis « Et aux États-Unis ? » → la requête reformulée du routing parle des États-Unis **et** de r > g ou des inégalités, et la réponse reste dans le sujet.
3. **Hors livre** : Guez de Balzac → type `hors_sujet` ou recherche sans résultat pertinent → phrase de repli exacte.
4. **Salutation** : « Bonjour » → réponse courte, **sans** recherche ni reranking (vérifié dans l'exécution).
5. **Rapidité** : durée totale et durée par étape mesurées sur les questions du critère 1. Elles sont présentées à côté des durées V1 et V2 (même mesure : temps de réponse HTTP).
6. **Robustesse** : JSON de routing ou de reranking invalide (simulé) → repli prévu, réponse quand même produite.
7. **Page** : le bouton V3 envoie à `/rag-piketty-v3-ask` avec sa propre session ; V1 et V2 ne changent pas.

## Points ouverts
1. ~~Choix du trigger~~ : page de comparaison (confirmé).
2. Poids 0,6 / 0,4 et nombre de candidats (20 → 5) : valeurs de départ, à ajuster après les mesures.
3. Augmentation (avec le prof) : hors périmètre.

---

## Avenant 1 (2026-10-01) : rapidité (choix utilisateur : points 1, 3, 5, 6)

> Statut : brouillon, à valider.

### Mesures de départ (exécutions 913 à 922)
Question complète : ~8 s (pic 17 s). Reranking ~2,2 s (il écrit ~550 tokens), génération 1,3 à 2,7 s (une fois 11 s), démarrage du moteur de code ~1,7 s, enregistrement de l'historique 0,3 s avant la réponse.

### Changements
1. **Reranking plus court** : le modèle renvoie **seulement la liste ordonnée des 5 identifiants retenus**, et plus une note pour chacun des 20 candidats. Les extraits envoyés au reranking **restent à 1 500 caractères** : les réduire risquerait d'aggraver le cas C, déjà mal classé faute de texte. Le repli ne change pas.
2. **Réponse avant l'enregistrement de l'historique** : l'enregistrement se fait après l'envoi de la réponse, ou en parallèle, et ne retarde plus la page.
3. **Pics de latence** : délai maximum sur les appels Gemini (routing, reranking : 8 s ; génération : 15 s) et **1 relance automatique**. Si la génération échoue encore, message d'erreur lisible (comportement actuel de la page).
4. **Streaming de la réponse** :
   - la **génération** passe dans un nœud **AI Agent sans outil** (`enableStreaming`), avec le modèle `gemini-flash-lite-latest` et le même prompt. Les extraits et l'historique sont donnés dans le message ;
   - le webhook `POST /rag-piketty-v3-ask` passe en mode **streaming** ;
   - les branches **salutation / hors sujet** répondent elles aussi en flux (réponse fixe) ;
   - **page de comparaison** : la V3 affiche le texte au fur et à mesure. Si la réponse n'est pas un flux (erreur, ancien format), elle retombe sur la lecture JSON actuelle. V1 et V2 ne changent pas.
   - Les durées par étape ne sont plus renvoyées à la page. Elles restent lisibles dans les exécutions n8n.

### Critères de réussite ajoutés
- **R1** : sur A, B, C (1 série), durée HTTP **totale** médiane ≤ 6 s, et **premier texte affiché** en ≤ 4,5 s (mesuré depuis l'envoi de la question jusqu'au premier fragment reçu).
- **R2** : justesse inchangée sur A et B (bonne section citée). C est suivi, mais n'est pas bloquant (point ouvert existant).
- **R3** : « Bonjour » et la question hors livre répondent toujours, en flux, sans recherche.
- **R4** : dans la page, le texte V3 s'affiche progressivement (au moins 2 fragments reçus). Les cartes Sources apparaissent une fois la réponse complète. V1 et V2 inchangées.
- **R5** : un appel Gemini qui dépasse son délai est relancé une fois (vérifié par simulation ou dans une exécution).

### Points ouverts
- Le nœud AI Agent sans outil ajoute peut-être un léger surcoût par rapport à l'appel HTTP direct : à mesurer (R1).
- Le délai de démarrage du moteur de code (~1,7 s) reste en place (point 2 non retenu).

---

## Avenant 2 (2026-10-01) : rapidité, suite (choix utilisateur : options 2, 3, 4)

> Statut : validée.

### Pourquoi
Après l'avenant 1, le premier texte arrive en 8 à 19 s, et jusqu'à 36 s quand Gemini est lent. Causes vérifiées : latence très variable de Gemini (niveau gratuit), délai de 8 s + relance qui double l'attente, ~1,7 s de démarrage du moteur de code (parfois deux fois). Cause supposée : la génération via l'Agent est plus lente que l'appel HTTP direct.

### Changements
1. **Délais courts, sans relance** :
   - Routing : délai de **5 s**, sans relance. Au-delà, repli sur la question brute (type `livre`, mots-clés = question).
   - Reranking : délai de **4 s**, sans relance. Au-delà, repli sur l'ordre de la recherche hybride.
   - Les replis existants (« continuer en cas d'erreur ») sont conservés.
2. **Génération : on mesure, puis on choisit**.
   - Mesure : la même question (A) **3 fois** avec la génération **Agent en streaming** (actuelle), puis 3 fois avec la génération **HTTP directe, sans streaming**. Sessions neuves, questions espacées de 20 s, mesures prises au même moment.
   - Règle de décision, fixée avant la mesure : si l'HTTP est **plus rapide d'au moins 1,5 s en médiane** sur le **temps total**, on revient à l'HTTP sans streaming. La page garde la lecture des deux formats. Sinon, on garde l'Agent avec streaming.
3. **Plus aucun nœud Code** dans le workflow : « Lire Routing », « Preparer Reranking » et « Lire Reranking » deviennent des nœuds **Set** dont les champs sont calculés par des expressions. La logique ne change pas, y compris les replis.

### Critères de réussite ajoutés
- **V1** : les 10 cas de robustesse (JSON invalide, erreur 429, échec réseau, identifiants inventés, aucun candidat) donnent **le même résultat** avec les expressions qu'avec le code actuel (même harnais de test, rejoué sur les expressions déployées).
- **V2** : aucune exécution ne contient de nœud Code, et aucun nœud ne prend plus de 200 ms hors appels Gemini, embedding et SQL.
- **V3** : un délai dépassé (simulé avec un délai minuscule sur un appel de test) déclenche le repli **sans relance** (1 seul essai visible dans l'exécution).
- **V4** : la mesure Agent / HTTP est faite et la règle de décision appliquée. Les chiffres sont notés au journal.
- **V5** : justesse inchangée sur A et B (bonne section citée), après les changements.

### Points ouverts
- L'objectif « premier texte ≤ 4,5 s » de l'avenant 1 reste dépendant de la latence de Gemini en niveau gratuit. On mesure ce qu'on obtient sans le promettre.
