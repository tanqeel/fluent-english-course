#!/usr/bin/env python3
"""Phase-2 content builder: course-book.md + quizzes + speaking tasks -> pwa/content/*.json"""
import re, json, os, shutil, sys

SRC = os.path.expanduser('~/workspace/english-fluency-course')
PWA = os.path.join(SRC, 'pwa')
OUT = os.path.join(PWA, 'content')
AUD_SRC = os.path.join(SRC, 'audio')
AUD_DST = os.path.join(PWA, 'audio')
os.makedirs(OUT, exist_ok=True)
os.makedirs(AUD_DST, exist_ok=True)

MODMAP = {1:'foundations',2:'accuracy',3:'pronunciation',4:'fluency',
          5:'client-communication',6:'self-presentation',7:'sales'}
MODMETA = {
 'foundations':('Foundations','🧱','#34d399'),
 'accuracy':('Accuracy','🎯','#f472b6'),
 'pronunciation':('Pronunciation','🔊','#60a5fa'),
 'fluency':('Fluency','💬','#fbbf24'),
 'client-communication':('Client Communication','🤝','#a78bfa'),
 'self-presentation':('Self-Presentation & Branding','🌟','#f472b6'),
 'sales':('Sales','💼','#fb923c'),
}
AUDIO = {
 'foundations':('audio/08-daily-warmup.mp3','08-daily-warmup.txt'),
 'accuracy':('audio/07-accuracy-chants.mp3','07-accuracy-chants.txt'),
 'pronunciation':('audio/02-minimal-pairs.mp3','02-minimal-pairs.txt'),
 'fluency':('audio/01-shadowing-demo.mp3','01-shadowing-demo-passage.txt'),
 'client-communication':('audio/03-discovery-call.mp3','03-discovery-call.txt'),
 'self-presentation':('audio/05-self-intro.mp3','05-self-intro-natural.txt'),
 'sales':('audio/06-negotiation.mp3','06-negotiation.txt'),
}
AUDIO2 = {'client-communication':('audio/04-client-phrases.mp3','04-client-phrases-natural.txt')}

book = open(os.path.join(SRC,'course-book.md'),encoding='utf-8').read()

# ---------------- generic helpers ----------------
def strip_md(s):
    s = re.sub(r'\*\*(.+?)\*\*', r'\1', s)
    s = re.sub(r'\*([^*]+?)\*', r'\1', s)
    s = re.sub(r'`(.+?)`', r'\1', s)
    s = re.sub(r'^>\s?', '', s, flags=re.M)
    return s.strip()

def table_to_lines(block):
    out=[]
    for ln in block.split('\n'):
        ln=ln.strip()
        if not ln.startswith('|'): continue
        cells=[c.strip() for c in ln.strip('|').split('|')]
        if all(re.match(r'^:?-+:?$',c) for c in cells): continue
        out.append(' · '.join(strip_md(c) for c in cells))
    return out

def split_blocks(body):
    """split body into blocks: para | list | table | quote"""
    lines=body.split('\n'); blocks=[]; cur=[]; mode=None
    def flush():
        nonlocal cur,mode
        if cur: blocks.append(('\n'.join(cur),mode)); cur=[]; mode=None
    for ln in lines:
        s=ln.strip()
        m = 'table' if s.startswith('|') else 'quote' if s.startswith('>') else 'list' if re.match(r'^([-*]|\d+\.)\s',s) else 'para'
        if s=='':
            flush(); continue
        if mode and m!=mode: flush()
        mode=m; cur.append(ln)
    flush()
    return blocks

