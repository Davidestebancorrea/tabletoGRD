import json, sys
src=sys.argv[1]
L=[l.rstrip('\n') for l in open(src,encoding='utf-8')]
MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
YEARS=[str(y) for y in range(2018,2027)]
def num(s):
    s=s.strip().replace(',','')
    return float(s[:-1])/100 if s.endswith('%') else float(s)
d=json.load(open('data.json'))
gmap={'20-110 - Medicina':'Medicina','20-120 - Cirugía':'Cirugía','20-130 - Traumatología y Ortopedia':'Traumatología y ortopedia (adultos)',
 'Obstetricia y Ginecología':'Obstetricia y Ginecología','20-140 - Cirugía Infantil':'Cirugía Infantil',
 '20-143 - Traumatología y Ortopedia Infantil':'Traumatología y Ortopedia Infantil','20-150 - Pediatría':'Pediatría','NEO y UPC Neonatal':'Neonatología básico y UPC'}
res={}
heads=[i for i,l in enumerate(L) if l.split('\t')[1:2]==['Servicio Egreso'] and l.count('Servicio Egreso')>1]
for hi in heads:  # encabezados de los bloques mensuales de outliers (4 servicios por bloque)
    hdr=L[hi].split('\t')[1:]
    groups=[hdr[i] for i in range(1,len(hdr),2)]
    for li in range(hi+4,hi+17):
        c=L[li].split('\t')[1:]
        # split into segments starting at month labels / Suma Total
        segs=[];cur=None
        for x in c:
            if x in MONTHS or x=='Suma Total':
                cur=[x,[]];segs.append(cur)
            elif x.strip() and cur: cur[1].append(num(x))
        for g,(m,vals) in zip(groups,segs):
            res.setdefault(g,{})[m]=vals
out={}
for g,rows in res.items():
    svc=gmap[g]; dep=d['servicios'][svc]['Egresos depurados']['m']; eg=d['servicios'][svc]['Egresos']['m']
    tot=d['outliers'][g]
    out[svc]={}
    for m in MONTHS:
        vals=rows.get(m,[])
        mask=sorted(dep.get(m,{}).keys())
        if len(mask)!=len(vals):
            print('MISMATCH',g,m,len(vals),mask,file=sys.stderr); 
            mask=[y for y in YEARS if y in tot][:len(vals)]
        out[svc][m]=dict(zip(mask,vals))
    # check weighting vs yearly total
    for y in ['2023','2025']:
        for nm,den in (('dep',dep),('eg',eg)):
            n=w=0
            for m in MONTHS:
                v=out[svc][m].get(y); dd=den.get(m,{}).get(y)
                if v is not None and dd: n+=v*dd; w+=dd
            print(svc,y,nm,round(n/w*100,2) if w else None,'src',round(tot.get(y,0)*100,2))
json.dump(out,open('outl_month.json','w'),ensure_ascii=False)
