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

## 2026-10-01 — RAG V2 : 1 chunk = 1 section de la table des matières
- **Constat** : la cible était de 10 à 100 chunks pour 100 pages, avec un sous-workflow par chunk. Un découpage à 1 500 caractères aurait donné ~130 chunks pour 100 pages.
- **Cause** : vérifiée sur le texte extrait. Le livre a ~200 sections (titres de la table des matières), de 5 pages en moyenne.
- **Décision** : nœud Code « Decouper Chunks », qui repère les titres de la table des matières dans le texte, dans l'ordre et sans tenir compte des espaces (titres coupés sur plusieurs lignes, comme « XX / e / siècle »). Résultat : 235 chunks, de 13 à 34 pour 100 pages selon les parties, aucune note de fin de chapitre. Le test du critère 1 s'exécute sur le vrai texte, et on a vérifié qu'il échoue sur deux mutations.

## 2026-10-01 — « PREMIÈRE PARTIE » non reconnue
- **Constat** : au premier test, les chapitres 1 et 2 étaient rangés dans la partie « Introduction ».
- **Cause** : vérifiée. La regex attendait « …IÈME PARTIE », alors qu'on écrit « PREMIÈRE ».
- **Décision** : liste explicite des quatre ordinaux.

## 2026-10-01 — Un nœud Postgres entre Limit et le sous-workflow perd les chunks
- **Constat** : la spec plaçait « Vidage » juste avant « Execute Sub-workflow ».
- **Cause** : vérifiée en V1. Un nœud Postgres ne renvoie que le résultat de sa requête.
- **Décision** : ajout de « Reprendre Chunks » (`$('Limit Test').all()`) entre les deux. C'est un écart mineur à la spec.

## 2026-10-01 — `n8ncli push` ignoré pour conflit après une activation
- **Constat** : un push affichait `[CONFLICT] … Skipping`, et la version en ligne gardait l'ancien `Limit`. Un test est parti sur cette ancienne version, car l'envoi du formulaire était dans la même commande que le push.
- **Cause** : vérifiée. L'activation (`publish`) modifie la version en ligne, et le push suivant détecte un conflit.
- **Décision** : `diff --semantic` (pour vérifier qu'on n'a que nos changements), puis `push --force`, **puis vérification de la version déployée avant** tout envoi au formulaire.

## 2026-10-01 — Quota gratuit de `gemini-embedding-2`
- **Constat** : deux lots d'environ 73 000 caractères passent, le troisième est refusé (429) dans la même minute.
- **Cause** : limite de tokens par minute du niveau gratuit, entre ~150 000 et ~220 000 caractères/min.
- **Décision** : pause proportionnelle dans le sous-workflow (1 s pour 1 600 caractères, soit ~100 000 car./min). Ingestion complète en ~25 min. À retirer si la facturation est activée.

## 2026-10-01 — Page de comparaison : le fil V2 restait visible en V1
- **Constat** : le test automatique disait « fil V2 masqué », mais la capture d'écran montrait la question V2 dans la vue V1.
- **Cause** : vérifiée. `.thread { display: flex }` l'emporte sur l'attribut `hidden`. Le test vérifiait l'attribut, pas l'affichage réel.
- **Décision** : ajout de `.thread[hidden] { display: none; }`. Le test vérifie maintenant ce qui est réellement affiché (`offsetParent`).

## 2026-10-01 — La V2 (1 chunk = 1 section) trouve moins bien que la V1 sur 2 questions sur 3
- **Constat** : comparaison sur les questions de la spec (exécutions 353 à 361). B : V2 ✅ (la bonne section est remontée et citée). A et C : V2 ❌, alors que la V1 cite les bonnes pages. Pour A, 6 des 8 chunks remontés sont des « introductions de chapitre ». Pour C, la section visée n'est pas remontée.
- **Cause** : **supposée**, appuyée sur des faits vérifiés. (1) Un vecteur par section entière (jusqu'à 12 000 caractères) dilue le sujet précis. (2) Le titre de section n'est que dans les métadonnées, qui ne sont pas vectorisées : la section C ne contient pas son titre dans son texte. (3) Les introductions de chapitre, courtes et générales, ressemblent à beaucoup de questions.
- **Décision** : en attente de l'utilisateur (le résultat contredit l'attente de la spec, critère 4). Pistes : inclure titre, chapitre et partie dans le texte vectorisé, ce qui correspond à l'« augmentation » prévue. Ou découper les sections en sous-chunks tout en gardant la section comme unité de contexte.

