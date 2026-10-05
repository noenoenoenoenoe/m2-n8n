# Spec | RAG Piketty V2 : un chunk par section, un sous-workflow par chunk

> Statut : brouillon, à valider · Date : 2026-10-01

## Contexte
La V1 du RAG Piketty (workflows `RAG Piketty` et `RAG Piketty Page`, table `rag_piketty`) découpe le livre en paires de pages. Ce choix venait du quota gratuit de Gemini, et la V1 a besoin d'une boucle par lots avec pause pour l'ingestion. Pour le M2, on construit une **V2 plus simple et plus précise**, avec un découpage qui suit la structure du livre et un sous-workflow par chunk. Ce sous-workflow accueillera ensuite l'étape d'**augmentation**, à approfondir avec le prof. La V1 n'est plus modifiée : les deux versions doivent pouvoir être **comparées** depuis une page dédiée.

Vocabulaire : **chunk = une section du livre** (un titre de la table des matières), soit environ 200 chunks, ~20 pour 100 pages.

## Déclencheur & livrables

### Déclencheurs
- **Formulaire** (ingestion V2) : envoi manuel du PDF, rarement.
- **POST /rag-piketty-v2-ask** (réponse V2) : appelé par la page de comparaison.
- **GET /rag-piketty-v2** : la page de comparaison.

### Cas exclus
- Pages 1-20 (couverture, copyright, table des matières) et pages 1040 et suivantes (liste des graphiques et tableaux).
- Les pages de **notes de fin de chapitre** (listes de notes numérotées).
- Aucune modification de la V1 : workflows, table `rag_piketty`, page `/webhook/rag-piketty`, URLs.

### Livrables

#### 1. Workflow n8n `RAG Piketty V2`
Un seul workflow, en trois parties.

**Ingestion (flux principal)**

| # | Nœud | Rôle |
|---|---|---|
| 1 | Formulaire | Reçoit le PDF + le titre (comme en V1) |
| 2 | Extraction | Texte page par page (comme en V1) |
| 3 | **Découpage en chunks** (Code) | Repère dans le texte les titres de section de la table des matières. Produit **un item par section** avec : `text`, `section` (titre), `chapitre` (numéro + titre, ou « Introduction » / « Conclusion »), `partie`, `page` (plage, ex. « 83-87 »), `ordre`. Exclut le début du livre, la fin et les notes de fin de chapitre |
| 4 | **Limit** | `maxItems = 1` pour les tests. On le retire, ou on le monte, pour lancer tout le livre |
| 5 | Vidage | Postgres : `DROP TABLE IF EXISTS rag_piketty_v2`, exécuté une seule fois |
| 6 | **Execute Sub-workflow** (dernier nœud) | Appelle le sous-workflow (le même workflow, déclencheur « Execute Workflow Trigger ») **une fois par chunk**, en attendant la fin de chaque appel |

**Sous-workflow (un appel par chunk)**

| Nœud | Rôle |
|---|---|
| Execute Workflow Trigger | Reçoit un chunk |
| Nettoyage | Retire le filigrane « OceanofPDF.com » et normalise les espaces. Les tirets de fin de ligne sont gardés, comme en V1 |
| *(place réservée : augmentation)* | Rien en V2. Une note sur le canevas indique où l'insérer |
| Stockage | PGVector Insert, table `rag_piketty_v2`. Embeddings `gemini-embedding-2`. Default Data Loader avec les métadonnées `titre` du livre, `section`, `chapitre`, `partie` et `page`. Text Splitter en **filet de sécurité** : 20 000 caractères, recouvrement 200, pour ne couper que les sections trop longues pour `gemini-embedding-2` |
| Pause quota | Ajoutée **seulement si** le premier test montre qu'elle est nécessaire (voir point ouvert 1) |

**Réponse**
`POST /rag-piketty-v2-ask` → Agent : **même agent, même prompt, même modèle** (`gemini-flash-lite-latest`) que la V1. Seuls changent :
- l'outil de recherche, branché sur `rag_piketty_v2` (8 résultats, métadonnées incluses) ;
- la mémoire, dans une table `rag_piketty_v2_chat`.

