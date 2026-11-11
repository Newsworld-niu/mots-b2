import json

with open('data/snapshots/lexicon-before-r29-cleanup.json') as f:
    before = json.load(f)
with open('data/lexicon.json') as f:
    after = json.load(f)

before_entries = {e['id']: e for e in before['entries']}
after_entries = {e['id']: e for e in after['entries']}

missing = [eid for eid in before_entries if eid not in after_entries]
print('Old IDs missing from new lexicon:', len(missing))

resolved = 0
changed_lemmas = []
for eid, e in before_entries.items():
    new = after_entries.get(eid)
    if new:
        resolved += 1
        if new['lemma'] != e['lemma']:
            changed_lemmas.append((eid, e['lemma'], new['lemma'], (new.get('note') or '')[:120]))

print('Old IDs resolved:', resolved, '/', len(before_entries))
print('Lemma changes (intentional):')
for eid, old, new, basis in changed_lemmas:
    print('  id=' + eid)
    print('    ' + repr(old) + ' -> ' + repr(new))
    print('    basis: ' + repr(basis))

alias_problems = []
for e in after['entries']:
    if e.get('aliasOf'):
        target = after_entries.get(e['aliasOf'])
        if not target:
            alias_problems.append(e['id'] + ' -> missing ' + e['aliasOf'])
        elif target.get('aliasOf'):
            alias_problems.append(e['id'] + ' -> chained alias ' + e['aliasOf'])
print('Alias resolution problems:', len(alias_problems))
for p in alias_problems:
    print('  ' + p)

before_src = sum(len(e.get('sources', [])) for e in before['entries'])
after_src = sum(len(e.get('sources', [])) for e in after['entries'])
print('Sources: before=' + str(before_src) + ' after=' + str(after_src) + ' delta=' + str(after_src - before_src))

for eid, old, new, _ in changed_lemmas:
    b = before_entries[eid]
    a = after_entries[eid]
    if len(a.get('sources', [])) != len(b.get('sources', [])):
        print('  SOURCE CHANGE for ' + eid + ': ' + str(len(b.get('sources', []))) + ' -> ' + str(len(a.get('sources', []))))

# Count review status
for label, lex in [('before', before), ('after', after)]:
    n = sum(1 for e in lex['entries'] if e.get('review') == 'unreviewed')
    print(label + ' unreviewed: ' + str(n))