## 2026-10-01 — Avenant 1 : sous-workflow « Chunking Trigger → Embedding (HTTP) → Enregistrer Chunk (SQL) »
- **Constat** : le nœud « Embeddings Google Gemini » n'est qu'un sous-nœud et ne peut pas s'utiliser seul dans une chaîne. Le champ « Query Parameters » du nœud Postgres attend une liste séparée par des virgules, alors que les chunks contiennent des virgules.
- **Cause** : vérifiée par des sondes sur Supabase. Une expression qui renvoie un **tableau** (`{{ [ … ] }}`) transmet chaque valeur telle quelle : un texte avec virgules, guillemets, apostrophe, `$1` et un faux `DROP TABLE` est stocké à l'identique (`chunk = $2` vrai). La colonne générée `mots_cles` (section pondérée A, texte pondéré B, `french`) est acceptée par Postgres. `embedContent` + `taskType: RETRIEVAL_DOCUMENT` renvoie 3072 dimensions.
- **Décision** : embedding par HTTP Request, upsert SQL paramétré, nouvelle table `rag_piketty_v2_chunks` (l'ancienne `rag_piketty_v2` est conservée), plus de `DROP`. Le titre de section est mis en en-tête du texte, ce qui le fait vectoriser et indexer.

## 2026-10-01 — Remplacements de texte trop larges dans mes scripts de génération
- **Constat** : deux fois, un script a modifié le mauvais endroit. Un `replace('Q', …)` a aussi touché `requete_SQL`, et une regex visait des guillemets alors que `n8ncli` avait reformaté le fichier avec des apostrophes.
- **Cause** : vérifiée. Marqueurs non univoques, et reformatage automatique des fichiers par `n8ncli` à chaque push.
- **Décision** : utiliser des marqueurs uniques (`__QUERY__`), compter les remplacements et refuser s'il n'y en a pas exactement un.

## 2026-10-01 — Le quota du jour était plus large que prévu
- **Constat** : l'ingestion complète de l'avenant (235 vecteurs) a réussi, alors que j'estimais le quota du jour quasi épuisé (environ 900 sur 1 000).
- **Cause** : **supposée**. La limite par jour de `gemini-embedding-2` en niveau gratuit est plus élevée que celle mesurée pour le 001, ou elle n'est pas comptée de la même façon. Non mesurée directement.
- **Décision** : ne plus présenter ~1 000/jour comme une limite certaine. Seule la limite par minute (~150 000 caractères) est mesurée, et c'est elle que la pause respecte.

## 2026-10-01 — Avec le titre de section dans le texte, la V2 retrouve la question A
- **Constat** : après l'avenant, l'agent V2 cite p. 106-107 pour la question A (exécution 607). Le chunk `capital21-022` (« La première loi fondamentale… ») fait partie des chunks remontés, alors qu'il manquait avant l'avenant. La recherche plein texte le place en tête.
- **Cause** : **supposée**, cohérente avec le diagnostic précédent. L'en-tête « Section : … » est maintenant vectorisé. Un seul essai : non prouvé statistiquement.
- **Décision** : rejouer B et C, ainsi que 2 ou 3 séries de comparaison, avant de conclure. La recherche hybride côté réponse reste à faire.

## 2026-10-01 — V3 : `}}` dans le corps JSON coupe l'expression n8n
- **Constat** : le nœud Routing échouait avec « invalid syntax ».
- **Cause** : vérifiée. Le schéma JSON imbriqué contenait `}}`, que n8n lit comme la fin de l'expression `{{ … }}`.
- **Décision** : accolades fermantes espacées (`} }`) dans toutes les expressions, et contrôle automatique sur la version déployée (aucun `}}` interne).

## 2026-10-01 — V3 : poids de la recherche hybride 0,6 / 0,4 → 0,5 / 0,5
- **Constat** : avec 0,6 sur les vecteurs, la section C, 1re en mots-clés, ne figurait même pas parmi les 20 candidats.
- **Cause** : vérifiée par le calcul et une sonde. Le 20e chunk côté vecteurs seul (0,6/80) bat le 1er côté mots-clés seul (0,4/61). Les chunks courts remontent pour toutes les questions côté vecteurs : 3 des 10 plus courts arrivent en tête sur A et B.
- **Décision** : 0,5 / 0,5 (marge prévue par la spec). A et B restent 1ers, C entre 6e-7e parmi les candidats.

## 2026-10-01 — V3 : mots-clés sans accents = recherche plein texte muette
- **Constat** : pour un suivi, le routing a écrit « inegalites aux Etats-Unis ».
- **Cause** : vérifiée. Ces mots-clés trouvent 0 chunk, contre 73 avec les accents (`french` ne retire pas les accents).
- **Décision** : consigne explicite dans le prompt de routing. Vérifié sur le même suivi.

## 2026-10-01 — V3 : ~1,7 s de démarrage au premier nœud Code de chaque exécution
- **Constat** : l'étape « contexte » durait ~2 s.
- **Cause** : vérifiée. En remplaçant le premier nœud Code par un Set, le délai se reporte sur le nœud Code suivant : c'est le démarrage du moteur de code de n8n Cloud, une fois par exécution.
- **Décision** : en attente de l'utilisateur. Le supprimer demanderait de réécrire les 6 nœuds Code en expressions (moins lisibles).

## 2026-10-01 — V3 sur A, B, C (3 séries)
- **Constat** : A 3/3, B 3/3, C 1/3 (les séries ratées citent p. 158-159, la section voisine). La V1 cite les pages de C aux 3 séries. Durée HTTP médiane V3 : 8,1 s.
- **Cause** : **supposée**. Le reranking ne voit que les 1 500 premiers caractères de chaque candidat. La section C n'est pas retenue en série 3, et la génération préfère parfois la section voisine.
- **Décision** : en attente de l'utilisateur (le critère 1 de la spec V3 n'est pas atteint pour C).