def body_to_cards(body, max_chars=700):
    """lesson body -> teach cards (no walls of text)"""
    cards=[]; cur=None
    def new(heading=None):
        return {'type':'teach','heading':heading,'body':'','example':'','tip':''}
    def flush():
        nonlocal cur
        if cur and (cur['body'] or cur['example'] or cur['tip']):
            cur['body']=cur['body'].strip()
            cards.append(cur)
        cur=None
    for text,mode in split_blocks(body):
        if mode=='table':
            text='\n'.join(table_to_lines(text)); mode='para'
        if mode=='quote':
            if not cur: cur=new()
            cur['example'] += ('\n' if cur['example'] else '') + strip_md(text)
            continue
        # warning / tip lines
        if text.lstrip().startswith('⚠️') or re.match(r'\*\*(Warning|Remember|Note|Shortcut|Usage notes)', text):
            if not cur: cur=new()
            cur['tip'] += ('\n' if cur['tip'] else '') + strip_md(text).lstrip('⚠️ ')
            continue
        # headed paragraph -> new card
        hm=re.match(r'\*\*(.+?):\*\*\s*(.*)', text, re.S)
        if hm and len(hm.group(1))<80:
            flush(); cur=new(hm.group(1).strip())
            text=hm.group(2)
        if not cur: cur=new()
        piece=text.strip()
        if len(cur['body'])+len(piece) > max_chars and cur['body']:
            flush(); cur=new()
        cur['body'] += ('\n\n' if cur['body'] else '') + piece
    flush()
    # drop empties, cap cards at 6 per section
    cards=[c for c in cards if c['body'] or c['example']]
    return cards[:6]

_drill_seq=0
def did(prefix):
    global _drill_seq; _drill_seq+=1
    return f"{prefix}-{_drill_seq}"

# ---------------- drill item parsers ----------------
def numbered_items(body):
    items=[]; cur=None
    for ln in body.split('\n'):
        m=re.match(r'^\s*(\d+)\.\s+(.*)', ln)
        if m:
            if cur: items.append(cur)
            cur=[int(m.group(1)), m.group(2).strip()]
        elif cur and ln.strip() and not ln.strip().startswith('*') and not ln.strip().startswith('**'):
            cur[1]+=' '+ln.strip()
    if cur: items.append(cur)
    return items

def key_map(body):
    """find *Key: ...* / *Answers: ...* italic span, return {n: text}"""
    best={}
    for m in re.finditer(r'\*([^*]*\d\.\s[^*]{3,}?)\*', body, re.S):
        span=m.group(1)
        entries=re.split(r'(?<!\d)(?=\d{1,2}\.\s)', span)
        d={}
        for e in entries:
            mm=re.match(r'(\d+)\.\s+(.*)', e.strip(), re.S)
            if mm: d[int(mm.group(1))]=' '.join(mm.group(2).split())
        if len(d)>len(best): best=d
    return best

def first_alt(s):
    parts=[p.strip().strip('"').strip() for p in s.split('/')]
    return parts[0], parts[1:]

def clean_sent(s):
    return strip_md(s).strip().strip('"').strip()

# ---------------- drill converters ----------------
def cv_fixit(title, body, mid, xp=10):
    out=[]; km=key_map(body)
    for n,wrong in numbered_items(body):
        ans,_=first_alt(km.get(n,'')) if km.get(n) else ('','')
        ans=clean_sent(ans)
        if not ans: continue
        alts=[clean_sent(a) for a in _[:2]] if _ else []
        out.append({'type':'drill','engine':'fix-sentence','id':did(mid),
            'wrong':clean_sent(wrong),'answer':ans,
            **({'accept':alts} if alts else {}),
            'hint':'Read it aloud — where does it stumble?','explanation':'','xp':xp})
    return out

def cv_quickquiz(title, body, mid):
    out=[]; km=key_map(body)
    for n,stmt in numbered_items(body):
        k=km.get(n,'')
        m=re.match(r'\s*([TF])\b\s*(\(.*\))?', k)
        if not m: continue
        is_true = m.group(1)=='T'
        out.append({'type':'drill','engine':'multiple-choice','id':did(mid),
            'prompt':'True or false? '+clean_sent(stmt),
            'options':['True','False'],'answer':0 if is_true else 1,
            'explanation':strip_md(m.group(2) or k),'xp':10})
    return out