Pas de chat hébergé en V2.

#### 2. Page de comparaison `GET /rag-piketty-v2`
Une copie de la page V1, avec un **sélecteur V1 / V2** qui choisit le point d'entrée (`/rag-piketty-ask` ou `/rag-piketty-v2-ask`). Elle est servie par un nouveau workflow, `RAG Piketty Compare`, et la page V1 reste intacte. Chaque version garde sa propre session de conversation.

#### 3. Notes sur le canevas
Une note par étape, comme en V1, et une note qui marque la place de l'augmentation.

## Écosystème technique

| Outil | Rôle | Accès |
|---|---|---|
| n8n Cloud + `n8ncli` (`~/Desktop/n8n-workflows`) | Workflows V2 et page de comparaison | ✅ |
| Supabase Postgres (credential `Supabase Postgres`) | Tables `rag_piketty_v2` et `rag_piketty_v2_chat` | ✅ |
| Gemini (credential existant) | `gemini-embedding-2`, `gemini-flash-lite-latest` | ✅ niveau gratuit |

## Contraintes opérationnelles
- **Volume** : ~200 chunks, soit ~200 vecteurs et ~200 appels de sous-workflow par ingestion complète. Le livre fait ~1,75 M caractères (~450 000 tokens).
- **Budget** : niveau gratuit Gemini. Le passage au payant sera vu avec le prof, en même temps que l'augmentation.
- **Gestion des erreurs** : le workflow d'erreur existant est branché. Si un sous-workflow échoue, l'exécution principale s'arrête et l'erreur est visible. On relance après correction (le vidage remet la table à zéro).
- **Données sensibles** : aucune.

## Simplifications
- **Retenues**
  - Un seul workflow V2 (ingestion, sous-workflow, réponse), qui s'appelle lui-même.
  - Plus de boucle par lots, de table de construction ni de publication.
  - Le découpage se fait en une passe (sections). Le découpeur natif ne sert que de filet de sécurité.
  - Un nœud **Limit à 1** pour tester sur un seul chunk avant de lancer tout le livre.
  - Pas de chat hébergé en V2 : la page de comparaison suffit.
- **Écartées**
  - Le sélecteur sur la page V1 : écarté pour ne pas toucher à la V1.
  - Les chunks de ~1 500 caractères : trop fins par rapport à la cible de 10 à 100 chunks pour 100 pages.

## Hypothèses
- Les titres de section de la table des matières se retrouvent dans le texte, avec une tolérance pour les titres coupés sur deux lignes. La mesure préalable en trouve ~200, avec ~5 pages en moyenne par section (de 1 à 16).
- Les pages de notes de fin de chapitre se reconnaissent automatiquement : majorité de lignes qui commencent par « N. ».
- Les appels de sous-workflow comptent peu ou pas dans le quota d'exécutions n8n Cloud (à vérifier).
- Un seul nœud Execute Sub-workflow, en mode « une fois par item » avec attente, traite les chunks l'un après l'autre.

## Critères de réussite
1. **Découpage** (vérifié avant toute vectorisation, sur le texte réel) :
   - entre 100 et 300 chunks au total, et **entre 10 et 100 chunks pour 100 pages** dans chaque partie ;
   - chaque chunk porte un titre de section présent dans la table des matières ;
   - aucune page utile (21-1039, hors notes) n'est oubliée ni comptée deux fois ;
   - aucun chunk ne dépasse 20 000 caractères après le filet de sécurité.
2. **Limit = 1** : une exécution réussie, la table `rag_piketty_v2` contient le(s) vecteur(s) du 1er chunk, avec toutes les métadonnées.
3. **Livre complet** (Limit retiré) : exécution réussie, nombre de lignes = nombre de chunks (plus les découpes du filet de sécurité), aucune erreur 429 non rattrapée.
4. **Questions de comparaison**, posées à la V1 et à la V2 :
   - **A** « Qu'est-ce que la première loi fondamentale du capitalisme ? » → la V2 cite la section « La première loi fondamentale du capitalisme : α = r × β » (ch. 1) avec la bonne plage de pages.
   - **B** « Comment Piketty évalue-t-il la valeur des esclaves dans le capital américain ? » → la V2 cite la section du ch. 4 qui contient la p. 285.
   - **C** « Que dit Piketty de la croissance démographique sur le très long terme ? » → la V2 cite la section « Les étapes de la croissance démographique » (ch. 2).
   - Pour chacune : bonne section citée, plage de pages correcte et resserrée, réponse au moins aussi précise que la V1.
