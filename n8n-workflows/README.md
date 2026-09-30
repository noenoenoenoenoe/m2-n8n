# n8n-workflows

Workflows n8n de Troov, versionnés sous forme de code TypeScript (format `@n8n/workflow-sdk`) et synchronisés avec l'instance n8n via [`n8ncli`](.agents/skills/n8n/SKILL.md).

## Workflows

| Workflow | Déclencheur | Rôle |
|---|---|---|
| **Tri et Notification Mails Support (Test V3)** | IMAP (support@ et supportdedie@) | Tague la taille du client (proximité / grands comptes), filtre les mails exclus (spam, réponses de fil, mails automatiques), analyse l'urgence avec Gemini, puis notifie le channel Slack support. |
| Tri et Notification Mails Support (Test) | IMAP | Version précédente du même workflow (fournisseur IA non choisi). |
| Hello World | Manuel | Workflow de test (node Code). |
| Test Ping | Manuel | Workflow de test pour vérifier la synchronisation. |

Les specs détaillées (matrice taille client × urgence, mails exclus, TODO) sont dans les sticky notes de chaque workflow.

## Structure

```
n8n/
├── workflows/          # Workflows synchronisés (un fichier .workflow.ts par workflow)
└── config/
    ├── n8n-cli.json    # Environnement et projet n8n ciblés
    ├── n8n-standards.json
    ├── n8n-layout.json
    └── cache/          # Cache de n8ncli (par ID de workflow)
.agents/skills/n8n/     # Skill agent décrivant l'usage de n8ncli
```

Non versionnés (voir `.gitignore`) : `.env` (URL et tokens de l'instance), `sync-state.json`, `n8n/references/`.

## Utilisation

```bash
n8ncli pull              # récupérer les workflows depuis n8n
n8ncli status            # voir les fichiers modifiés / non suivis
n8ncli diff --semantic   # comparer local vs n8n (sans les déplacements de nodes)
n8ncli validate --lint   # valider syntaxe, schéma et standards
n8ncli test "<fichier>"  # exécution de test avec pin data mockées
n8ncli push              # déployer les modifications locales sur n8n
```

Pense à faire `pull` avant de modifier un workflow, puis à commiter après un `push` pour garder le repo et l'instance alignés.
