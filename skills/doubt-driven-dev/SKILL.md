---
name: doubt-driven-dev
description: Développe un livrable en doutant de chaque hypothèse au lieu de supposer que le code fait ce qu'il a l'air de faire. Il écrit les hypothèses et les tests avant le code, ne considère comme preuve qu'une vérification exécutée dont le résultat a été lu, cherche activement ce qui doit échouer, dose la vérification selon le niveau de risque (jusqu'à confirmation utilisateur avant tout effet de bord irréversible), débogue par la cause, tient un journal de bord et termine en annonçant ce qui est prouvé et ce qui reste non vérifié. Utilise cette skill pendant toute la phase de construction ou de correction d'une feature, d'un script ou d'un workflow, dès que la spec est validée, et chaque fois que quelque chose ne marche pas comme prévu. Ne pas l'utiliser pour une question d'information ou un simple conseil, ni pour déclarer un travail terminé : ce rôle appartient à hostile-review.
---

# Doubt-driven dev

C'est le cœur du travail, les 80 % : la construction elle-même.

Une interview bien menée empêche de construire la mauvaise chose. Une relecture adverse trouve ce qui est cassé une fois construit. Entre les deux, il reste la longue phase où l'on écrit du code qui **a l'air** de faire ce qu'on veut. C'est là que se perd l'essentiel des bugs : non pas parce que le code est faux, mais parce qu'il n'a jamais été mis en situation de l'être.

**Principe : le code qui a l'air juste n'est pas une preuve.** Il est seulement compatible avec les cas qu'on a imaginés. Écrire du code, c'est empiler des suppositions invisibles pour le lecteur, et invisibles pour toi. Le travail consiste à les remonter à la surface une par une, puis à les trancher par une exécution.

Ce n'est pas un frein à la construction. C'est ce qui évite les trois heures de débogage qui commencent par « ah, en fait le champ arrive en objet ».

## 1. Écrire les hypothèses et les tests avant le code

Avant d'écrire la première ligne, formuler les hypothèses que le code fait implicitement. Une hypothèse non écrite est invérifiable : on ne peut pas vérifier ce qu'on n'a pas nommé.

Les écrire est rapide : une liste de trois à six lignes. Ce qui coûte cher, c'est l'hypothèse que personne n'a formulée et que personne ne vérifiera.

Chaque hypothèse prend la forme d'une phrase **réfutable** :
- ✅ « Le champ `status` vaut toujours `active` en entrée » : on peut la tester.
- ❌ « Les données d'entrée sont propres » : rien à vérifier.

Les hypothèses les plus rentables viennent de :
- la **spec validée** : chaque critère de réussite est un cas de test, pas une description. Ils ont été écrits avec de vraies données pendant l'interview : c'est le moment le plus facile pour les mettre en doute.
- l'**existant** : ce que le code voisin suppose de ses entrées (un appelant qui passe un objet, un champ qui peut être vide).
- l'**environnement** : formats de dates, fuseaux, encodages, chemins, versions d'API.

**Les critères de réussite de la spec deviennent les tests, écrits avant le code.** Quand c'est possible, les exécuter avant de construire et les voir échouer : c'est la preuve qu'ils testent bien ce qui manque. Ces critères ont déjà été validés par l'utilisateur : les vérifier n'est pas du travail supplémentaire, c'est le travail.

S'il n'existe pas de spec et que le changement n'est pas trivial, passer d'abord par la skill `interview`.

## 2. La preuve, c'est l'exécution

Trois états, à distinguer explicitement quand on rapporte ce qu'on a fait :

| État | Ce que c'est | Valeur |
|---|---|---|
| **Supposé** | déduit du raisonnement, du nom d'une fonction, de la doc, d'un « ça devrait » | Rien. |
| **Vérifié** | exécuté maintenant, résultat lu | Une preuve. |
| **Non vérifiable ici** | pas d'accès, pas de donnée, effet de bord inacceptable | À dire comme tel. |