## 2026-10-01 — V3 rapidité : le streaming marche, mais les objectifs de temps ne sont pas tenus
- **Constat** :
  - Le streaming n8n fonctionne : lignes JSON `begin` / `item` / `end`, et la page affiche le texte au fur et à mesure (15 mises à jour observées).
  - Le reranking n'écrit plus que 34 à 67 tokens (au lieu de ~550).
  - Le premier texte arrive pourtant en 8 à 19 s (mesures de 17:20), puis en 36 s (17:26), alors que l'objectif était ≤ 4,5 s.
  - Génération via l'Agent : 4,4 à 10 s, contre 1,3 à 2,7 s auparavant via HTTP, pour un contexte de taille comparable.
- **Cause** :
  - (1) Latence de Gemini en niveau gratuit très variable (routing de 0,8 à 7,3 s, reranking de 1 à 3,7 s). Vérifiée dans les exécutions.
  - (2) Le délai de 8 s + 1 relance double l'attente quand Gemini est lent (16,5 s, puis repli). Vérifié.
  - (3) La génération par l'Agent est plus lente que l'appel HTTP direct. **Supposée** (peu d'échantillons, latence de Gemini variable au même moment).
  - (4) Une erreur réseau (délai dépassé) n'était pas couverte par `neverError` et arrêtait le workflow. Vérifié (exécution 932).
- **Décision** :
  - Routing et reranking passent en « continuer en cas d'erreur » : le repli prévu s'applique (vérifié, exécution 934).
  - Le modèle Gemini n'a pas d'option de délai dans n8n : la génération n'a qu'une relance en cas d'erreur, sans délai maximum (écart à l'avenant).
  - Les arbitrages de vitesse sont laissés à l'utilisateur.

## 2026-10-01 — V3 avenant 2 : plus de nœud Code, délais courts sans relance, mesure Agent / HTTP
- **Constat** :
  - Mesure de la génération, même contexte, 3 essais chacun : HTTP 1,73 s, Agent en streaming 1,81 s (médianes). Règle de l'avenant : on garde l'Agent.
  - Les 3 nœuds Code sont remplacés par des Set « raw » (expressions). Plus aucun nœud interne ne dépasse 55 ms, et les 11 cas de robustesse passent sur les expressions déployées.
  - Premier texte : B 4,4 s, C 4,8 s, A 13,9 s.
  - « Bonjour » est passé par toute la chaîne (8,5 s).
- **Cause** : vérifiée dans les exécutions 944 et 947. Le **routing a dépassé son délai de 5 s** (5 043 et 5 019 ms) : le repli (type `livre`) envoie alors une salutation en recherche et en génération. Pour A, s'y ajoute une génération lente (6,9 s, variabilité de Gemini).
- **Décision** : en attente de l'utilisateur. Pistes : délai du routing un peu plus long (7-8 s), salutations reconnues par une règle avant le routing, facturation Gemini.