5. **Hors livre** : « Confirme-moi qu'il existe bien un lycée Guez de Balzac à Angoulême » → « Je ne trouve pas cette information dans le livre. » en V2.
6. **Page de comparaison** : le sélecteur bascule bien entre V1 et V2, chaque version garde sa conversation, et la page V1 (`/webhook/rag-piketty`) est identique à avant.
7. **V1 intacte** : `n8ncli diff --semantic` vide sur `RAG Piketty` et `RAG Piketty Page` après la construction de la V2.

## Points ouverts
1. **Débit Gemini** : la limite de tokens par minute de `gemini-embedding-2` n'est pas mesurée. Si elle est d'environ 30 000/min comme pour le 001, l'ingestion complète prendra au moins ~15 minutes et demandera une pause dans le sous-workflow. On la mesure au premier test (Limit > 1) et on règle la pause en conséquence. Avec la facturation : pas de pause.
2. **Augmentation** : contenu à définir avec le prof. Sa place est réservée dans le sous-workflow.
3. **Précision des pages** : la citation donne la plage de pages de la section (ex. « p. 83-87 »), et non une page unique.

---

## Avenant 1 (2026-10-01) : sous-workflow « chunk → embedding → SQL » et colonne de mots-clés

> Statut : brouillon, à valider. Cet avenant remplace la partie « Sous-workflow » et le stockage décrits plus haut. Le reste de la spec ne change pas.

### Pourquoi
La comparaison V1/V2 (journal du 2026-10-01) montre que la V2 manque A et C : un vecteur par section dilue le sujet, et le titre de section n'est pas vectorisé. On prépare une **méthode hybride**, vecteurs + mots-clés. L'avenant traite seulement **l'ingestion** : on stocke le chunk, son vecteur et ses mots-clés. La **recherche hybride côté réponse** fera l'objet d'une étape ultérieure.

### Sous-workflow (un appel par chunk)

| Nœud | Rôle |
|---|---|
| **Chunking Trigger** (Execute Workflow Trigger, entrées définies) | Reçoit `chunk_id`, `text`, `page`, `section`, `chapitre`, `partie`, `titre`, `ordre` |
| **Embedding** (HTTP Request POST) | API Gemini `models/gemini-embedding-2:embedContent`, tâche `RETRIEVAL_DOCUMENT`, credential Gemini existant |
| **Enregistrer Chunk** (Postgres, Execute a SQL query) | Upsert dans `rag_piketty_v2_chunks` avec des paramètres de requête (pas de concaténation de texte dans le SQL) |
| Pause quota | Conservée tant qu'on est en niveau gratuit (1 s pour 1 600 caractères) |

- Le **nettoyage** passe dans « Decouper Chunks ». Ce nœud ajoute aussi un en-tête au texte : « Partie… / Chapitre… / Section : … ». Le titre de section est ainsi **vectorisé** et **indexé en mots-clés**.
- `chunk_id` est stable et lisible : `capital21-001` … `capital21-235`.

### Table Supabase `rag_piketty_v2_chunks`
Nouvelle table. L'ancienne `rag_piketty_v2` est **conservée** : aucune suppression.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | `text` (clé primaire) | le `chunk_id` |
| `chunk` | `text` | en-tête + texte nettoyé |
| `metadata` | `jsonb` | `page`, `section`, `chapitre`, `partie`, `titre`, `ordre` |
| `embedding` | `vector(3072)` | le vecteur Gemini |
| `mots_cles` | `tsvector`, **calculée par Postgres** | `setweight(to_tsvector('french', section), 'A') ‖ setweight(to_tsvector('french', chunk), 'B')` : titre de section pondéré plus fort. Index GIN |
| `cree_le`, `maj_le` | `timestamptz` | date de création, et de dernière mise à jour (upsert) |

