# Spec | RAG Piketty

> Statut : validée, construite (V1) · Date : 2026-09-30 · Mise à jour : quota gratuit Gemini (ingestion par lots)

## Contexte
Exercice de M2. On construit de zéro, dans n8n, un RAG complet sur *Le Capital au XXIe siècle* de Thomas Piketty. Le workflow doit montrer clairement chaque étape d'un RAG. Côté ingestion : extraction, cleaning, chunking, augmentation, vectorisation. Côté réponse : input, sélection, recherche, (reranking), génération. Rendu attendu dans moins d'une heure : on vise le plus simple qui fonctionne.

## Déclencheur & livrables

### Déclencheurs
- **On form submission** (ingestion) : envoi manuel d'un PDF, rarement (une fois par livre).
- **When chat message received** (réponse) : chat public, quelques questions par session.

### Cas exclus
- Les PDF scannés sans couche texte et les formats autres que PDF (V1).
- Les questions hors livre : pas de recherche web, l'agent répond qu'il ne trouve pas.

### Livrables

#### Workflow n8n `RAG Piketty`
Un seul workflow, avec deux branches, versionné dans `n8n/workflows/RAG Piketty.workflow.ts`, poussé avec `n8ncli` et activé.

**Branche ingestion**

| Étape | Nœud |
|---|---|
| Entrée | Form Trigger : champ fichier PDF (obligatoire) + champ « Titre du livre » (texte) |
| Extraction | Extract from File (PDF), pages séparées pour garder le numéro de page |
| Cleaning | Code : on retire les filigranes (« OceanofPDF.com »), on recolle les mots coupés en fin de ligne, on normalise les espaces et on supprime les pages vides |
| Vidage de l'index | Postgres : `DROP TABLE IF EXISTS rag_piketty`, exécuté **une seule fois**, après l'extraction et le cleaning, pour qu'un mauvais fichier ne vide pas l'index (chaque envoi remplace le livre précédent) |
| Augmentation | Pages regroupées **par 2** (1 document = 2 pages, ~505 documents). Métadonnées : `titre`, `page` (ex. « 42-43 ») |
| Lots (quota) | Documents regroupés en lots de ≤ 75 000 caractères (~24 lots), traités un par un (Loop Over Items) avec une **pause de 66 s** entre les lots |
| Chunking | Recursive Character Text Splitter, 8000 caractères, 200 de recouvrement. Un document de 2 pages fait au plus 7 831 caractères, donc 1 chunk = 2 pages |
| Vectorisation | Embeddings Google Gemini (`models/gemini-embedding-001`, le modèle par défaut) → **Postgres PGVector Store** (Insert, table `rag_piketty`), hébergé sur **Supabase** |

Le formulaire répond tout de suite « Livre reçu… ». L'indexation dure ensuite ~28 min (quota gratuit).

**Branche réponse**

| Étape | Nœud |
|---|---|
| Input | Chat Trigger, public |
| Sélection | AI Agent : décide s'il faut chercher dans le livre et reformule la question en requête de recherche |
| Recherche | PGVector Store en mode outil (retrieve-as-tool), 8 morceaux les plus proches, avec leurs métadonnées (page) |
| Génération | Google Gemini Chat Model, le même modèle et le même credential que le workflow Troov |
| Mémoire | Postgres Chat Memory (Supabase), fenêtre de 10 messages, par session de chat |

Règles du prompt système :
- Répondre **uniquement** à partir des extraits récupérés, en français.
- **Citer** chaque affirmation avec un court extrait entre guillemets et les pages : « … » (p. 312-313).
- Si rien de pertinent n'est trouvé : « Je ne trouve pas cette information dans le livre. »
- Pour les questions sur « aujourd'hui », préciser que le livre date de 2013 et ne couvre pas la situation actuelle.

Une sticky note « Specs » dans le workflow reprend ce document, et une sticky note par étape du RAG les nomme dans l'éditeur.