**Un doute ne se lève qu'avec une exécution dont on a lu la sortie.** Un raisonnement qui « se tient » n'est pas un doute levé : c'est le même raisonnement qui a écrit le bug. Relire le code ne prouve pas que le code fait ce qu'on croit ; seule une exécution le montre.

Les trois raccourcis qui donnent une fausse confiance, par ordre de fréquence :
- **Le test passe** : voir §3, un test qui ne peut pas échouer ne prouve rien.
- **L'outil dit succès** : un statut HTTP 200, un `published: true`, un log « done », un « Push complete » attestent qu'un appel est parti, pas qu'il a produit l'effet attendu. Vérifier l'effet, en relisant l'état réel.
- **Le type est conforme** : un `typeof` qui ne râle pas ne dit pas que la valeur est celle qu'on attend. Un champ peut être un objet là où on attend une chaîne, et s'afficher correctement dans un `console.log`.

### Ligne de doute

Chaque vérification est tracée en direct dans la conversation, en une ligne :

```
🔍 Hypothèse : <ce qu'on suppose> → Vérif : <ce qu'on a regardé ou exécuté> → ✅ confirmé / ❌ faux : <ce qu'on a vu>
```

L'utilisateur voit ainsi ce qui a été prouvé au fil de l'eau, et le compte rendu final (§8) se rédige à partir de ces lignes.

## 3. Le test qui ment

Un test qui passe n'a pas de valeur tant qu'on n'a pas vérifié qu'il peut échouer. C'est le piège central de cette phase, parce qu'il donne exactement la fausse assurance qu'on cherche à éviter.

Vérifier qu'un test morde :

- **Le voir échouer d'abord** : écrit avant le code (§1), il doit être rouge avant d'être vert. Un test vert du premier coup teste peut-être un comportement qui existait déjà.
- **Le casser à la main** : modifier le code pour qu'il soit faux et vérifier que le test devient rouge. Un test qui reste vert après qu'on a cassé le code ne teste rien. C'est la vérification la plus rentable de la skill, et elle prend trente secondes.
- **Regarder ce qu'il vérifie** : un test qui ne vérifie rien, ou seulement « ça n'a pas levé d'exception », passe sur n'importe quelle sortie, y compris vide ou nulle.
- **Le cas trivial** : vérifier que le test échoue sur une entrée vide, sur une entrée par défaut, ou sur une entrée que le code gère déjà. Un test qui passe parce qu'il prend un chemin d'exception qui « marche comme un succès » est un piège courant.
- **La donnée inventée** : un jeu de données inventé est le premier facteur de fausse confiance. `2024-01-01`, `john@example.com`, un tableau parfaitement ordonné : le monde réel n'est jamais propre, et un test sur données propres laisse passer exactement les bugs qui comptent. Utiliser les vraies données de la spec, y compris leurs cas limites.

## 4. Chercher ce qui doit échouer

Écrire le code, puis aller activement chercher la raison pour laquelle il ne marche pas. Un doute qu'on ne provoque pas n'est pas levé.

Les cinq pistes, à suivre en proportion du risque :

- **L'entrée qui n'a pas la forme attendue** : vide, absente, en double, énorme, malformée, accents et caractères spéciaux, fuseau horaire, nombre en chaîne, objet au lieu de texte, liste au lieu d'un seul élément.
- **L'appel qui échoue** : l'outil externe tombe, répond lentement, répond une erreur, répond à moitié. Comment le code se comporte-t-il alors ? Une erreur qui traverse sans être vue est une perte silencieuse.
- **La branche qui ne fait rien** : relire chaque `if`, chaque `catch`, chaque `filter`, chaque `else` vide. Un chemin où « il ne se passe rien » cache presque toujours un oubli, et un oubli ne se voit pas à l'exécution.
- **Ce qui doit rester vrai** : ce qui fonctionnait avant ce changement et doit continuer à fonctionner. Lancer les tests existants, pas seulement les nouveaux. Une régression coûte plus cher que le bug qu'on cherche.
- **La seconde exécution** : beaucoup de code n'est faux qu'au deuxième passage (boucle, redéclenchement, reprise sur erreur). Exécuter deux fois est souvent le test le plus rentable sur une automatisation.