def cv_choose(title, body, mid):
    out=[]; km=key_map(body)
    for n,item in numbered_items(body):
        item_c=clean_sent(item)
        pm=re.search(r'\(([^)]+)\)\s*$', item_c)
        if not pm: continue
        opts=[o.strip() for o in re.split(r'\s+/\s+', pm.group(1))]
        stem=item_c[:pm.start()].strip()
        k=km.get(n,'')
        kmm=re.match(r'\s*(.+?)\s*(\(.*\))?\s*$', k)
        choice=strip_md(kmm.group(1)).strip() if kmm else ''
        why=strip_md(kmm.group(2) or '') if kmm else ''
        blanks=stem.count('___')
        if blanks>=2:
            out.append({'type':'drill','engine':'multiple-choice','id':did(mid),
                'prompt':stem,'options':[' / '.join(opts[:2]),' / '.join(opts[2:])] if len(opts)>2 else opts,
                'answer':0,'explanation':why or k,'xp':10})
            continue
        if blanks==0: continue
        disp_opts=[]
        for o in opts:
            disp_opts.append({'t':'∅ (nothing)','v':''} if o in ('—','–','-','∅') else o)
        vals=[o['v'] if isinstance(o,dict) else o for o in disp_opts]
        full=(stem.replace('___',choice,1) if choice else re.sub(r'\s*___\s*',' ',stem)).strip()
        full=re.sub(r'\s+',' ',full)
        out.append({'type':'drill','engine':'fill-blank','id':did(mid),
            'text':stem,'options':[stem]+disp_opts,'answer':full,
            'explanation':why or ('Correct: '+choice),'xp':10})
    return out

def journal_drill(title, body, mid, xp=15, seconds=None):
    prompt='**'+strip_md(title)+'**\n\n'+strip_md(body)[:900]
    d={'type':'drill','engine':'journal','id':did(mid),'prompt':prompt,'xp':xp}
    if seconds: d['seconds']=seconds
    return [d]

def speak_drill(title, body, mid, seconds=90, xp=25, checklist=None):
    d={'type':'drill','engine':'speaking-task','id':did(mid),
       'title':strip_md(title)[:80],'prompt':strip_md(body)[:800],
       'seconds':seconds,'tip':'Fluency mode: no stopping, no mid-sentence correcting.','xp':xp}
    if checklist: d['checklist']=checklist
    return [d]

def shadowing_drill(title, text, mid, audio=None, xp=15):
    return [{'type':'drill','engine':'shadowing','id':did(mid),
        'title':strip_md(title)[:80],'text':strip_md(text)[:900],
        'audio':audio,'tip':'Shadow 0.5–1 sec behind the speaker. Copy the music, not just the words.','xp':xp}]

def seconds_from(text, default=90):
    m=re.search(r'(\d+)\s*min', text)
    if m: return min(int(m.group(1))*60, 1200)
    m=re.search(r'(\d+)\s*sec', text)
    if m: return int(m.group(1))
    return default

JOURNAL_TAGS={'scenario-reply','blueprint','checklist-write','log-entry','timeline-map',
              'template-fill','back-translate','spot-it','mark-it'}
SPEAK_TAGS={'feynman-explain','timed-retell','plan-then-speak','roleplay-duel','record-compare'}
SHADOW_TAGS={'shadow-track','pair-chant','dialogue-swap'}

def drill_to_json(tag, title, body, mid):
    tag=tag.strip().lower()
    if tag in ('fix-it','rewrite-it'):
        return cv_fixit(title,body,mid)
    if tag=='quick-quiz':
        return cv_quickquiz(title,body,mid)
    if tag=='choose-and-justify':
        return cv_choose(title,body,mid)
    if tag in JOURNAL_TAGS:
        return journal_drill(title,body,mid)
    if tag in SPEAK_TAGS:
        return speak_drill(title,body,mid,seconds=seconds_from(body))
    if tag in SHADOW_TAGS:
        aud,_audio = AUDIO.get(mid,(None,None))
        if 'dialogue-swap' in tag:
            # keep the exchange readable
            text=re.sub(r'^>\s?','',body,flags=re.M)
            text=re.sub(r'\*\*(Client|You):\*\*',r'\1:',text)
            return shadowing_drill(title,strip_md(text)[:800],mid,aud)
        return shadowing_drill(title,body,mid,aud)
    return journal_drill(title,body,mid)

# ---------------- module assembly ----------------
def split_sections(mod_body):
    parts=re.split(r'(?m)^### (.+?)\s*$', mod_body)
    out=[]; intro=parts[0]
    for i in range(1,len(parts),2):
        out.append((parts[i].strip(), parts[i+1] if i+1<len(parts) else ''))
    return intro,out

def lesson_header(t):
    m=re.match(r'Lesson (\d+)\.(\d+)\s*[—–-]\s*(.+)', t)
    return m.groups() if m else None

def drill_header(t):
    m=re.match(r'\*\*Drill ([\d.]+)\s*[—–-]\s*(.+?)\s*\[(.+?)\]\*\*', t.strip())
    if m: return m.groups()
    m=re.match(r'Drill ([\d.]+)\s*[—–-]\s*(.+?)\s*\[(.+?)\]', t.strip())
    return m.groups() if m else None

