# claude-skills

Skills Claude Code personnelles, en français.

Méthode de travail en **10 / 80 / 10** :

| Phase | Part | Skill | Rôle |
|---|---|---|---|
| Avant | 10 % | `interview` | Faire tout dire, challenger, creuser et simplifier le besoin avant de construire |
| Pendant | 80 % | *doubt-driven dev* | Développer en doutant de chaque hypothèse (à venir) |
| Après | 10 % | `hostile-review` | Relire le résultat comme un adversaire qui cherche à le casser |

## Installation

```bash
git clone https://github.com/noenoenoenoenoe/claude-skills.git ~/claude-skills
for s in ~/claude-skills/skills/*/; do ln -sfn "$s" ~/.claude/skills/"$(basename "$s")"; done
```

## Sources

Adaptées notamment de [anthropics/skills](https://github.com/anthropics/skills) (Apache 2.0) et [obra/superpowers](https://github.com/obra/superpowers) (MIT).
