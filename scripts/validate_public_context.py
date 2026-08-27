#!/usr/bin/env python3
import json, sys
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'data'/'public-context.json'
try:
    x=json.loads(p.read_text('utf-8'))
except Exception as e:
    raise SystemExit(f'INVALID JSON: {e}')
errors=[]
if x.get('schema_version')!=2: errors.append('schema_version != 2')
if not isinstance(x.get('works'),list): errors.append('works missing')
if not isinstance(x.get('weather'),list): errors.append('weather missing')
if not isinstance(x.get('source_health'),list): errors.append('source_health missing')
if not isinstance(x.get('clermont_api',{}).get('health'),dict): errors.append('clermont_api.health missing')
for w in x.get('works',[]):
    if not isinstance(w,dict) or not w.get('sector') or not w.get('text'): errors.append('invalid works row'); break
if errors: raise SystemExit('INVALID CONTEXT: '+'; '.join(errors))
print(f"OK schema=2 status={x.get('status')} works={len(x.get('works',[]))} parking={len(x.get('parking',[]))} sources={len(x.get('source_health',[]))}")