def script_text(name, chars=700):
    p=os.path.join(AUD_SRC,'scripts',name)
    if not os.path.exists(p): return ''
    t=open(p,encoding='utf-8').read().replace('\n',' ')
    t=re.sub(r'\s+',' ',t).strip()
    if len(t)>chars:
        cut=t[:chars].rsplit('.',1)[0]+'.'
        t=cut if len(cut)>200 else t[:chars]+'…'
    return t

def special_section(title, body, mid, lesson):
    """reference sections -> flashcards / shadowing / teach cards"""
    t=title.lower()
    if 'sentence bank' in t:
        cards=[]
        for n,s in numbered_items(body):
            s2=clean_sent(s)
            if s2: cards.append({'type':'drill','engine':'flashcard','id':did(mid),
                'front':'Say this client sentence aloud:','back':s2,'example':'','xp':5})
        return ('drills',cards)
    if 'shadowing scripts' in t:
        out=[]
        for m in re.finditer(r'\*\*Script (\d+)\s*\(([^)]+)\):\*\*\s*\n?\*"(.*?)"\*', body, re.S):
            txt=strip_md(m.group(3))
            out+=shadowing_drill(f"Graded script {m.group(1)} ({m.group(2).strip()})",txt,mid,None)
        return ('drills',out)
    if '30-question bank' in t:
        cards=body_to_cards(body)
        # speaking drill: answer 5
        qs=re.findall(r'\d+\.\s+([^.?\n]+\??)', body.split('**Model')[0])
        drill=speak_drill('Call rehearsal: answer 5',
            'Pick any 5 questions from the bank below. Plan 60 seconds (keyword bullets), then answer each in ~60 seconds. Record yourself.\n\n'+'\n'.join(qs[:30]),
            mid, seconds=300, xp=40,
            checklist=['I planned with bullets first','Full sentences, no freezing','Answered 5 questions'])
        return ('both',cards,drill)
    if 'collocation' in t:
        return ('cards',body_to_cards(body))
    # default: teach cards appended to lesson
    return ('cards',body_to_cards(body))

def checkpoint_lesson(cp_body, mid, badge_name):
    cards=body_to_cards(cp_body)
    lesson={'id':mid+'-checkpoint','title':'Checkpoint','minutes':10,'steps':cards,'xp':40}
    mm=re.search(r'\*\*Mini-test.*?\*\*\s*(.*)', cp_body, re.S)
    if mm:
        txt=strip_md(mm.group(1))[:700]
        if 'record' in txt.lower():
            lesson['steps']+=speak_drill('Checkpoint mini-test',txt,mid,seconds=120,xp=30)
        else:
            lesson['steps']+=journal_drill('Checkpoint mini-test',txt,mid,xp=30)
    return lesson

