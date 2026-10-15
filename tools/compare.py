"""Before | after composites for every state shot in both folders.

    python3 -I tools/compare.py

Writes docs/redesign/compare/<state>@<size>.jpg for every file present in both
docs/redesign/before/ and docs/redesign/after/, plus compare/index.txt.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, 'docs/redesign/before')
A = os.path.join(ROOT, 'docs/redesign/after')
C = os.path.join(ROOT, 'docs/redesign/compare')
os.makedirs(C, exist_ok=True)
names = sorted(f for f in os.listdir(A) if f.endswith('.jpg') and os.path.exists(os.path.join(B, f)) and not f.startswith('motion-'))
for f in names:
    title = f[:-4].replace('@', '  ·  ')
    subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'tools/browser/sheet.py'), '--pair', os.path.join(B, f), os.path.join(A, f), os.path.join(C, f), title], check=True)
with open(os.path.join(C, 'index.txt'), 'w') as fh:
    fh.write('\n'.join(names) + '\n')
print(len(names), 'composites')
