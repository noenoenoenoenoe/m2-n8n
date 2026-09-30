# Modèle de spec

Remplir chaque section. Supprimer une section seulement si elle n'a vraiment aucun objet, et le signaler dans *Points ouverts*. Marquer **(supposé)** toute information qui n'a pas été confirmée par l'utilisateur.

```markdown
# Spec | <Nom du projet>

> Statut : brouillon — à valider · Date : AAAA-MM-JJ

## Contexte
Qui a le problème, lequel, et pourquoi le traiter maintenant. 3 à 6 lignes.

## Déclencheur & livrables

### Déclencheur
L'événement qui démarre tout. Fréquence et volume attendus.

### Cas exclus
Ce qui ne doit pas déclencher ou être traité.

### Livrables
Ce qui existe à la fin, sous quelle forme, pour qui. Un sous-titre par livrable.

## Écosystème technique

| Outil | Rôle | Accès |
|---|---|---|
| … | … | ✅ disponible / ⏳ à obtenir |

## Contraintes opérationnelles
- **Volume** :
- **Budget** :
- **Gestion des erreurs** : ce qui est réessayé, qui est prévenu, garantie qu'aucune donnée n'est perdue en silence.
- **Données sensibles** : ce qui circule, vers quels outils, validation nécessaire.

## Simplifications
- **Retenues** : ce qu'on a choisi de ne pas faire (ou de faire à la main) et pourquoi.
- **Écartées** : les simplifications proposées puis refusées, avec la raison.

## Hypothèses
Ce qui est supposé sans confirmation. Chaque ligne doit pouvoir être contredite.

## Critères de réussite
Comment on saura que ça marche : des cas de test concrets (entrée → résultat attendu), en partant des exemples donnés par l'utilisateur pendant l'interview. Y inclure au moins un cas exclu et un cas de panne.

## Points ouverts
Numérotés. Pour chacun : la décision attendue et ce qu'elle change dans la construction.
```