def build_module(n):
    mid=MODMAP[n]; title,icon,color=MODMETA[mid]
    pat=re.compile(r'(?m)^## MODULE %d — (.+?)$' % n)
    m=pat.search(book)
    body=book[m.end():]
    nxt=re.search(r'(?m)^## (MODULE \d+|APPENDIX|THE DECADES|YOUR AI|PRESCRIBED|TROUBLESHOOTING)', body)
    if nxt: body=body[:nxt.start()]
    intro,sections=split_sections(body)
    # description from Why this matters
    desc=''; why=''
    for st,sb in sections:
        if st.lower().startswith('why this matters'):
            why=sb; desc=' '.join(strip_md(sb).split())[:170]; break
    lessons=[]; cur_lesson=None; pending_special=[]
    drills_sec=[]
    checkpoint_body=''; badge_name=''
    for st,sb in sections:
        lh=lesson_header(st)
        if lh:
            cur_lesson={'id':'%s-l%s'%(mid,lh[1]),'title':strip_md(lh[2]),'minutes':12,
                        'steps':body_to_cards(sb),'xp':50,'_num':lh[1]}
            lessons.append(cur_lesson); continue
        dh=drill_header(st)
        if dh:
            drills_sec.append((dh, sb)); continue
        if st.startswith('✅ Module'):
            checkpoint_body=sb
            bm=re.search(r'Badge earned:\s*(.+)', sb)
            badge_name=bm.group(1).strip() if bm else ''
            continue
        if st.lower().startswith('module %d drills'%n) or st.lower().startswith('module drills'):
            # split bold drill headers manually
            parts=re.split(r'(?m)^(\*\*Drill [\d.]+\s*[—–-].+?\[.+?\]\*\*)\s*$', sb)
            for i in range(1,len(parts),2):
                hh=parts[i]; bb=parts[i+1] if i+1<len(parts) else ''
                mm=re.match(r'\*\*Drill ([\d.]+)\s*[—–-]\s*(.+?)\s*\[(.+?)\]\*\*', hh)
                if mm: drills_sec.append(((mm.group(1),mm.group(2),mm.group(3)), bb))
            continue
        if st.lower().startswith('why this matters'):
            continue  # folded into description + first lesson below
        # special/reference section
        res=special_section(st,sb,mid,cur_lesson)
        if res[0]=='cards':
            if cur_lesson: cur_lesson['steps']+=res[1]
            else: pending_special+=res[1]
        elif res[0]=='drills':
            if cur_lesson: cur_lesson['steps']+=res[1]
        elif res[0]=='both':
            _,cards,drill=res
            if cur_lesson: cur_lesson['steps']+=cards+[drill]
    # why-this-matters -> first teach card of first lesson
    if why and lessons:
        lessons[0]['steps']=body_to_cards(why)[:2]+lessons[0]['steps']
    if pending_special and lessons:
        lessons[0]['steps']=pending_special+lessons[0]['steps']
    # attach drills to matching lessons
    for (num,dtitle,tag),dbody in drills_sec:
        ds=drill_to_json(tag,dtitle,dbody,mid)
        if not ds: continue
        target=None
        ln=num.split('.')[-1]
        for l in lessons:
            if l.get('_num')==ln: target=l; break
        if not target: target=lessons[-1] if lessons else None
        if target: target['steps']+=ds
    # quiz lesson + checkpoint lesson
    quiz=QUIZZES.get(n)
    if quiz:
        lessons.append({'id':mid+'-quiz','title':'Module quiz — 10 questions','minutes':10,
            'steps':[{'type':'drill','engine':'timed-quiz','id':did(mid),'title':quiz['title'],
                      'seconds':300,'questions':quiz['questions'],'xp':100,
                      'rule':'8/10 to move on. Answer first, then learn from the misses.'}],'xp':100})
    if checkpoint_body:
        lessons.append(checkpoint_lesson(checkpoint_body,mid,badge_name))
    # finalize xp + strip helpers
    for l in lessons:
        l.pop('_num',None)
        n_drills=sum(1 for s in l['steps'] if s.get('type')=='drill')
        l['xp']=30+n_drills*8
    # tagline from module header subtitle
    tagline=strip_md(m.group(1))
    if ':' in tagline: tagline=tagline.split(':',1)[1].strip()
    return {'id':mid,'title':title,'tagline':tagline[:90],'icon':icon,'color':color,
            'description':desc or tagline,'lessons':lessons,
            '_badge':badge_name,'_drill_count':sum(1 for l in lessons for s in l['steps'] if s.get('type')=='drill')}

