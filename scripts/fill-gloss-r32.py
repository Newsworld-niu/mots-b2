import csv,html,json,os,re,time,urllib.parse,urllib.request
from concurrent.futures import ThreadPoolExecutor,as_completed
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX=os.path.join(ROOT,'data/lexicon.json'); CAND='/tmp/gloss-cands.txt'; LOG=os.path.join(ROOT,'output/r32-gloss-log.csv')
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
MEASURE=set("场把位名种个支笔张块次番尊棵首段道间件条只匹头峰")
def parse(text,word):
    t=re.sub(r"<script.*?</script>|<style.*?</style>","",text,flags=re.S)
    t=html.unescape(re.sub(r"<[^>]+>"," ",t)); t=re.sub(r"\s+"," ",t)
    m=re.search(r"Français-Chinois\s*>\s*"+re.escape(word)+r"\s+(.{0,500})",t)
    if not m: return None
    seg=re.sub(r"\(cl\.[^)]*\)"," ",m.group(1))
    c=re.search(r"([\u4e00-\u9fff][^\[]{0,60}?)\s*\[",seg)
    if c: return c.group(1).strip()
    c=re.search(r"([\u4e00-\u9fff]{2,}[^\[]{0,40})",seg)
    return c.group(1).strip() if c else None
def fetch(w):
    url="https://www.larousse.fr/dictionnaires/francais-chinois/"+urllib.parse.quote(w)+"/"
    for a in range(3):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":UA})
            h=urllib.request.urlopen(req,timeout=25).read().decode('utf-8','ignore')
            return w,parse(h,w),url
        except urllib.error.HTTPError as e:
            if e.code in (429,503): time.sleep(3+a*3); continue
            return w,None,url
        except Exception: return w,None,url
    return w,None,url
def main():
    words=[l.strip() for l in open(CAND,encoding='utf-8') if l.strip()]
    lex=json.load(open(LEX,encoding='utf-8')); by={e['id']:e for e in lex['entries']}
    res={}
    with ThreadPoolExecutor(max_workers=6) as ex:
        for fu in as_completed({ex.submit(fetch,w):w for w in words}):
            w,zh,url=fu.result(); res[w]=(zh,url)
    applied=0; log=[]
    for e in lex['entries']:
        if e.get('aliasOf') or any(s.get('zh','').strip() for s in e.get('senses',[])): continue
        if e['lemma'] not in res: continue
        zh,url=res[e['lemma']]
        if not zh or (len(zh)==1 and zh in MEASURE):
            log.append({'id':e['id'],'lemma':e['lemma'],'action':'skipped','detail':'no zh/measure'}); continue
        e['senses']=[{"zh":zh,"fr":"","origin":"supplement","status":"补充翻译·待核对"}]
        e['note']=((e.get('note') or '')+('；' if (e.get('note') or '').strip() else '')+'r32 释义来源：Larousse 中法词典。').strip()
        applied+=1; log.append({'id':e['id'],'lemma':e['lemma'],'action':'gloss','detail':zh})
    json.dump(lex,open(LEX,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
    with open(LOG,'w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=['id','lemma','action','detail']);w.writeheader();w.writerows(log)
    print('applied',applied,'of',len(words))
main()
