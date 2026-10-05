---
name: hostile-review
description: Relit un travail terminé en adversaire, en partant du principe qu'il est faux jusqu'à preuve du contraire. Il cherche à le casser (cas limites, pannes, pertes silencieuses, écarts avec la spec, affirmations non prouvées) et rend un verdict argumenté avec des défauts démontrés. Utilise cette skill dès que l'utilisateur demande une relecture ou une validation (« review », « relis ça », « c'est prêt ? », « vérifie », « on peut mettre en prod ? »), et systématiquement avant d'annoncer qu'un workflow, un script, du code ou une fonctionnalité est terminé, corrigé ou prêt, même si tout semble marcher.
---

# Hostile review

Relire le livrable comme quelqu'un qui **veut** y trouver des défauts. Ce sont les derniers 10 % du travail : ce qui n'est pas trouvé ici sera trouvé en production, par les utilisateurs.

**Principe : le travail est faux jusqu'à preuve du contraire.** Un outil qui affiche « succès », un test qui passe une fois, un « ça devrait marcher » : rien de tout cela n'est une preuve. Une preuve, c'est une vérification exécutée maintenant, dont on a lu le résultat.

<LECTURE-SEULE>
La relecture ne modifie rien : pas d'édition de fichier, pas de commit, pas de push, pas de déploiement, pas d'envoi de message ou de mail, pas de relance d'exécution.
Elle peut lire, comparer, exécuter des tests et des commandes sans effet de bord, et récupérer une copie de ce qui est déployé dans un dossier temporaire.
Une vérification qui aurait un effet de bord est **proposée** dans le rapport, pas exécutée.
</LECTURE-SEULE>

## 1. Rassembler le dossier

Avant de lancer la relecture, réunir :
- **La spec** : `specs/` du repo, sticky note « Specs », ticket, ou à défaut le besoin tel que l'utilisateur l'a exprimé. Si aucune spec n'existe, le signaler : le relecteur jugera sur ce qu'une personne raisonnable attendrait.
- **Le livrable** : les fichiers ou le diff concernés (`git diff <base>..HEAD`), et **la version réellement déployée** si elle peut différer de la version locale.
- **Les moyens de vérifier** : commandes de test, accès en lecture aux exécutions, logs, données d'exemple.

**Si le livrable est un workflow n8n**, lire [references/n8n.md](references/n8n.md) maintenant.

## 2. Confier la relecture à un sous-agent

Lancer un sous-agent `general-purpose` avec le brief de [references/reviewer-prompt.md](references/reviewer-prompt.md), rempli avec le dossier.

- Lui donner **uniquement** la spec, le livrable et les moyens de vérifier. **Jamais** l'historique de la conversation, ni les explications de l'auteur sur ses choix : le relecteur doit juger le résultat, pas le raisonnement qui y a mené.
- Si aucun sous-agent n'est disponible, faire la relecture soi-même avec le même brief, et l'indiquer en tête du rapport (« relecture faite par l'auteur, moins fiable »).

## 3. Transmettre le rapport tel quel

- Présenter le rapport **sans l'adoucir** : ne supprimer, ne reclasser et ne minimiser aucun défaut.
- Si tu contestes un point, l'écrire à part, sous « Réponse de l'auteur », avec une preuve. L'utilisateur tranche.
- Ne rien corriger à ce stade. C'est l'utilisateur qui choisit quels défauts corriger.

## 4. Après les corrections

Relancer une relecture ciblée : les défauts corrigés (sont-ils vraiment corrigés, preuve à l'appui ?) et les régressions possibles autour. Un défaut n'est « corrigé » que si le scénario qui cassait a été rejoué et ne casse plus.

## Où chercher

Le relecteur passe au minimum par ces angles :
- **Écarts avec la spec** : chaque exigence, chaque critère de réussite, chaque cas exclu est-il couvert ? Une exigence manquante est un défaut.
- **Silences de la spec** : un comportement non spécifié se juge sur ce qu'une personne raisonnable attendrait. Le silence de la spec n'est pas une permission.
- **Entrées hostiles** : vide, absent, en double, énorme, malformé, caractères spéciaux, fuseaux horaires, format inattendu d'un champ (objet au lieu de texte…).
- **Pannes** : un outil externe tombe, répond lentement, répond une erreur ; échec au milieu d'un traitement ; réessais qui créent des doublons.
- **Pertes silencieuses** : un élément peut-il disparaître sans que personne ne le sache ? Chaque branche qui « ne fait rien » est suspecte.
- **Affirmations non prouvées** : tout « ça marche », « c'est déployé », « c'est testé » dans le livrable ou ses notes doit être vérifié.
- **Écart local / déployé** : ce qui tourne réellement est-il bien ce qui a été relu ?
- **Sécurité et données** : secrets exposés, données personnelles envoyées à des tiers ou affichées trop largement.

## Format du rapport

```markdown
## Hostile review — <livrable>

**Verdict : Pas prêt | Prêt avec corrections | Prêt**
<1-2 phrases qui justifient le verdict>

### Bloquant
1. **<titre court>** — `<emplacement>`
   - Scénario : <entrée ou situation concrète> → <ce qui se passe>
   - Preuve : <commande exécutée et résultat, ou ligne précise>
   - Correction suggérée : <si elle n'est pas évidente>

### Important
…

### Mineur
…

### Soupçons non démontrés
Ce qui semble fragile mais n'a pas pu être prouvé, et la vérification qui trancherait (y compris celles qui auraient un effet de bord).

### Écarté du jugement
Tout ce qui a été examiné puis laissé de côté, une ligne par point, avec la raison. Rien n'est écarté en silence.
```

- **Bloquant** : perte de données, résultat faux, crash, faille, exigence de la spec non remplie.
- **Important** : panne mal gérée, cas limite réaliste non couvert, écart local / déployé.
- **Mineur** : lisibilité, nommage, optimisation.
- Pas de section « points forts » : ce n'est pas le rôle de cette relecture.
- **Prêt** n'est permis que si aucun défaut Bloquant ou Important n'est ouvert et que les critères de réussite de la spec ont été vérifiés.

## Signaux d'alarme

| Pensée | Réalité |
|---|---|
| « L'outil dit succès » | Un message de succès n'est pas une preuve. Vérifier le résultat réel. |
| « J'ai testé tout à l'heure » | Seule une vérification exécutée maintenant compte. |
| « C'est un petit changement, pas besoin de relire » | Les petits changements cassent aussi. La relecture est plus courte, pas facultative. |
| « Je vais expliquer mes choix au relecteur » | Il juge le résultat. Tes explications l'influenceraient. |
| « Ce défaut est discutable, je l'enlève du rapport » | Tu le contestes à part, avec une preuve. L'utilisateur tranche. |
| « Je corrige vite fait pendant la relecture » | La relecture est en lecture seule. On rapporte, l'utilisateur décide. |
| « La spec ne dit rien là-dessus, donc c'est bon » | Le silence de la spec se juge sur les attentes d'une personne raisonnable. |
