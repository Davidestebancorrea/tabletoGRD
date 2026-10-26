# Tablero de gestión GRD — Hospital Félix Bulnes Cerda

Sitio web estático (no requiere servidor ni instalación).

## Cómo abrirlo
Doble clic en `index.html`. Se abre en cualquier navegador (Chrome, Edge, Firefox).
Para publicarlo en un servidor o intranet, copia la carpeta completa tal cual.

## Estructura
| Archivo | Contenido |
|---|---|
| `index.html` | Estructura de la página |
| `css/estilos.css` | Diseño (colores, tipografía, modo claro/oscuro) |
| `js/tablero.js` | Lógica: filtros, KPIs, gráficos y tabla |
| `datos/datos_grd_1.js` … `_3.js` | Datos del tablero en tres partes (generados, no editar a mano) |
| `procesamiento/` | Scripts Python que convierten la planilla en datos |

## Indicadores
Egresos, estancia media, IEMA (con semáforo ≤1,00 / 1,00–1,10 / >1,10), peso GRD medio,
mortalidad, estancias evitables y % de egresos outliers superiores (indicador B.3_1.4).
Fuente: `Mi Panel de Control_Cuadro de mando GRD para Power Bi.xlsx` (corte 15-10-2026).

## Cómo actualizar los datos
1. Exportar el contenido de la planilla como texto separado por tabulaciones (`grd.txt`).
2. En la carpeta `procesamiento/`, ejecutar en orden:
   - `python parse.py grd.txt data.json`
   - `python parse_outl.py grd.txt`
   - `python build_data.py`
   - `python a_sitio.py`
3. En `build_data.py`, la línea `g[9][8] = None` excluye octubre 2026 (mes en curso al corte).
   Al cambiar de corte, ajustar ese mes/año (índice de mes 0–11, índice de año 0 = 2018).
4. Abrir `index.html` y revisar. Actualizar en `index.html` el texto de fecha de corte y último mes cerrado.

## Notas
- Octubre 2026 (mes en curso al corte) queda excluido; septiembre 2026 no viene en la planilla de origen.
- Pabellón, recuperación o CMA se excluye por su volumen mínimo.
- % outliers: hospital y UPC solo traen total anual; Psiquiatría no tiene el indicador en la fuente.