- Le **vidage** devient `CREATE TABLE IF NOT EXISTS` (plus de `DROP`). L'insertion est un **upsert sur `id`** : une relance ou un réessai écrase sans doublon.
- **Réponse** : agent, prompt et modèle inchangés. L'outil de recherche pointe vers `rag_piketty_v2_chunks`, avec la correspondance des colonnes (`chunk` comme contenu). Recherche vectorielle seule pour l'instant.

### Critères de réussite ajoutés
- **A1** : avec Limit = 1, une ligne dans `rag_piketty_v2_chunks`. `id = capital21-001`, vecteur de 3072 dimensions, `mots_cles` non vide et contenant les mots du titre de section, métadonnées complètes.
- **A2** : relancer Limit = 1 → toujours 1 ligne (upsert), `cree_le` inchangé, `maj_le` mis à jour.
- **A3** : une requête plein texte `mots_cles @@ websearch_to_tsquery('french', 'première loi fondamentale')` remonte le chunk de la section « La première loi fondamentale du capitalisme » en tête, une fois le livre complet indexé.
- **A4** : l'agent V2 répond à partir de la nouvelle table (question A posée une fois).
- **A5** : ingestion complète → 235 lignes, 0 erreur. Elle est lancée **tout de suite** à la demande de l'utilisateur, en connaissant le risque de quota : si le quota du jour est épuisé en cours de route, on relance demain, et l'upsert reprend sans doublon.

### Points ouverts
- La recherche hybride côté réponse (fusion vecteur + mots-clés) reste à spécifier.
- Le quota du jour est probablement insuffisant pour 235 vecteurs. Un échec en cours de route est attendu, et sans perte grâce à l'upsert.

---

## Avenant 2 (2026-10-01) : introductions de chapitre fusionnées avec la première section

> Statut : brouillon, à valider.

### Pourquoi
Lors des comparaisons, les chunks « introduction du chapitre » (courts et généralistes) remontent pour beaucoup de questions et prennent la place des sections précises : 6 sur 8 pour la question A avant l'avenant 1.

### Changement
- **Decouper Chunks** : le texte entre le titre d'un chapitre (ou « Introduction » / « Conclusion ») et sa première section est **ajouté au début de cette première section**. Il ne forme plus un chunk à part. Le chunk garde le titre, la page de départ et le `chunk_id` de la première section. Sa plage de pages commence à l'introduction.
- Environ **217 chunks** au lieu de 235. Les `chunk_id` restent séquentiels (`capital21-001` …).
- **Nettoyage des chunks périmés** : après l'appel du sous-workflow, un nœud Postgres supprime les lignes de `rag_piketty_v2_chunks` dont `ordre` est **supérieur au nombre total de chunks produits par le découpage** (avant Limit). C'est sans effet avec `Limit = 1`, et ça supprime les lignes 218 à 235 de l'ingestion précédente.
- Réingestion complète, en niveau gratuit avec pause (~25 min).

### Critères de réussite ajoutés
- **B1** : test du découpage sur le vrai texte. Aucun chunk « (introduction du chapitre) ». Le texte d'introduction est présent au début de la première section de chaque chapitre (ex. Marikana au début de « Le partage capital-travail dans le long terme »). Les critères 1 de la spec (densité, couverture, notes) passent toujours.
- **B2** : après la réingestion complète, `rag_piketty_v2_chunks` contient exactement N lignes (N = nombre de chunks produits), avec `ordre` de 1 à N, sans ligne au-delà.
- **B3** : avec `Limit = 1`, le nettoyage ne supprime rien d'autre que les lignes au-delà de N.

### Ensuite (choix de l'utilisateur, hors avenant)
Comparaison V1/V2 : questions A, B, C, **3 fois chacune**, nouvelle session à chaque fois, jugées à la main sur les 3 critères de la spec. Puis relecture hostile. La recherche hybride côté réponse et l'augmentation viendront plus tard.