# ---------------- quizzes ----------------
def parse_quiz(path, n):
    txt=open(path,encoding='utf-8').read()
    title=re.search(r'^# Quiz \d+ — (.+?)$', txt, re.M).group(1).strip()
    qsec,asec=txt.split('## Answer Key')
    # questions
    qmarks=list(re.finditer(r'(?m)^(\d+)\.\s+\(([^)]+)\)\s*', qsec))
    key_entries={}
    for m in re.finditer(r'(?m)^(\d+)\.\s+(.*(?:\n(?!\d+\.\s).*)*)', asec):
        key_entries[int(m.group(1))]=' '.join(m.group(2).split())
    questions=[]
    for qi,qm in enumerate(qmarks):
        num=int(qm.group(1)); typ=qm.group(2).strip()
        start=qm.end()
        end=qmarks[qi+1].start() if qi+1<len(qmarks) else len(qsec)
        raw=qsec[start:end]
        # strip rule lines etc
        lines=[l for l in raw.split('\n') if l.strip()]
        prompt_main=lines[0].strip() if lines else ''
        rest='\n'.join(lines[1:])
        key_raw=key_entries.get(num,'')
        kb=re.search(r'\*\*(.+?)\*\*', key_raw)
        kans=kb.group(1).strip() if kb else ''
        expl=strip_md(key_raw[kb.end():] if kb else key_raw).lstrip('—-–: ').strip()
        q={'n':num}
        tlow=typ.lower()
        if tlow=='mcq':
            opts=[]; ans_idx=None
            pm=re.search(r'\(([^)]*?/[^)]*?)\)\s*$', prompt_main)
            if pm:
                opts=[o.strip() for o in re.split(r'\s+/\s+', pm.group(1))]
                prompt=prompt_main[:pm.start()].strip()
            else:
                prompt=prompt_main
                for l in lines[1:]:
                    for om in re.finditer(r'([a-z])\)\s*("[^"]+"|[^a-z][^)]*?)(?=\s+[a-z]\)|$)', l):
                        opts.append(om.group(2).strip())
                    if not opts:
                        for om in re.finditer(r'([a-z])\)\s*(.+)', l):
                            opts.append(om.group(2).strip())
                # dedupe keep order
                seen=[]; 
                for o in opts:
                    if o not in seen: seen.append(o)
                opts=seen
            # resolve answer
            ka=kans.strip().lower().rstrip(')')
            if re.match(r'^[a-z]$', ka):
                ans_idx=ord(ka)-ord('a')
            else:
                for i,o in enumerate(opts):
                    if strip_md(o).lower().strip('"').strip()==ka.strip('"').strip() or ka in strip_md(o).lower():
                        ans_idx=i; break
            if ans_idx is None or ans_idx>=len(opts) or not opts:
                # fallback: self-graded
                q.update(kind='self',prompt=prompt or prompt_main,
                         sample=key_raw and strip_md(key_raw) or 'See answer key.',
                         explanation=expl)
            else:
                q.update(kind='mc',prompt=prompt,options=opts,answer=ans_idx,explanation=expl)
        elif 'fix the' in tlow:
            wrong=(re.search(r'"([^"]+)"', prompt_main) or [None,prompt_main])[1]
            q.update(kind='fix',prompt='Fix the error:',wrong=wrong,
                     answer=clean_sent(kans) or clean_sent(key_raw),explanation=expl)
        elif 'put in order' in tlow or 'put' in tlow and 'order' in tlow:
            words=[w.strip() for w in prompt_main.split('/')]
            q.update(kind='order',prompt='Put the words in order:',words=words,
                     answer=clean_sent(kans) or clean_sent(key_raw),explanation=expl)
        else:
            # dialogue / write / rewrite / make it a question / fix fillers -> self-graded
            full=(prompt_main+'\n'+rest).strip()
            q.update(kind='self',prompt=full,sample=strip_md(key_raw) or 'See the answer key.',
                     explanation=expl)
        questions.append(q)
    return {'id':'quiz-'+MODMAP[n],'module':MODMAP[n],'title':'Quiz — '+title,
            'seconds':300,'xp':100,'questions':questions,
            'rule':'8/10 to move on. Answer first, then learn from the misses.'}

QUIZZES={}
_qdir=os.path.join(SRC,'interactive','quizzes')
for n in range(1,8):
    f=[x for x in os.listdir(_qdir) if x.startswith('quiz-%02d-'%n)][0]
    QUIZZES[n]=parse_quiz(os.path.join(_qdir,f), n)

