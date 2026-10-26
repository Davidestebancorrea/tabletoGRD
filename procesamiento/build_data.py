import json, sys
d = json.load(open('data.json'))
YEARS = [str(y) for y in range(2018, 2027)]
MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
def grid(tab):
    g = []
    for m in MONTHS:
        row = tab['m'].get(m, {})
        g.append([row.get(y) for y in YEARS])
    # drop partial month: Oct 2026 (mes en curso al corte)
    g[9][8] = None
    return g
def tot(tab): return [tab['t'].get(y) for y in YEARS]
out = {'years': list(range(2018, 2027)), 'scopes': []}
g = d['general']
svc = d['servicios']
# hospital evitables = sum of services
ev = [[None]*9 for _ in range(12)]
for name, s in svc.items():
    if name.startswith('Pabellón'): continue
    gr = grid(s['Estancias evitables o sobreconsumidas'])
    for i in range(12):
        for j in range(9):
            if gr[i][j] is not None: ev[i][j] = (ev[i][j] or 0) + gr[i][j]
o = d['outliers']
OM = json.load(open('outl_month.json'))
out['scopes'].append({'id':'hosp','name':'Hospital (todos los servicios)','eg':grid(g['Egresos']),'dep':grid(g['Egresos']),
  'em':grid(g['Estancia Media']),'iema':grid(g['IEMA']),'pm':grid(g['Peso GRD Medio']),'mort':grid(g['% Mortalidad']),'evit':ev,
  'outl':[o['Suma Total'].get(y) for y in YEARS],'outlNote':'','ol':None})
omap = {'Medicina':'20-110 - Medicina','Cirugía':'20-120 - Cirugía','Traumatología y ortopedia (adultos)':'20-130 - Traumatología y Ortopedia',
 'Cirugía Infantil':'20-140 - Cirugía Infantil','Traumatología y Ortopedia Infantil':'20-143 - Traumatología y Ortopedia Infantil',
 'Pediatría':'20-150 - Pediatría','Neonatología básico y UPC':'NEO y UPC Neonatal','Obstetricia y Ginecología':'Obstetricia y Ginecología',
 'UPC adultos*':'UPC adulto y pediátrica*','UPC pediátrica*':'UPC adulto y pediátrica*'}
nice = {'UPC adultos*':'UPC adultos','UPC pediátrica*':'UPC pediátrica','Traumatología y ortopedia (adultos)':'Traumatología adultos',
 'Traumatología y Ortopedia Infantil':'Traumatología infantil','Neonatología básico y UPC':'Neonatología (básico y UPC)'}
for name, s in svc.items():
    if name.startswith('Pabellón'): continue
    ok = omap.get(name)
    out['scopes'].append({'id':name,'name':nice.get(name,name),
      'eg':grid(s['Egresos']),'dep':grid(s['Egresos depurados']),'em':grid(s['EM total depurada']),'iema':grid(s['IEMA']),
      'pm':grid(s['PM depurado']),'mort':grid(s['% Mortalidad']),'evit':grid(s['Estancias evitables o sobreconsumidas']),
      'outl':[o[ok].get(y) for y in YEARS] if ok else None,
      'outlNote':'UPC adulto y pediátrica combinadas' if ok and ok.startswith('UPC') else '',
      'ol': grid({'m':OM[name]}) if name in OM else None})
json.dump(out, open('dash_data.json','w'), ensure_ascii=False, separators=(',',':'))
print(len(open('dash_data.json').read()))
