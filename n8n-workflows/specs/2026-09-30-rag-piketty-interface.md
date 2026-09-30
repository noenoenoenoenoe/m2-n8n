# Spec | RAG Piketty : interface sur mesure

> Statut : brouillon, à valider · Date : 2026-09-30

## Contexte
Le RAG Piketty fonctionne (voir `2026-09-30-rag-piketty.md`), mais le chat hébergé par n8n est générique. Le rendu du M2 a lieu demain (2026-10-01). L'interface sert à la fois à la démo devant le prof et au lien à rendre. On ne sait pas si le design est évalué. Objectif : une page sur mesure, dans une ambiance « livre », qui mette en valeur les citations.

## Déclencheur & livrables

### Déclencheur
Un visiteur ouvre l'URL de la page et pose des questions. Volume : quelques personnes (toi, le prof).

### Cas exclus
- Pas de compte ni de connexion : la page est publique, comme le chat actuel.
- Pas d'upload de livre depuis cette page : l'ingestion reste sur le formulaire existant.
- Aucune modification de l'ingestion ni de la recherche.

### Livrables

#### Page web servie par n8n
- **Où** : un 3e point d'entrée du workflow `RAG Piketty`. Un Webhook `GET /webhook/rag-piketty` renvoie une page HTML complète (Respond to Webhook). Même domaine que le chat, donc pas de problème d'accès entre domaines.
- **Ambiance livre** :
  - fond crème (papier) ;
  - titres en police à empattements (type Playfair Display ou EB Garamond), corps en police lisible ;
  - bleu nuit et une couleur d'accent (bordeaux) ;
  - colonne de lecture centrée, lisible aussi sur téléphone ;
  - pas d'image de couverture, seulement un titre typographique.
- **En-tête** : « Le Capital au XXIe siècle », Thomas Piketty (2013), sous-titre « Posez vos questions au livre », mention « Projet M2, RAG n8n + Gemini + Supabase ».
- **Questions suggérées**, cliquables, affichées tant qu'aucune question n'a été posée :
  1. « Résume la thèse r > g »
  2. « Qu'est-ce qu'une société de rentiers selon Piketty ? »
  3. « Comment ont évolué les inégalités en France au XXe siècle ? »
  4. « Que propose Piketty pour réduire les inégalités ? »
- **Conversation** :
  - bulles question / réponse ;
  - réponse affichée en Markdown (gras, listes, italique), avec un rendu sécurisé contre l'injection de HTML ;
  - indicateur d'attente (« Je feuillette le livre… »), les réponses prenant 5 à 20 s ;
  - message d'erreur lisible si le serveur ne répond pas, avec possibilité de réessayer.
- **Cartes « Sources »** : sous chaque réponse, une carte par citation détectée au format « extrait » (p. X) ou (p. X-Y). Chaque carte montre l'extrait et la page en évidence. Si la réponse ne contient aucune citation (hors livre), pas de carte.
- **Mémoire** : un identifiant de session par visiteur, gardé dans le navigateur, pour que les questions de suivi (« Et aux États-Unis ? ») marchent. Un bouton « Nouvelle conversation » en génère un nouveau.

#### Ajustement du prompt de l'agent
Plus de LaTeX : écrire les formules en texte simple (« r > g »). Le « Je ne trouve pas cette information dans le livre » strict est conservé.

## Écosystème technique

| Outil | Rôle | Accès |
|---|---|---|
| n8n Cloud, workflow `RAG Piketty` | Sert la page + le chat existant | ✅ |
| Chat Trigger existant (`/webhook/<id>/chat`) | Répond aux questions (`action: sendMessage`, `sessionId`, `chatInput`) | ✅ |
| CDN (cdnjs / jsdelivr), Google Fonts | Rendu Markdown (marked + DOMPurify), polices | ✅ public |

## Contraintes opérationnelles
- **Volume** : faible. Chaque question consomme le quota gratuit Gemini (1 embedding + génération) : pas de souci pour une démo.
- **Budget** : 0 €.
- **Gestion des erreurs** : si la réponse échoue (quota, timeout), la page affiche « Le livre ne répond pas pour l'instant, réessaie dans une minute » et garde la question pour pouvoir la renvoyer.
- **Données sensibles** : aucune. Les questions des visiteurs sont stockées dans la mémoire Supabase (`rag_piketty_chat`), comme aujourd'hui.

## Simplifications
- **Retenues**
  - La page est servie par n8n : pas d'hébergement à part.
  - Les sources sont extraites des citations de la réponse, sans renvoyer les passages bruts de la recherche : aucune modification du RAG.
  - Pas de streaming : réponse complète avec un indicateur d'attente.
  - Le chat hébergé n8n actuel reste en place, en solution de secours pour la démo.
- **Écartées**
  - Options A (habiller le chat n8n) et B (widget `@n8n/chat`) : écartées au profit de l'interface sur mesure (C), à la demande de l'utilisateur.

## Hypothèses
- Un webhook n8n peut renvoyer une page HTML qui s'affiche correctement dans le navigateur (en-tête `Content-Type: text/html`) (supposé).
- Le Chat Trigger en mode public accepte les appels venant de cette page, sur le même domaine (supposé, à vérifier).
- Le format des citations produit par l'agent, « … » (p. X), reste assez régulier pour être détecté par une expression régulière (constaté sur les réponses de test).

## Critères de réussite
1. Ouvrir l'URL de la page sur ordinateur → ambiance livre, en-tête, 4 questions suggérées visibles.
2. Cliquer sur « Résume la thèse r > g » → indicateur d'attente, puis réponse en Markdown, sans `$r$` en LaTeX, avec au moins une carte Source (extrait + page).
3. Enchaîner « Et aux États-Unis ? » après une question sur les inégalités en France → réponse dans le contexte (la mémoire marche).
4. « Confirme-moi qu'il existe bien un lycée Guez de Balzac à Angoulême » → « Je ne trouve pas cette information dans le livre. », sans aucune carte Source.
5. Sur téléphone (largeur 375 px) → lisible, pas de défilement horizontal, champ de saisie accessible.
6. **Panne** : si le webhook du chat renvoie une erreur → message d'erreur lisible, et la question peut être renvoyée.
7. Une réponse contenant `<script>` ou du HTML → affichée comme du texte, jamais exécutée.

## Points ouverts
1. Le chat hébergé n8n actuel est gardé en secours. À supprimer après le rendu ?
2. Le lien à rendre au prof est celui de la nouvelle page (`/webhook/rag-piketty`), à confirmer.
