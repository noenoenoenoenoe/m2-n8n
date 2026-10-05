# Spec | RAG Piketty : interface sur mesure

> Statut : validée, construite · Date : 2026-09-30

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
- **Où** : un petit workflow séparé, `RAG Piketty Page` (`udkOL3lt2slsTFP3`). Un Webhook `GET /webhook/rag-piketty` renvoie la page HTML (Respond to Webhook). Il est séparé parce que la page s'ouvre souvent : ses exécutions ne sont pas enregistrées (`saveDataSuccessExecution: none`), alors que le workflow principal garde les siennes pour le débogage.
- n8n sert la page dans un « bac à sable » (CSP `sandbox` sans `allow-same-origin`) : l'origine vaut `null`, `localStorage` est bloqué, et l'appel à `POST /webhook/rag-piketty-ask` est cross-origin. Il ne fonctionne que grâce à `allowedOrigins: '*'` sur le nœud « POST /rag-piketty-ask ».
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
- **Mémoire** : un identifiant de session par visiteur, gardé dans l'URL (`#s=…`) car `localStorage` est bloqué par le bac à sable. Il survit au rechargement de la page. Un bouton « Nouvelle conversation » en génère un nouveau.

#### Ajustement du prompt de l'agent
Plus de LaTeX : écrire les formules en texte simple (« r > g »). Le modèle ne respecte pas toujours la consigne : la page retire aussi les délimiteurs `$…$` et `\(…\)` avant l'affichage. Les citations suivent un exemple concret (« extrait » (p. 63-64)). Un gabarit abstrait du type « … » (p. X) était recopié tel quel par le modèle. Le « Je ne trouve pas cette information dans le livre » strict est conservé.

## Écosystème technique

| Outil | Rôle | Accès |
|---|---|---|
| n8n Cloud, workflow `RAG Piketty` | Sert la page + le chat existant | ✅ |
| Webhook `POST /webhook/rag-piketty-ask` (nœud « POST /rag-piketty-ask ») | Entrée de la page : `{ sessionId, chatInput }` → `{ output }`, branché sur le même Agent RAG. Chemin fixe : l'ID du chat hébergé change à chaque `n8ncli push` et ne peut pas être codé en dur | ✅ |
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
- Un webhook n8n peut renvoyer une page HTML (vérifié : `text/html; charset=utf-8`, page identique à la source).
- Source de la page : `interface/rag-piketty.html`, injectée dans le nœud « Servir Page » du workflow `RAG Piketty Page` par `python3 interface/build.py` avant chaque push.
- Le Chat Trigger hébergé change d'ID à chaque push (constaté 3 fois) : la page passe donc par son propre webhook à chemin fixe. La mémoire prend la session du déclencheur utilisé (page ou chat hébergé).
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
2. Le lien à rendre au prof est celui de la nouvelle page (`https://votre-instance.app.n8n.cloud/webhook/rag-piketty`), à confirmer.
3. L'URL du chat hébergé de secours change à chaque push : la récupérer dans l'éditeur (nœud « Chat Livre ») avant la démo.
