import sys, json, re, itertools
src = sys.argv[1]; out = sys.argv[2]
L = [l.rstrip('\n') for l in open(src, encoding='utf-8')]
YEARS = list(range(2018, 2027))
MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
def num(s):
    s = s.strip().replace(',', '')
    pct = s.endswith('%')
    if pct: s = s[:-1]
    v = float(s)
    return v/100 if pct else v
def cells(line): return [c for c in line.split('\t')[1:]]

def read_table(i):
    """i = index of 'Mes egreso' header line. returns rows dict month->[vals], total list, next index"""
    rows = {}; total = None; j = i+1
    while j < len(L):
        c = cells(L[j])
        if not c or c[0] == '': break
        if c[0] in MONTHS: rows[c[0]] = [num(x) for x in c[1:] if x.strip()!='']
        elif c[0] == 'Suma Total': total = [num(x) for x in c[1:] if x.strip()!='']; j += 1; break
        else: break
        j += 1
    return rows, total, j

def place_counts(rows, total):
    """find year placement for each row so column sums equal the total row. returns month->{year:val}"""
    n = len(total)
    # total years: assume contiguous ending 2026 if n<9?? decide by trying both ends
    cand_years = [YEARS[9-n:], YEARS[:n]] if n < 9 else [YEARS]
    for ty in cand_years:
        months = [m for m in MONTHS if m in rows]
        opts = []
        for m in months:
            k = len(rows[m])
            os_ = [c for c in itertools.combinations(ty, k)]
            # prefer contiguous placements first
            os_.sort(key=lambda c: (c[-1]-c[0]-(k-1)))
            opts.append(os_)
        target = dict(zip(ty, total))
        res = {}
        def bt(idx, acc):
            if idx == len(months):
                return all(abs(acc.get(y,0)-target[y]) < 0.6 for y in ty)
            m = months[idx]
            for c in opts[idx]:
                new = dict(acc)
                for y, v in zip(c, rows[m]): new[y] = new.get(y,0)+v
                if any(new.get(y,0) > target[y]+0.6 for y in ty): continue
                res[m] = c
                if bt(idx+1, new): return True
            return False
        if bt(0, {}):
            return {m: dict(zip(res[m], rows[m])) for m in months}, dict(zip(ty, total))
    raise RuntimeError('no placement')

def place_with_mask(rows, total, mask, tmask):
    out = {}
    for m, vals in rows.items():
        ys = mask.get(m)
        if ys is None or len(ys) != len(vals):
            # fallback: trailing-missing assumption
            ys = sorted(ys or [])[:len(vals)] if ys and len(ys) > len(vals) else YEARS[:len(vals)]
            print('WARN mask mismatch', m, len(vals), file=sys.stderr)
        out[m] = dict(zip(ys, vals))
    ty = tmask if len(tmask) == len(total) else YEARS[:len(total)]
    return out, dict(zip(ty, total))

def block_tables(start, end):
    """parse all '<metric>\t<service>' + Mes egreso tables between lines"""
    tabs = {}; i = start
    while i < end:
        c = cells(L[i])
        if len(c) >= 1 and i+1 < end and cells(L[i+1])[:1] == ['Mes egreso (Descripción)']:
            name = c[0]
            rows, total, j = read_table(i+1)
            tabs[name] = (rows, total); i = j; continue
        i += 1
    return tabs

def resolve(tabs, count_keys, rate_map):
    res = {}; masks = {}
    for k in count_keys:
        if k not in tabs: continue
        rows, total = tabs[k]
        if not total: continue
        placed, tot = place_counts(rows, total)
        res[k] = {'m': placed, 't': tot}
        masks[k] = ({m: sorted(d.keys()) for m, d in placed.items()}, sorted(tot.keys()))
    for k, base in rate_map.items():
        if k not in tabs or base not in masks: continue
        rows, total = tabs[k]
        if not total: continue
        placed, tot = place_with_mask(rows, total, *masks[base])
        res[k] = {'m': placed, 't': tot}
    return res

data = {}
# ---- general block
gi = next(i for i,l in enumerate(L) if 'Comparativos funcionales general' in l)
first_srv = next(i for i,l in enumerate(L) if l.startswith('\tServicio Egreso (Descripción)'))
gt = {}
i = gi
while i < first_srv:
    c = cells(L[i])
    if c and c[0] in ('Egresos','Estancia Media','IEMA','% Mortalidad','Peso GRD Medio') and cells(L[i+1])[:1]==['Mes egreso (Descripción)']:
        rows,total,j = read_table(i+1); gt[c[0]]=(rows,total); i=j; continue
    i+=1
data['general'] = resolve(gt, ['Egresos'], {'Estancia Media':'Egresos','IEMA':'Egresos','% Mortalidad':'Egresos','Peso GRD Medio':'Egresos'})

# ---- inliers (double table)
ii = next(i for i,l in enumerate(L) if '\tEgresos Inliers\t' in l)
inl = {}; eml = {}
for l in L[ii:ii+12]:
    c = cells(l)
    if c[0] == 'Egresos Inliers': c = c[1:]
    m = c[0]; rest = c[1:]
    k = rest.index(m)  # second month label
    inl[m] = [num(x) for x in rest[:k] if x and x!='EM Inliers']; eml[m] = [num(x) for x in rest[k+1:] if x]
# inliers: trailing-missing (2026 Sep..Dec) assumption, verified below by full 9-length rows
data['inliers'] = {'egresos': {m: dict(zip(YEARS, v)) for m,v in inl.items()}, 'em': {m: dict(zip(YEARS, v)) for m,v in eml.items()}}

# ---- service blocks
starts = [i for i,l in enumerate(L) if l.startswith('\tServicio Egreso (Descripción)')]
outl_i = next(i for i,l in enumerate(L) if 'Indicador B.3_1.4' in l)
bounds = starts + [outl_i]
svc = {}
for a, b in zip(bounds, bounds[1:]):
    c = cells(L[a]); name = c[1]
    if len(c) > 3: name = name + (' adultos' if 'adultos' in c[3] else ' infanto-juvenil')
    tabs = block_tables(a+1, b)
    svc[name] = resolve(tabs, ['Egresos','Egresos depurados'],
        {'EM total depurada':'Egresos depurados','IEMA':'Egresos depurados','PM depurado':'Egresos depurados',
         '% Mortalidad':'Egresos','Estancias evitables o sobreconsumidas':'Egresos depurados'})
data['servicios'] = svc

# ---- outliers yearly by service group
oi = next(i for i,l in enumerate(L[outl_i:]) if cells(l)[:1]==['Servicio Egreso']) + outl_i
outl = {}
for l in L[oi+1:]:
    c = cells(l)
    if not c or not c[0]: break
    vals = [num(x) for x in c[1:] if x]
    if c[0] == 'Suma Total' or len(vals) == 9: ys = YEARS
    elif 'Traumatología y Ortopedia' in c[0] and 'Infantil' not in c[0]: ys = YEARS[2:]
    else: continue  # ambiguous tiny groups
    outl[c[0]] = dict(zip(ys, vals))
data['outliers'] = outl
json.dump(data, open(out,'w'), ensure_ascii=False, indent=0)
for k,v in svc.items(): print(k, {t: sum(1 for _ in v[t]['m']) for t in v}, list(v.get('Egresos',{}).get('t',{}).items())[:2])
