"""Injecte interface/rag-piketty.html dans le nœud « Servir Page » du workflow RAG Piketty.
Usage : python3 interface/build.py   (depuis n8n-workflows/), puis n8ncli push."""
import json, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
wf = root / 'n8n/workflows/RAG Piketty.workflow.ts'
html = (root / 'interface/rag-piketty.html').read_text()
s = wf.read_text()
pat = re.compile(r"(name: 'Servir Page', parameters: \{ respondWith: 'text', responseBody: )(\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*')")
assert pat.search(s), 'nœud Servir Page introuvable'
s = pat.sub(lambda m: m.group(1) + json.dumps(html, ensure_ascii=False), s, count=1)
wf.write_text(s)
print('HTML injecté :', len(html), 'caractères')
