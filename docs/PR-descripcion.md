# Prototipo navegable de la Plataforma de Owners

## Qué cambia

Cuatro pantallas navegables, sin backend, con las reglas de coincidencia simuladas en JavaScript y datos generados:

- **Alta del owner** (`01-alta-owner.html`): reclamo ligero, tres pasos, borrador guardado y un brochure que propone campos con su confianza. El owner corrige, no captura desde cero.
- **Posible duplicado** (`02-posible-duplicado.html`): el aviso de que el inmueble podría ya existir, con los candidatos reales y una razón en lenguaje humano.
- **Vista del revisor** (`03-revisor.html`): cola ordenada por confianza, veredicto, cobertura de evidencia, veto, razones por señal y diff campo por campo con lo que se pierde si se fusiona.
- **Panel del owner** (`04-panel-owner.html`): lo que el owner gana a cambio de subir sus inmuebles, con rangos en lugar de conteos exactos.

Y lo que hace que eso signifique algo:

- `js/matching.js`: normalización, blocking, señales, vetos, cobertura y umbrales. Lógica pura, sin DOM.
- `tests/matching.test.js`: 14 pruebas que pinnean la decisión y el motivo de cada caso.
- `tests/corpus.js`: conjunto etiquetado con barrido de umbrales, precisión, recall y costo en cola de revisión.
- `.github/workflows/test.yml`: pruebas y calidad del corpus en cada PR y en cada push a `main`.

## Por qué

El problema del caso no es el formulario, es el modelo. Hoy lo raspado se trata como propiedad, y eso produce por definición cuatro síntomas: anuncios viejos, duplicados, owner desconocido y datos incompletos.

La propuesta separa **anuncio** (observación con fuente, fecha y confianza) de **propiedad** (entidad canónica que se construye fusionando anuncios y lo que confirma el owner). Sobre esa separación, tres decisiones sostienen el resto:

1. **Un veto gana al puntaje.** Un modelo puramente aditivo no puede expresar "esto no puede ser el mismo inmueble pase lo que pase": con pesos fijos, 25 puntos de ubicación tapan cualquier conflicto binario. Por eso los conflictos duros son una capa aparte que corre antes del score.
2. **Un dato faltante no puntúa.** El score se normaliza sobre lo que efectivamente se pudo comparar y la cobertura se publica al lado. Un 100 con 2 de 8 señales no es un 100.
3. **El sistema vincula, la persona fusiona.** Vincular un anuncio a una propiedad es reversible; fusionar entidades no. La fusión automática de la versión anterior era el riesgo más caro del diseño.

## Cómo se probó

```
npm test        →  14 pruebas, 14 pasan
npm run corpus  →  9 pares etiquetados, barrido de 55 a 95
```

El caso que justifica el diseño, ejecutado:

```
oficina piso 6 vs oficina piso 4, mismo edificio, misma administradora, fotos de edificio compartidas
  score 95 · cobertura 8/8 · veto "Mismo edificio, piso distinto (4 vs 6)" → Revisar, no vincular
```

Sin la capa de vetos, ese par se vincularía solo. La columna `falso+ sin veto` del corpus existe para que eso quede medido y no discutido.

Recorrido manual de las cuatro pantallas a 1440 px y a 430 px, con capturas, verificando que ninguna acción quede muerta.

## Qué quedó fuera

- Sin backend, sin autenticación real y sin persistencia entre sesiones: el estado vive en `sessionStorage`.
- La extracción de brochure es simulada: propone campos con confianza, no lee un PDF.
- El contrato de integración con la app interna y el portal de clientes es parte del documento técnico, no del prototipo.
- Los datos son generados. Ningún inmueble, owner ni cliente es real.

## Riesgos y qué mirar

- **Los umbrales son una decisión de negocio, no un parámetro técnico.** 85 y 60 están calibrados contra un conjunto de nueve pares: es un punto de partida defendible, no una verdad. Si cambia el costo de fusionar mal, cambian los umbrales.
- **El corpus es chico a propósito.** Con nueve pares se detectan regresiones gruesas; con datos reales habría que etiquetar cientos y mirar la cola de revisión por analista, no solo la precisión.
- **La extracción de PDF es la parte más frágil del flujo real** y acá está simulada. Es lo primero que pediría validar con brochures de verdad.
