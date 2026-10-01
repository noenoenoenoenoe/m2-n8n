"""Injecte interface/rag-piketty.html dans le nœud « Servir Page » du workflow RAG Piketty Page.
Usage : python3 interface/build.py   (depuis n8n-workflows/), puis n8ncli push."""
import json, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
wf = root / 'n8n/workflows/RAG Piketty Page.workflow.ts'
html = (root / 'interface/rag-piketty.html').read_text(encoding='utf-8')
s = wf.read_text(encoding='utf-8')
# Le nœud peut avoir ses paramètres dans n'importe quel ordre (le fichier est régénéré par n8ncli pull).
start = s.index("name: 'Servir Page'")
pat = re.compile(r"(responseBody: )(\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*')")
m = pat.search(s, start)
assert m, 'nœud Servir Page introuvable'
s = s[:m.start()] + m.group(1) + json.dumps(html, ensure_ascii=False) + s[m.end():]
wf.write_text(s, encoding='utf-8')
print('HTML injecté :', len(html), 'caractères')
