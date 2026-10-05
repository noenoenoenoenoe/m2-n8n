---
name: interview
description: Interroge l'utilisateur sur une idée avant de la construire. Il fait tout dire, pose des séries de questions numérotées, challenge le besoin, propose des simplifications et rédige une spec à valider. Utilise cette skill dès que l'utilisateur soumet une idée, un besoin ou un projet à construire (workflow n8n, automatisation, script, fonctionnalité, app, intégration entre outils), même formulé en une phrase (« je veux que quand X arrive, Y se passe », « j'ai une idée », « il faudrait automatiser… »), et avant toute construction. Ne pas l'utiliser pour une correction ponctuelle déjà bien spécifiée, ni pour une question de simple information.
---

# Interview

Transformer une idée brute en une spec claire, **la plus simple possible**, validée par l'utilisateur avant la moindre construction.

L'interview est les premiers 10 % du travail. Une question posée ici coûte une minute, alors que la même question découverte pendant la construction coûte une heure. Et une étape qu'on supprime ici, c'est autant qu'on n'aura jamais à construire, tester ni maintenir.

<BLOCAGE>
Rien n'est construit avant que l'utilisateur ait validé explicitement la spec écrite. Cela inclut : créer un workflow ou des fichiers, écrire du code, pousser vers un outil, installer quoi que ce soit.
Lire l'existant (repo, workflows, docs) reste autorisé pendant l'interview.
</BLOCAGE>

## 0. Lire avant de demander

Avant la première question, regarder ce qui existe déjà : fichiers du repo, specs précédentes (`specs/`), workflows ou code comparables, notes du projet. Ne jamais demander ce qu'on peut trouver soi-même.

**Si l'idée concerne un workflow n8n**, lire [references/n8n.md](references/n8n.md) maintenant : il contient les questions et les leviers de simplification propres à n8n.

## 1. Reformuler et faire tout déballer

Premier message, court :
1. Reformuler l'idée en 2-3 lignes : l'événement de départ, ce qui doit se passer, pour qui.
2. Inviter l'utilisateur à **tout dire, sans trier** : contexte, pourquoi maintenant, ce qui existe déjà, ce qui a déjà été essayé, contraintes, personnes concernées, craintes. Préciser que l'ordre et la forme n'ont aucune importance.
3. **Demander au moins un exemple concret, idéalement plusieurs**, racontés du début à la fin : « Décris-moi un cas réel : qu'est-ce qui arrive, qu'est-ce qui doit se passer, qu'est-ce que tu vois à la fin ? ». Viser au minimum le cas normal, et si possible aussi un cas limite et un cas qui ne doit rien déclencher. Des vraies données (mail, message, ligne de tableau) valent mieux qu'une description.

Cette question est obligatoire : un besoin sans exemple reste abstrait, et c'est dans les exemples qu'apparaissent les cas oubliés. Tant qu'aucun exemple n'a été donné, la reposer au tour suivant. Chaque exemple devient ensuite un critère de réussite de la spec (entrée → résultat attendu).

Si la demande couvre plusieurs sous-projets indépendants, le signaler tout de suite et proposer de les découper. On interviewe ensuite le premier sous-projet seulement.

## 2. Séries de questions numérotées

À chaque tour, envoyer **5 à 10 questions numérotées**, regroupées par thème. L'utilisateur doit pouvoir répondre en abrégé (« 1 : oui, 2 : voir le doc X, 3 : non »).

Thèmes à couvrir au fil des tours :
- **Déclencheur** : quel événement démarre tout, à quelle fréquence, en quel volume ?
- **Livrable** : qu'est-ce qui doit exister à la fin, sous quelle forme, pour qui ? Comment saura-t-on que ça marche ?
- **Cas exclus** : qu'est-ce qui ne doit *pas* déclencher ou être traité ?
- **Outils et accès** : quels outils, quels accès sont déjà disponibles, lesquels manquent ?
- **Pannes** : que se passe-t-il si un outil tombe, si une donnée est absente ou malformée ? Qui est prévenu ?
- **Contraintes** : budget, délais, données sensibles (RGPD), personnes à consulter.

Règles de formulation :
- **Proposer une réponse par défaut** quand c'est possible : « 3. Fréquence : je partirais sur toutes les 5 min, ça te va ? ». Répondre « ok » doit suffire.
- **Poser les questions qui changent la construction**, pas celles dont la réponse ne changerait rien.
- **Ne pas reposer** une question dont la réponse a déjà été donnée ou trouvée dans l'existant.

## 3. Challenger et simplifier, à chaque tour

Chaque tour de questions se termine par deux blocs obligatoires.

**Simplifications proposées** : au moins une par tour, formulée comme une vraie proposition. Leviers :
- **Et si on ne le faisait pas ?** Quel est le coût réel de ne rien automatiser ?
- **La moitié d'abord** : quelle version réduite apporte déjà l'essentiel ?
- **Manuel d'abord** : une étape rare ou délicate peut rester manuelle au départ.
- **Réutiliser** un outil, un workflow ou un accès déjà en place plutôt qu'en ajouter un nouveau.
- **Règle simple avant IA** : si quelques règles suffisent, pas besoin d'un modèle.
- **Moins d'étapes** : fusionner, supprimer ce qui ne sert qu'à « faire propre ».

**Hypothèses que je fais** : la liste de ce que tu supposes sans que l'utilisateur l'ait dit. Chaque hypothèse non confirmée devient une question du tour suivant ou un point ouvert de la spec.

Challenger aussi le *pourquoi* quand le besoin semble découler d'une solution déjà choisie (« il faut un Slack » : pour quel problème ?). Le but n'est pas de contredire, c'est de construire la bonne chose, et la plus petite possible.

## 4. Savoir s'arrêter

L'interview est terminée quand tu peux poser des questions sur les **cas limites et les compromis** sans avoir besoin qu'on te réexplique les bases.

- Moins de 3 questions utiles restantes : passer à la spec. Les derniers inconnus deviennent des points ouverts.
- Après 3 tours, s'il reste encore beaucoup de flou : le dire franchement et proposer soit un prototype jetable pour trancher, soit de réduire le périmètre.

Avant d'écrire la spec, demander : « Autre chose à ajouter avant que je rédige la spec ? »

## 5. Rédiger la spec et attendre la validation

1. Rédiger la spec avec le modèle [references/spec-template.md](references/spec-template.md). Séparer clairement ce que l'utilisateur a dit de ce qui est supposé.
2. **Relecture avant envoi** :
   - aucun « à définir » caché : chaque inconnu est dans *Points ouverts* ;
   - aucune contradiction entre sections ;
   - aucune exigence interprétable de deux façons (sinon choisir et l'écrire) ;
   - chaque élément du livrable sert un besoin exprimé, sinon le retirer.
3. Enregistrer la spec **dans le repo du projet** : `specs/AAAA-MM-JJ-<nom-court>.md`. Créer le dossier `specs/` s'il n'existe pas.
4. Présenter un résumé de 5 lignes, avec le chemin du fichier, et **s'arrêter**. Demander explicitement : « Je construis sur cette base ? »
5. Quand l'utilisateur répond oui : commiter la spec, puis seulement commencer la construction, avec la skill `doubt-driven-dev`. S'il demande des changements : modifier la spec, refaire la relecture, redemander.

Une validation porte sur ce qui a été montré. Valider l'idée ne valide pas une spec qui n'existe pas encore.

## Signaux d'alarme

| Pensée | Réalité |
|---|---|
| « C'est simple, je peux construire directement » | Les idées simples cachent les cas limites. Une interview courte (un tour) reste une interview. |
| « Je pose les questions et je commence en attendant » | Le blocage, c'est la validation, pas la longueur. On présente, puis on attend. |
| « Je vais tout lui demander, au cas où » | Seules les questions qui changent la construction méritent d'être posées. |
| « J'ai compris l'idée, pas besoin d'exemple » | Sans exemple concret, on construit ce qu'on imagine, pas ce qui arrive vraiment. En demander au moins un. |
| « Il a dit Slack, donc c'est Slack » | Une solution citée n'est pas un besoin. Vérifier le problème derrière. |
| « Pas de simplification à proposer cette fois » | Il y en a toujours une à tester, même si elle est refusée. |
| « Je suppose que… » (sans le dire) | Toute hypothèse est écrite dans « Hypothèses que je fais ». |
| « Ça a grossi en route, mais je continue » | Un nouveau sous-projet apparaît : le signaler et proposer de découper. |
