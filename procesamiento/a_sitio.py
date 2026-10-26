# Convierte dash_data.json (generado por build_data.py) en los archivos datos/datos_grd_1..3.js del sitio.
import json, pathlib
aqui = pathlib.Path(__file__).resolve().parent
d = json.loads((aqui / 'dash_data.json').read_text(encoding='utf-8'))

def limpia(x):
    if isinstance(x, float):
        r = round(x, 6)
        return int(r) if r == int(r) else r
    if isinstance(x, list): return [limpia(i) for i in x]
    if isinstance(x, dict): return {k: limpia(v) for k, v in x.items()}
    return x

d = limpia(d)
sc = d['scopes']
partes = [sc[0:4], sc[4:8], sc[8:]]
for i, p in enumerate(partes, 1):
    cuerpo = ('window.DATOS_GRD={"years":%s,"scopes":[]};\n' % json.dumps(d['years'])) if i == 1 else ''
    cuerpo += 'window.DATOS_GRD.scopes.push(\n' + ',\n'.join(
        json.dumps(s, ensure_ascii=False, separators=(',', ':')) for s in p) + '\n);\n'
    js = (f'// Datos del tablero GRD (parte {i} de 3). Generado por procesamiento/a_sitio.py, no editar a mano.\n'
          '// Fuente: Cuadro de mando GRD, corte 15-10-2026\n' + cuerpo)
    (aqui.parent / 'datos' / f'datos_grd_{i}.js').write_text(js, encoding='utf-8')
print('datos/datos_grd_1..3.js actualizados')