## 5. Doser selon le risque

Tout ne mérite pas le même effort. La vérification est proportionnelle à ce que coûte une erreur, pas à la taille du diff.

| Niveau | Nature | Preuve attendue |
|---|---|---|
| **1 — Trivial** | renommage, commentaire, texte, constante, variable locale | Une lecture suffit. |
| **2 — Logique pure** | calcul, transformation, validation, fonction sans effet de bord | Un test exécuté sur un cas réel de la spec. |
| **3 — Effet de bord local** | écrit un fichier, une base locale, une table | Exécuter, puis **lire le résultat réel** (le fichier, la ligne) : pas seulement « aucun message d'erreur ». |
| **4 — Effet de bord externe** | API, mail, message, webhook, ticket, publication | Vérifier sur un environnement de test ou un destinataire de contrôle. Pour un message, vérifier le **contenu rendu**, pas l'accusé d'envoi. |
| **5 — Irréversible ou sensible** | argent, suppression, données personnelles, production, déploiement, credentials, migration | Preuve explicite + **confirmation de l'utilisateur avant d'exécuter**. On prépare, on montre, on demande. |

Le niveau 5 n'est pas un cas particulier : c'est celui où une erreur n'est pas rattrapable, donc où la preuve doit venir **avant** l'exécution et non après. Une action destructive demandée par l'utilisateur n'est pas pour autant préapprouvée : il peut vouloir la chose sans en vouloir la forme exacte.

Quel que soit le niveau, une vérification est aussi obligatoire quand :
- **une décision repose sur un outil** : un statut « à jour », un message « succès », un code retour. Un statut ne voit que ce que l'outil sait : le comparer à l'état réel.
- **quelque chose a surpris**, même si ça a fini par marcher.

### Aller vite sans casser

- Les vérifications des niveaux 1 à 3 peuvent être **regroupées** et faites en lot à la fin d'une série de pas. Regrouper n'est pas oublier : le lot a lieu.
- Les niveaux 4 et 5 ne se regroupent jamais et ne se sautent jamais. Pour le niveau 5, vérifier l'état réel **avant** (on part bien de la dernière version, rien ne sera écrasé) et **après** (c'est bien enregistré, et seulement ce qui était prévu).

## 6. Bloquer rarement

Le doute se lève seul dans la grande majorité des cas : on vérifie, on trouve, on corrige, on continue. Interroger l'utilisateur à chaque incertitude transforme la construction en interrogatoire et l'empêche d'avancer.

S'arrêter pour demander, et seulement dans ces quatre cas :
1. **Le doute contredit la spec validée.** Ce n'est pas le doute qui décide, c'est l'utilisateur, mais la réalité dit le contraire de ce qui a été validé. Reprendre la construction sur une spec invalidée, c'est construire la mauvaise chose.
2. **L'action est irréversible et visible de l'extérieur** : envoyer, supprimer, payer, publier, pousser en production, modifier des données réelles. Niveau 5 ci-dessus.
3. **L'arbitrage est un vrai compromis** entre deux options valides dont l'utilisateur se soucie (coût contre simplicité, rapide contre complet). Ce n'est pas un doute technique, c'est une décision qui lui appartient.
4. **Trois corrections du même problème ont échoué** (§7).

Dans tous les autres cas : décider, noter la décision (journal, §8), continuer. Un doute non tranché n'est pas une raison de s'arrêter.

## 7. Quand ça ne marche pas : déboguer par la cause

1. **Lire l'erreur et l'état réel en entier** : message exact, données en entrée et en sortie de l'étape qui échoue.
2. **Trouver la cause avant de corriger** : reproduire, comparer avec un cas qui marche, formuler une hypothèse et la vérifier comme les autres (ligne de doute).
3. **Corriger une seule chose à la fois**, puis rejouer le test qui échouait. Plusieurs changements à la fois rendent impossible de savoir lequel a joué.
4. **Après trois corrections ratées, s'arrêter.** Ne pas tenter une quatrième : remettre en question l'approche (mauvais outil, mauvaise hypothèse de départ, besoin mal compris) et en parler à l'utilisateur.

