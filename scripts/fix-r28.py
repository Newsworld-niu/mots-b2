import json
import sys

with open('data/lexicon.json') as f:
    lex = json.load(f)

entries = lex['entries']
entry_by_id = {e['id']: e for e in entries}

# ========== Fix 1: Add utilité ==========
if 'utilite' not in entry_by_id:
    new_entry = {
        'id': 'utilite',
        'lemma': 'utilité',
        'pos': 'n.f.',
        'level': 'unverified',
        'levelBasis': '未核实：书籍为 B2 教材，逐词等级未确认',
        'topic': 'education',
        'senses': [{'zh': '效用；用途', 'fr': '', 'origin': 'supplement', 'status': '补充翻译·待核对'}],
        'examples': [], 'col': [], 'fam': [], 'syn': [], 'ant': [], 'tip': '',
        'note': "教材 Lexique p.139 原文：utilité (f.), l'（OCR 将 l' 误识为 1»）",
        'sources': [
            {'book': 'Vocabulaire DELF B2 3000 mots.pdf', 'kind': 'theme-list', 'chapter': 'Lexique indispensable pour le DELF B2', 'printedPage': 139, 'pdfPage': 139},
            {'book': 'Vocabulaire DELF B2 3000 mots.pdf', 'kind': 'lesson', 'chapter': 'Lexique indispensable pour le DELF B2（DELF B2）', 'printedPage': 139, 'pdfPage': 139}
        ],
        'review': 'unreviewed'
    }
    entries.append(new_entry)
    print('Fix 1: Added utilité (id=utilite)')
else:
    print('Fix 1: utilite already exists, skipped')

# ========== Fix 2: chicule → aliasOf vehicule ==========
chicule = entry_by_id.get('chicule')
vehicule = entry_by_id.get('vehicule')
if chicule and vehicule and not chicule.get('aliasOf'):
    vehicule_sources = vehicule.get('sources', [])
    vehicule_keys = {(s.get('book'), s.get('kind'), s.get('printedPage'), s.get('pdfPage')) for s in vehicule_sources}
    added = 0
    for s in chicule.get('sources', []):
        key = (s.get('book'), s.get('kind'), s.get('printedPage'), s.get('pdfPage'))
        if key not in vehicule_keys:
            vehicule_sources.append(s)
            added += 1
    chicule['aliasOf'] = 'vehicule'
    chicule['senses'] = [{'zh': '', 'fr': '', 'origin': 'book'}]
    chicule['note'] = 'OCR 误拆词：原书 p.139 的 véhicule 被误拆为 véhıcule + chicule, le。已别名至 véhicule。'
    print(f'Fix 2: chicule → aliasOf vehicule, merged {added} source(s)')
else:
    print('Fix 2: chicule fix already applied or missing')

# ========== Fix 3: vole-f placeholder gloss → empty ==========
volef = entry_by_id.get('vole-f')
if volef and volef.get('senses') and volef['senses'][0].get('zh'):
    volef['senses'] = [{'zh': '', 'fr': '', 'origin': 'book'}]
    volef['note'] = 'OCR p.139 原文：vole, la。法语中作为独立阴性名词极罕见，疑似 voile 之误识，但无原图无法确认。保留待核实，释义待补充。'
    print('Fix 3: vole-f cleared placeholder gloss')
else:
    print('Fix 3: vole-f fix already applied or missing')

# ========== Fix 4: téléscope → télescope ==========
telescope = entry_by_id.get('telescope')
if telescope and telescope['lemma'] == 'téléscope':
    telescope['lemma'] = 'télescope'
    telescope['note'] = 'OCR 重音误识：原文为 téléscope（lé 误为 lé）。已修正为规范拼写 télescope。'
    print('Fix 4: Changed lemma from téléscope to télescope')
else:
    print('Fix 4: telescope fix already applied or not found')

# ========== Fix 5: volant → aliasOf volant-m ==========
volant = entry_by_id.get('volant')
volantm = entry_by_id.get('volant-m')
if volant and volantm and not volant.get('aliasOf'):
    volantm_sources = volantm.get('sources', [])
    vm_keys = {(s.get('book'), s.get('kind'), s.get('printedPage'), s.get('pdfPage')) for s in volantm_sources}
    added = 0
    for s in volant.get('sources', []):
        key = (s.get('book'), s.get('kind'), s.get('printedPage'), s.get('pdfPage'))
        if key not in vm_keys:
            volantm_sources.append(s)
            added += 1
    volant['aliasOf'] = 'volant-m'
    volant['senses'] = [{'zh': '', 'fr': '', 'origin': 'book'}]
    volant['note'] = 'OCR p.139 原文：volant, le → 实为 n.m.（方向盘）。词性与 volant-m 一致，已合并。'
    print(f'Fix 5: volant → aliasOf volant-m, merged {added} source(s)')
else:
    print('Fix 5: volant fix already applied or missing')

# ========== Fix 6: wagon- → aliasOf wagon ==========
wagon_dash = entry_by_id.get('wagon-')
wagon = entry_by_id.get('wagon')
if wagon_dash and wagon and not wagon_dash.get('aliasOf'):
    wagon_sources = wagon.get('sources', [])
    wg_keys = {(s.get('book'), s.get('kind'), s.get('printedPage'), s.get('pdfPage')) for s in wagon_sources}
    added = 0
    for s in wagon_dash.get('sources', []):
        key = (s.get('book'), s.get('kind'), s.get('printedPage'), s.get('pdfPage'))
        if key not in wg_keys:
            wagon_sources.append(s)
            added += 1
    wagon_dash['aliasOf'] = 'wagon'
    wagon_dash['senses'] = [{'zh': '', 'fr': '', 'origin': 'book'}]
    wagon_dash['note'] = 'OCR p.139 原文：wagon, le → 实为 n.m.（车厢）。词性与 wagon 一致，已合并。'
    print(f'Fix 6: wagon- → aliasOf wagon, merged {added} source(s)')
else:
    print('Fix 6: wagon- fix already applied or missing')

# ========== Inline integrity check ==========
problems = []
ids = set()
keys = set()
for e in entries:
    eid = e.get('id')
    if eid in ids:
        problems.append(f'dup id: {eid}')
    ids.add(eid)
    if e.get('aliasOf'):
        continue
    key = e['lemma'] + '|' + e['pos']
    if key in keys:
        problems.append(f'dup key: {key} (id={eid})')
    keys.add(key)
    if not e.get('senses'):
        problems.append(f'no senses: {eid}')
    if not e.get('sources'):
        problems.append(f'no sources: {eid}')

if problems:
    for p in problems[:20]:
        print('PROBLEM:', p)
    sys.exit(1)
else:
    alias_count = sum(1 for e in entries if e.get('aliasOf'))
    visible_count = len([e for e in entries if not e.get('aliasOf')])
    print(f'Integrity OK: entries={len(entries)}, aliases={alias_count}, visible={visible_count}')

with open('data/lexicon.json', 'w') as f:
    json.dump(lex, f, ensure_ascii=False, indent=2)
print('Saved data/lexicon.json')