# ---------------- speaking task cards ----------------
def parse_taskcards():
    txt=open(os.path.join(SRC,'interactive','speaking-tasks.md'),encoding='utf-8').read()
    JOURNAL_CARDS={8,18,25,28}
    cards=[]; cur_mod='foundations'
    modmap={'1':'foundations','2':'accuracy','3':'pronunciation','4':'fluency',
            '5':'client-communication','6':'self-presentation','7':'sales'}
    modpos=[(m.start(),modmap[m.group(1)]) for m in re.finditer(r'(?m)^## Module (\d+) —', txt)]
    parts=re.split(r'(?m)^### Card (\d+)\s*[—–-]\s*(.+?)\s*$', txt)
    for i in range(1,len(parts),3):
        num=int(parts[i]); title=parts[i+1].strip(); body=parts[i+2]
        start_idx=txt.find('### Card %d'%num)
        mod='foundations'
        for pos,mm in modpos:
            if pos<start_idx: mod=mm
        def field(name):
            mm=re.search(r'-\s*\*\*%s:\*\*\s*(.+?)(?=\n-\s*\*\*|\n###|\Z)'%name, body, re.S)
            return ' '.join(mm.group(1).split()) if mm else ''
        goal,inst,tl,submit,lens=field('Goal'),field('Instructions'),field('Time limit'),field('Submit'),field('Lens trained')
        secs=seconds_from(tl,90)
        kind='journal' if num in JOURNAL_CARDS else 'speak'
        prompt='**Goal:** '+goal+'\n\n'+inst
        card={'id':'card-%d'%num,'n':num,'module':mod,'title':strip_md(title),
              'kind':kind,'seconds':secs,'prompt':strip_md(prompt)[:900],
              'tip':'Lens trained: %s. Submit per the feedback contract: tell Muse the task number.'%strip_md(lens),
              'xp':30 if kind=='speak' else 20}
        if kind=='journal':
            card['checklist']=[]
        else:
            card['checklist']=['Full time, no stopping','Full sentences','Honest — real facts only']
        cards.append(card)
    return cards

# ---------------- placement test ----------------
def parse_placement():
    sec=book.split('### THE PLACEMENT TEST')[1].split('### Your placement')[0]
    # answer key paragraph
    akm=re.search(r'\*\*Answer key \(Parts A–B\):\*\*\s*(.+)', sec, re.S)
    ak=akm.group(1).strip()
    key={}
    for e in re.split(r'(?<!\d)(?=\d{1,2}\.\s)', ak):
        mm=re.match(r'(\d+)\.\s+(.*)', e.strip(), re.S)
        if mm: key[int(mm.group(1))]=' '.join(mm.group(2).split())
    parts=[]
    # Part A
    pa=re.search(r'#### Part A —(.+?)#### Part B', sec, re.S).group(1)
    items=[]
    for n,w in numbered_items(pa):
        ans,_=first_alt(key.get(n,'')); ans=clean_sent(ans)
        alts=[clean_sent(a) for a in _[:2]] if _ else []
        items.append({'n':n,'kind':'fix','wrong':clean_sent(w),'answer':ans,
                      **({'accept':alts} if alts else {}),'points':2})
    parts.append({'id':'A','title':'Fix the sentence','kind':'fix','blurb':'Each sentence has at least one error. Rewrite it correctly. 2 points each.','items':items})
    # Part B
    pb=re.search(r'#### Part B —(.+?)#### Part C', sec, re.S).group(1)
    items=[]
    for n,w in numbered_items(pb):
        w=clean_sent(w)
        pm=re.search(r'\(([^)]+)\)\s*$', w)
        opts=[o.strip() for o in re.split(r'\s+/\s+', pm.group(1))] if pm else []
        stem=w[:pm.start()].strip() if pm else w
        k=clean_sent(key.get(n,''))
        # k may be '— (no preposition: ...)' 
        kmm=re.match(r'(—|–|-)\s*(\(.*\))?', k)
        choice='' if kmm else k.split('(')[0].strip()
        why=strip_md(re.search(r'\((.*)\)',k).group(1)) if re.search(r'\(.*\)',k) else ''
        disp=[{'t':'∅ (nothing)','v':''} if o in ('—','–','-') else o for o in opts]
        full=(stem.replace('___',choice,1) if choice else re.sub(r'\s*___\s*',' ',stem)).strip()
        full=re.sub(r'\s+',' ',full)
        items.append({'n':n,'kind':'choice','text':stem,'options':[stem]+disp,'answer':full,
                      'explanation':why,'points':2})
    parts.append({'id':'B','title':'Choose the right word','kind':'choice','blurb':'Pick the word that fits. 2 points each.','items':items})
    # Part C self-check
    pc=re.search(r'#### Part C —(.+?)#### Part D', sec, re.S).group(1)
    items=[]
    for n,w in numbered_items(pc):
        items.append({'n':n,'kind':'selfscore','prompt':clean_sent(w)[:600],'max':5,
                      'scale':'5 = yes, smoothly · 3 = mostly · 1 = struggled','points':5})
    parts.append({'id':'C','title':'Listening & shadowing self-check','kind':'selfscore',
        'blurb':'Do each task honestly, then score yourself 1 / 3 / 5. 5 points each.','items':items})
    # Part D speaking
    pd=re.search(r'#### Part D —(.+?)#### Part E', sec, re.S).group(1)
    items=[]
    for n,w in numbered_items(pd):
        mm=re.match(r'\*\*(.+?)\*\*\s*(.*)', w, re.S)
        title=strip_md(mm.group(1)) if mm else 'Speaking %d'%n
        prompt=strip_md(mm.group(2) if mm else w)
        items.append({'n':n,'kind':'speak','title':title[:80],'prompt':prompt[:600],
                      'seconds':120 if n==25 else 90,'max':10,
                      'scale':'Score 2–10 with the 4 lenses (clarity/tone/structure/client-safety). Be strict.','points':10})
    parts.append({'id':'D','title':'Speaking','kind':'speak','blurb':'Record both on your phone. Then score yourself honestly, 2–10 each.','items':items})
    # Part E writing
    pe=re.search(r'#### Part E —(.+)', sec, re.S).group(1).split('**Answer key')[0]
    items=[]
    for n,w in numbered_items(pe):
        items.append({'n':n,'kind':'write','prompt':clean_sent(w)[:500],'max':5,
                      'scale':'5 = clean and client-safe · 3 = understandable with slips · 1 = hard to follow','points':5})
    parts.append({'id':'E','title':'Writing','kind':'write','blurb':'Write your answers, then score yourself 1–5 each.','items':items})
    bands=[{'min':0,'max':39,'band':'A2','note':'You can handle simple, familiar topics. Client calls are not yet safe — that is exactly what this course fixes.'},
           {'min':40,'max':69,'band':'B1','note':'You survive everyday English. The course takes you to B2: independent, client-ready.'},
           {'min':70,'max':100,'band':'B2','note':'You are closer than you think — use the course as a tune-up, especially Modules 5–7.'}]
    return {'title':'Placement Test','blurb':'30 items · ~40 minutes · 100 points. One sitting, no dictionary, no AI help. Cheating it only cheats you.','parts':parts,'bands':bands}

