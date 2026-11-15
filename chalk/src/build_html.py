# ساخت صفحه‌ی ویدیو از template.html + timing_ep1.json  ->  ep.html
import json
d=json.load(open('timing_ep1.json'))
t=open('template.html',encoding='utf-8').read()
t=(t.replace('/*SUBS*/[]',json.dumps(d['subs'],ensure_ascii=False))
    .replace('/*TM*/{}',json.dumps({"TOTAL":d['TOTAL'],"lines":d['lines']}))
    .replace('/*ENV*/[]',json.dumps(d['env'])))
open('ep.html','w',encoding='utf-8').write(t)
print('ep.html ready')
