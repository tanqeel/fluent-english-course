#!/usr/bin/env python3
"""Post-process converted modules: enforce <=4 drills/lesson, wire audio steps."""
import json, os, copy

PWA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(PWA, 'content')

def load(m): return json.load(open(os.path.join(C, f'module-{m}.json')))
def save(m, d): json.dump(d, open(os.path.join(C, f'module-{m}.json'), 'w'), indent=1, ensure_ascii=False)

def drills(l): return [s for s in l['steps'] if s.get('type') == 'drill']
def teach(l): return [s for s in l['steps'] if s.get('type') == 'teach']

def shadow_step(sid, title, text, audio, tip=''):
    return {'id': sid, 'type': 'drill', 'engine': 'shadowing', 'title': title,
            'text': text, 'audio': audio, 'tip': tip, 'xp': 15}

# ---------------- ACCURACY rebalance ----------------
m = load('accuracy')
L = {l['id']: l for l in m['lessons']}
l1, l2, l3, l4, l5, l6 = (L[f'accuracy-l{i}'] for i in range(1, 7))

art_fix = drills(l1)          # 10 article fix
prep    = drills(l2)          # 5 fill + 1 mc
pp      = drills(l3)          # 1 journal (present perfect)
wo      = drills(l4)          # 1 journal (word order)
sv_fix  = drills(l5)          # 5 subj-verb fix
art_teach, l6_teach = teach(l1), teach(l6)
prep_teach, sv_teach = teach(l2), teach(l5)
pp_teach, wo_teach = teach(l3), teach(l4)

def mk(lid, title, minutes, steps, xp=50):
    return {'id': lid, 'title': title, 'minutes': minutes, 'steps': steps, 'xp': xp}

bridge_l2 = {'type': 'teach', 'heading': 'Still articles — new reps',
    'body': 'Same system as Part 1: **a/an** = first mention, **the** = the listener knows which one. These reps mix every article rule — say each fixed sentence out loud.'}
bridge_l5 = {'type': 'teach', 'heading': 'Two topics, one lesson',
    'body': 'First: preposition reps. Then one agreement fix, then a present-perfect writing task. Switching gears fast is fluency training.'}

new_lessons = [
    mk('accuracy-l1', 'Articles, part 1: the system', 12, art_teach[:4] + art_fix[:4]),
    mk('accuracy-l2', 'Articles, part 2: mixed reps', 12, [bridge_l2] + art_teach[4:] + art_fix[4:8]),
    mk('accuracy-l3', 'Countable nouns + article review', 12,
       l6_teach + wo_teach + art_fix[8:] + wo +
       [shadow_step('accuracy-l3-chant', 'Article chant (audio)', 'a client, the client — first mention a, known thing the', 'audio/07-accuracy-chants.mp3',
                    'Chant along with the audio, then record yourself.')]),
    mk('accuracy-l4', 'Prepositions, part 1', 12, prep_teach + prep[:4]),
    mk('accuracy-l5', 'Prepositions, part 2 + present perfect', 12,
       [bridge_l5] + prep[4:] + sv_fix[:1] + pp_teach + pp),
    mk('accuracy-l6', 'Subject–verb agreement', 12, sv_teach + sv_fix[1:]),
]
# keep quiz + checkpoint at the end, in original order
tail = [l for l in m['lessons'] if l['id'] not in {f'accuracy-l{i}' for i in range(1, 7)}]
m['lessons'] = new_lessons + tail
save('accuracy', m)
print('accuracy rebalanced:', [(l['id'], len(drills(l))) for l in new_lessons])

# ---------------- SELF-PRESENTATION: move 1 drill l3 -> l2 ----------------
m = load('self-presentation')
L = {l['id']: l for l in m['lessons']}
l2, l3 = L['self-presentation-l2'], L['self-presentation-l3']
mv = [s for s in drills(l3) if s.get('engine') == 'fix-sentence'][:1]
l3['steps'] = [s for s in l3['steps'] if s not in mv]
# insert moved drill after l2's existing drill
idx = max([i for i, s in enumerate(l2['steps']) if s.get('type') == 'drill'] or [len(l2['steps']) - 1])
l2['steps'].insert(idx + 1, mv[0])
save('self-presentation', m)
print('self-presentation:', [(l['id'], len(drills(l))) for l in m['lessons'] if l['id'].startswith('self-presentation-l')])

# ---------------- AUDIO warm-up shadowing steps ----------------
def add_shadow(mod, lid, sid, title, text, audio, tip=''):
    m = load(mod)
    l = next(x for x in m['lessons'] if x['id'] == lid)
    # insert after last teach card
    idx = max([i for i, s in enumerate(l['steps']) if s.get('type') == 'teach'] or [-1])
    l['steps'].insert(idx + 1, shadow_step(sid, title, text, audio, tip))
    save(mod, m)
    print(f'{mod}/{lid}: +shadowing ({len(drills(l))} drills)')

add_shadow('foundations', 'foundations-l1', 'foundations-l1-warmup', 'Daily warm-up (audio)',
           'Shadow this 60-second warm-up every day before you start', 'audio/08-daily-warmup.mp3',
           'Do this first every day — it switches your brain to English.')
add_shadow('pronunciation', 'pronunciation-l1', 'pronunciation-l1-demo', 'Shadowing demo (audio)',
           'Listen once, then shadow line by line with the recording', 'audio/01-shadowing-demo.mp3',
           'Copy the music of the voice, not just the words.')
add_shadow('client-communication', 'client-communication-l1', 'client-communication-l1-call',
           'Discovery call — listen & shadow (audio)', 'Shadow a real discovery call opening',
           'audio/03-discovery-call.mp3', 'Notice the questions the freelancer asks.')
add_shadow('client-communication', 'client-communication-l2', 'client-communication-l2-phrases',
           'Client phrases (audio)', 'Shadow the phrases clients actually say',
           'audio/04-client-phrases.mp3')
add_shadow('self-presentation', 'self-presentation-l1', 'self-presentation-l1-intro',
           'Self-intro model (audio)', 'Shadow a strong 60-second self-introduction',
           'audio/05-self-intro.mp3', 'Steal the structure, keep your own facts.')
add_shadow('sales', 'sales-l1', 'sales-l1-neg', 'Negotiation lines (audio)',
           'Shadow confident negotiation lines', 'audio/06-negotiation.mp3',
           'Say them until they feel like your own words.')

# ---------------- final audit ----------------
print('\n=== FINAL AUDIT ===')
for mod in ['foundations', 'accuracy', 'pronunciation', 'fluency', 'client-communication', 'self-presentation', 'sales']:
    m = load(mod)
    n = len(m['lessons'])
    bad = [(l['id'], len(drills(l))) for l in m['lessons'] if len(drills(l)) > 4]
    assert 4 <= n <= 8, f'{mod}: {n} lessons out of range!'
    assert not bad, f'{mod}: too many drills: {bad}'
    print(f'{mod}: {n} lessons ✓ (max drills: {max(len(drills(l)) for l in m["lessons"])})')
print('ALL MODULES OK ✓')