# ---------------- main ----------------
def main():
    report=[]
    for n in range(1,8):
        mod=build_module(n)
        badge=mod.pop('_badge'); dcnt=mod.pop('_drill_count')
        fn=os.path.join(OUT,'module-%s.json'%mod['id'])
        json.dump(mod,open(fn,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
        kinds={}
        for l in mod['lessons']:
            for s in l['steps']:
                if s.get('type')=='drill': kinds[s['engine']]=kinds.get(s['engine'],0)+1
        report.append((mod['id'],len(mod['lessons']),dcnt,kinds))
    json.dump(list(QUIZZES.values()),open(os.path.join(OUT,'quizzes.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)
    cards=parse_taskcards()
    json.dump(cards,open(os.path.join(OUT,'taskcards.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)
    pl=parse_placement()
    json.dump(pl,open(os.path.join(OUT,'placement.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)
    # audio copy
    copied=[]
    for f in sorted(os.listdir(AUD_SRC)):
        if f.endswith('.mp3'):
            shutil.copy2(os.path.join(AUD_SRC,f),os.path.join(AUD_DST,f)); copied.append(f)
    # report
    print('=== MODULES ===')
    tot_q=0
    for mid,nl,nd,kinds in report:
        print(f'{mid}: {nl} lessons, {nd} drills {kinds}')
    print('=== QUIZZES ===')
    for n in range(1,8):
        q=QUIZZES[n]; tot_q+=len(q['questions'])
        kk={}
        for x in q['questions']: kk[x['kind']]=kk.get(x['kind'],0)+1
        print(f"quiz {n} ({q['module']}): {len(q['questions'])} questions {kk}")
    print('total quiz questions:',tot_q)
    print('=== TASK CARDS ===',len(cards),{c['kind'] for c in cards})
    pp=sum(len(p['items']) for p in pl['parts'])
    print('=== PLACEMENT === parts:',[(p['id'],len(p['items'])) for p in pl['parts']],'items:',pp,
          'max score:',sum(i['points'] for p in pl['parts'] for i in p['items']))
    print('=== AUDIO ===',len(copied),'files')
    # validate JSON
    for f in os.listdir(OUT):
        json.load(open(os.path.join(OUT,f),encoding='utf-8'))
    print('all JSON valid ✓')

if __name__=='__main__':
    main()
