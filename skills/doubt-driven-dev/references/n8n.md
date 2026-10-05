# Construction d'un workflow n8n

À lire **avant** de construire un workflow n8n, pas seulement au moment de douter. La plupart des pièges ci-dessous ne se voient pas à la lecture du workflow : ils n'apparaissent qu'à l'exécution, contre une vraie donnée.

## Sondes utiles

| Doute | Plus petite sonde |
|---|---|
| Quelle forme ont vraiment les données ? | Lire la sortie d'un nœud dans une exécution réelle (API REST : `GET /api/v1/executions/<id>?includeData=true`). |
| Mon expression trouve-t-elle le champ ? | Vérifier que `$json.<champ>` existe dans la sortie **du nœud juste avant**, pas seulement au début du workflow. |
| Le workflow fait-il ce que dit la spec ? | `n8ncli test <fichier> --pin-data <exemple>` avec un exemple de la spec, ou une exécution réelle sur un exemple de test. |
| La version locale est-elle la dernière ? | `n8ncli diff <fichier> --semantic` avant toute modification. |
| Mon push est-il vraiment enregistré ? | Refaire un `pull` dans un dossier temporaire et y chercher le changement attendu. |
| Pourquoi l'exécution a-t-elle échoué ? | Lire l'exécution par l'API REST : dernier nœud exécuté, message d'erreur, données en entrée de ce nœud. |

Selon l'instance, `n8ncli logs` et `n8ncli execution` peuvent échouer en MCP (`get_execution not found`) : passer alors par l'API REST avec la clé configurée pour `n8ncli`.

## Avant et après chaque push (niveau 5)

Un push modifie le workflow en production : il ne se regroupe pas et ne se saute pas.

**Avant :**
1. `n8ncli diff <fichier> --semantic` : la différence avec la version déployée doit se limiter à **tes** changements. `n8ncli status` ne voit pas les modifications faites dans l'interface (credentials connectés, réglages). Si la version déployée en contient, faire d'abord un `pull`, puis réappliquer tes changements dessus.
2. `n8ncli validate <fichier>`.

**Après :**
1. Lire **toute** la sortie du push : un `[CONFLICT] ... Skipping` peut apparaître au-dessus d'un « Push complete ».
2. Refaire un `pull` dans un dossier temporaire et vérifier par recherche que les changements sont là et que les credentials sont toujours présents.
3. Si le push n'a rien enregistré alors que tout semblait bon : vérifier que `n8ncli` a une clé API REST configurée (`n8ncli env test`), car un push par MCP seul peut ne rien enregistrer. Un faux succès peut aussi bloquer les push suivants (« Plan: » vide) : remettre à zéro le `contentHash` du workflow dans `sync-state.json`.

## Vérifier avant d'activer

Un workflow inactif ne s'exécute jamais en automatique. Avant de l'activer, et au minimum une fois par branche :

- **Le déclencher à la main** sur un vrai événement (un vrai mail, un vrai payload), pas sur un jeu de données inventé.
- **Lire la sortie de chaque nœud**, dans l'ordre, sur cette exécution. Un nœud qui sort 0 élément n'échoue pas : il réussit silencieusement. C'est la perte de données la plus fréquente en n8n.
- **Comparer le nombre d'éléments en entrée et en sortie** de chaque nœud. Moins d'éléments en sortie qu'en entrée signifie qu'un filtre a mangé quelque chose.
- **Vérifier le résultat de l'étape qui produit l'effet** : le message reçu, la ligne écrite, le fichier créé. Un statut « published » n'atteste que de l'envoi de l'appel.

Relancer une exécution (`POST /api/v1/executions/<id>/retry`), envoyer un mail de test ou poster dans Slack sont des effets de bord externes (niveau 4) : les annoncer à l'utilisateur, et préférer un canal ou une boîte de test quand il en existe.

## Pièges qui ne se voient qu'à l'exécution

À transformer en cas de test tant qu'ils n'ont pas été vérifiés sur une donnée réelle :

- **Nœud IA de type chaîne (LLM Chain)** : il ne renvoie que la réponse du modèle. Les champs d'origine (expéditeur, métadonnées, identifiant) sont perdus et doivent être récupérés depuis un nœud précédent (`$('<nœud>').all()[i].json`).
- **Champ `from` du déclencheur IMAP** : c'est un objet, pas une chaîne. `{{ $json.from }}` affiche `[object Object]`. Utiliser `from.text`.
- **Slack, canaux privés** : viser le canal par son **ID** (commence par `C`), pas par son nom, et inviter le **bot du credential utilisé** dans chaque canal. Sinon `channel_not_found`, la cause la plus fréquente de « ça ne marche pas en vrai » alors que le test manuel passait.
- **Fil de mails** : les réponses se détectent via l'en-tête `in-reply-to`, pas via un mot dans le corps. Un premier test avec un mail neuf ne le révèle pas ; il faut répondre à un vrai fil.
- **Réponse d'IA inexploitable** : vérifier le comportement quand le JSON renvoyé par le modèle est invalide ou incomplet. Il faut un repli, jamais une perte silencieuse.
- **Déclenchement périodique et rejeu** : relancer le workflow sur une période déjà traitée crée des doublons. Vérifier le comportement sur une deuxième exécution, pas seulement la première.

## Vérifier une branche d'erreur sans casser la prod

La branche d'erreur est le chemin le moins testé d'un workflow, parce que la déclencher volontairement est pénible. C'est pourtant elle qui décide de ce qui se passe quand un outil tombe.

Pour la vérifier sans dépendre d'une panne réelle :

- **Forcer l'échec en amont** : sur une copie du workflow, configurer volontairement un credential invalide ou une URL qui répond 404, et vérifier que l'erreur est bien capturée et routée vers le workflow d'erreur.
- **Vérifier le workflow d'erreur lui-même** : qu'il se déclenche, qu'il ne fait pas échouer le workflow principal, et qu'il prévient une personne réelle.
- **Vérifier l'absence de boucle** : un workflow d'erreur qui pointe vers le workflow principal déclenche une boucle infinie. C'est un risque réel, pas théorique.

## Points à documenter

Ces deux informations ne se devinent pas en lisant le workflow (les identifiants sont invisibles dans l'interface). Les reporter dans la sticky note **« Specs »** du workflow une fois construit :

- Le **déclencheur réel** et sa fréquence, et ce qui se passe sur les éléments déjà traités.
- La **destination de la sortie** et l'identifiant utilisé (ID de canal Slack, ID de feuille, nom de table).