#### Guide credentials
Instructions pas à pas, dans le chat, pour créer le projet Supabase et le credential **Postgres** dans n8n (connexion via le *Session pooler*, IPv4, car la connexion directe de Supabase est en IPv6 et n8n Cloud n'y accède pas).

## Écosystème technique

| Outil | Rôle | Accès |
|---|---|---|
| n8n Cloud (`noetroov.app.n8n.cloud`) | Exécution du workflow | ✅ `n8ncli` configuré (env `prod`) ; `projectId` à renseigner dans `n8n-cli.json` |
| Google Gemini (credential existant) | Chat + embeddings | ✅ |
| Supabase (Postgres + pgvector) | Vector store + mémoire du chat | ⏳ l'utilisateur crée le projet et le credential Postgres, guidé |
| `n8ncli` | Création, validation, push, publication | ✅ |

## Contraintes opérationnelles
- **Volume** : un livre de 1046 pages, 18 Mo : 1009 pages utiles, 505 chunks, ~1,75 M caractères.
- **Budget** : l'abonnement n8n Cloud et le niveau **gratuit** de Gemini (mesuré : 100 embeddings/min, ~30 000 tokens/min, ~1 000/jour) et de Supabase. La facturation Gemini (~0,15 $ pour le livre) a été proposée puis refusée.
- **Gestion des erreurs** : on branche le workflow d'erreur existant (`qxiolQ3TqUKnBt4v`). « Stocker Vecteurs » est réessayé 3 fois (5 s). Si un lot échoue quand même, on relance l'ingestion à la main en renvoyant le PDF : l'index est vidé à chaque envoi, donc pas de doublons.
- **Données sensibles** : aucune (livre publié). Le texte du livre part vers Google (embeddings) et vers Supabase. Le PDF n'est jamais versionné dans le repo.

## Simplifications
- **Retenues**
  - Un seul workflow à deux triggers, sans sous-workflow.
  - **PGVector sur la base Postgres de Supabase** plutôt que le nœud « Supabase Vector Store ». n8n crée lui-même la table, donc pas de script SQL (table + fonction `match_documents`) à écrire. Un seul credential (Postgres) sert à la fois au vector store et à la mémoire.
  - Augmentation limitée aux métadonnées (titre, page). Pas de contextualisation par IA.
  - Un seul livre actif, remplacé à chaque envoi.
  - Pas de reranking en V1.
  - Chunks de 2 pages au lieu de 1000 caractères : c'est le prix du quota gratuit Gemini (5 fois moins d'appels). La recherche est un peu moins fine, et les citations se font par paire de pages.
- **Écartées**
  - Tester d'abord sur un chapitre : refusé, on tente directement le livre entier.
  - Activer la facturation Gemini (ingestion en ~1 min, chunks de 1000 caractères) : refusé, on reste en gratuit.

## Hypothèses
- Le PDF a une couche texte exploitable (vérifié : 1009 pages de texte extraites).
- Les pages citées sont les **pages du PDF** et non celles de l'édition papier (supposé).
- Le credential Gemini existant accepte `gemini-embedding-001` (supposé).
- Le plan n8n Cloud accepte un upload de 18 Mo et l'extraction de 1046 pages (vérifié).

## Critères de réussite
1. **Ingestion** : envoyer le PDF dans le formulaire → exécution réussie en ~28 min, 24 lots traités, la table `rag_piketty` contient 505 lignes, chacune avec `metadata.page`.
2. **Question du livre** : « Fais-moi un résumé des inégalités économiques qui touchent une majorité de Français aujourd'hui » → synthèse fondée sur le livre (patrimoine vs revenus, concentration du patrimoine, part des 50 % les plus pauvres, etc.), avec au moins 2 citations (p. X) et la mention que le livre date de 2013.
3. **Question hors livre** : « Confirme-moi qu'il existe bien un lycée Guez de Balzac à Angoulême en Charente » → « Je ne trouve pas cette information dans le livre. », sans confirmer ni infirmer.
4. **Suivi de conversation** : « Et aux États-Unis ? » juste après la question 2 → l'agent comprend qu'on parle toujours des inégalités.
5. **Ré-ingestion** : renvoyer le PDF → la table est recréée, sans doublons (même nombre de lignes qu'au critère 1).
6. **Panne** : envoyer un fichier non-PDF → l'exécution échoue avec une erreur visible, le workflow d'erreur est déclenché et l'index précédent reste intact.

## Points ouverts
1. **Quota gratuit Gemini** : le chat consomme le même quota. L'utiliser pendant l'ingestion peut faire échouer un lot. Si les lots échouent en 429 malgré la pause, baisser `BUDGET_LOT` dans « Nettoyer Pages ». Avec facturation : revenir à des chunks de 1000/200 et retirer la boucle.
2. **Reranking (Cohere)** : reporté à la V1.1, après le rendu.
3. **Dé-anonymisation du repo** : chantier séparé, après le RAG.
