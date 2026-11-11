# Prototipo Plataforma de Owners — demo del caso práctico BEIQA

Prototipo HTML navegable, sin backend, con reglas de coincidencia simuladas en JavaScript
y datos generados. Cuatro pantallas con estado compartido: alta del owner, aviso de posible
duplicado, vista del revisor interno y panel de valor del owner.

La tesis: **un anuncio no es una propiedad**. El anuncio es una observación con fuente y
fecha; la propiedad es la entidad canónica que se construye fusionando anuncios y lo que
confirma el owner.

## Especificación

`odd/tasks/prototipo-owners.md` — qué se pide, con qué criterio y en qué orden.

## Cómo correrlo

Sin dependencias. Abre `index.html` en el navegador, o:

```bash
npm start          # servidor local en http://localhost:3000, sin dependencias
```

## Pruebas

```bash
npm test           # reglas de coincidencia, casos difíciles incluidos
npm run corpus     # precisión, recall y costo de revisión por umbral
```

## Estructura

```
index.html              Portada del prototipo: el recorrido completo en una pantalla
01-alta-owner.html      Alta guiada del inmueble (3 pasos + extracción de brochure)
02-posible-duplicado.html  Aviso al owner: "este inmueble podría ya existir"
03-revisor.html         Vista del revisor interno: cola, razones, veto, diff, acciones
04-panel-owner.html     Lo que el owner gana: interés, visitas, propuestas, disponibilidad
js/matching.js          Lógica pura: normalización, blocking, señales, vetos, cobertura
js/data.js              Catálogo y casos generados (ningún dato es real)
js/store.js             Estado compartido entre pantallas
js/ui-*.js              Una interfaz por pantalla, sin reglas escondidas
tests/                  Pruebas de las reglas y del conjunto etiquetado
```