Un symptôme qui disparaît sans qu'on sache pourquoi n'est pas une correction : c'est une surprise, à élucider et à noter au journal.

## 8. Tracer, puis passer la main

### Journal de bord

Tenir `docs/journal-de-bord.md` dans le repo du projet (le créer s'il n'existe pas). Une entrée par **surprise** ou **décision**, pas par action :

```markdown
## AAAA-MM-JJ — <titre court>
- **Constat** : ce qui s'est passé, ou ce qu'il fallait décider.
- **Cause** : pourquoi (vérifiée, ou « supposée » si non prouvée).
- **Décision** : ce qu'on a changé ou choisi, et pourquoi.
```

Le journal sert à ne pas refaire deux fois la même erreur, et à expliquer après coup les choix du projet. Si la spec a changé en route, la mettre à jour et le noter ici.

### Ne pas valider

Cette skill **vérifie**, elle ne valide pas. Elle ne déclare jamais un travail terminé, même quand tout semble juste : c'est le rôle de `hostile-review`, à lancer ensuite.

À la fin de la construction, rejouer tous les critères de réussite de la spec sur le système réel, puis rédiger un compte rendu qui distingue ce qui est prouvé de ce qui ne l'est pas :

```markdown
## Vérifications

### Prouvé
- <hypothèse> — <commande exécutée> → <résultat lu>

### Non vérifié
- <hypothèse> — <raison : pas d'accès, pas de donnée, effet de bord>

### Écarté du doute
- <point examiné puis laissé de côté, avec la raison>
```

Un doute non vérifiable ne disparaît pas : il est transmis tel quel, et `hostile-review` doit le retrouver. C'est le point de contact entre les deux phases, et il ne fonctionne que si rien n'est perdu en route : un doute qu'on oublie de mentionner ici ne sera vu ni par l'utilisateur ni par le relecteur.

## Références

- **[references/n8n.md](references/n8n.md)** : si le livrable est un workflow n8n. Les sondes utiles, les vérifications avant et après chaque push, et les pièges qui ne se voient qu'à l'exécution. À lire avant de construire, pas seulement en cas de doute.

## Signaux d'alarme

| Pensée | Réalité |
|---|---|
| « Le test passe, ça marche » | Un test qui ne peut pas échouer ne teste rien. Casse le code et vérifie qu'il devient rouge. |
| « J'écrirai le test après » | Un test écrit après confirme ce qu'on a fait, pas ce qu'il fallait faire. |
| « La logique est évidente » | L'évidence est une supposition déguisée. Écris-la, puis exécute-la. |
| « Ça crasherait si l'entrée était vide » | Alors exécute-le avec une entrée vide. |
| « L'outil a dit succès » | Ça prouve que l'appel est parti, pas qu'il a fait son effet. Relire l'état réel. |
| « Le statut dit que tout est à jour » | Un statut ne voit que ce que l'outil sait. Comparer avec le système réel. |
| « Je tente une autre correction, ça devrait passer » | Pas de cause trouvée, pas de correction. Après trois échecs, on change d'approche. |
| « Ça marche maintenant, je ne sais pas pourquoi » | C'est une surprise : trouver la cause et l'écrire au journal. |
| « Je reverrai si ça pose problème » | Le doute non écrit n'est pas vérifié, il est perdu. |
| « Je vais demander à l'utilisateur » | Réserver les questions aux quatre cas du §6, sinon on n'avance pas. |
| « Les tests existants passent tous » | Les faire tourner réellement avant de l'affirmer. Et vérifier qu'ils testaient déjà quelque chose. |
| « Je reprendrai les cas limites plus tard » | Plus tard, c'est la relecture adverse. Ici, c'est quand le code existe encore. |
| « C'est fini, ça marche » | Le dire, c'est le rôle de hostile-review. Ici on rapporte ce qui est prouvé. |
