# AGENTS.md — cómo trabajar en este repositorio

Instrucciones para agentes de IA. Si algo de acá choca con una instrucción suelta, gana este archivo.

## Qué es esto

Prototipo navegable de la Plataforma de Owners de BEIQA para el caso práctico. **Es una demostración de criterio, no un producto.** HTML sin backend, sin build, sin dependencias, datos generados.

## Dónde está la verdad

| Qué | Dónde | Regla |
|---|---|---|
| Qué se pide y con qué criterio | `odd/tasks/prototipo-owners.md` | Se lee completo hasta `## Log` antes de tocar nada |
| Reglas de coincidencia | `js/matching.js` | Único lugar del repo donde vive una regla. La interfaz no decide nada |
| Datos de ejemplo | `js/data.js` | Único lugar con datos. Nada de datos reales |
| Adaptación a pantallas | `js/revisor-cases.js` | Traduce el motor a la forma que consume la vista. No calcula, no decide |
| Estado de la sesión | `js/store.js` | sessionStorage. Sin backend, sin red |

## Invariantes

1. **Un anuncio no es una propiedad.** El sistema *vincula* (adjunta un anuncio); una persona *fusiona* entidades. No colapses los dos conceptos.
2. **Un veto gana al puntaje.** Un conflicto duro (piso distinto, superficie incompatible, tipo incompatible, dos owners verificados) impide vincular aunque el score sea 100. Nunca lo conviertas en un peso más.
3. **Un veto no promueve.** No puede mandar a revisión un par débil. Si el par no se parece, se descarta.
4. **Un dato faltante no puntúa.** Nunca rellenes un dato ausente con un valor neutro para "compensar": eso fue el error de la versión anterior.
5. **Sin ancla de ubicación no hay comparación.** Compartir el tipo no es evidencia de nada.
6. **Nada de números inventados en pantalla.** Si un valor no sale del motor, de `data.js` o de una suma verificable, no va. Ni KPIs decorativos, ni gráficos sin datos.
7. **Privacidad.** El owner nunca ve datos internos del catálogo ni la identidad del cliente. Todo conteo de interés menor a 3 se muestra como rango. El piso de anonimato aplica al cliente, no al expediente del propio owner.

## Cómo correrlo

```bash
npm test        # reglas de coincidencia (debe quedar en verde siempre)
npm run corpus  # precisión, recall y costo de revisión por umbral
npm start       # servidor local sin dependencias en :3000
```

Cada pantalla también se abre sola desde el sistema de archivos: no hay build ni rutas absolutas.

## Cómo se verifica un cambio

Antes de dar algo por terminado:

1. `npm test` en verde. Si una prueba falla, **no la borres para que pase**: explica por qué cambió el resultado.
2. Si tocaste pesos, umbrales o vetos: `npm run corpus` y reporta la fila del umbral 85. Si sube el recall pero se dispara la cola de revisión, no es una mejora.
3. Si tocaste una pantalla: ábrela en el navegador y mírala a 1440 px y a 430 px. Un cambio de interfaz sin captura no está terminado.
4. Nada de referencias externas: sin CDN, sin fuentes remotas, sin imágenes externas. Todo autocontenido.

## Cómo repartir el trabajo

- Una tarea chica por agente. Si no cabe en una descripción de tres líneas, está mal cortada.
- **Nunca dos agentes en el mismo archivo.** Paraleliza por pantalla o por módulo, con superficies de edición disjuntas.
- El agente que escribe no es el que aprueba. Un cambio de reglas lo revisa alguien distinto, con `npm run corpus` a la vista.
- Si el diseño ya está aprobado, no lo rediseñes: portalo.

## Qué no va sin revisión humana

Fusiones de datos, cambios de umbral o de pesos, permisos, privacidad, datos de ejemplo y decisiones de producto. Un agente puede proponerlos y dejarlos listos; no puede darlos por buenos.

## Estilo del contenido visible

Español de México, sin voseo, sin jerga innecesaria. Textos de interfaz que expliquen el porqué, no solo el qué: el revisor tiene que entender la consecuencia de fusionar antes de fusionar.

## Commits y PR

Conventional Commits (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`). Un commit por unidad revisable: código, pruebas y documentación de la misma conducta van juntos. El cuerpo del commit explica el *por qué* y la evidencia, no repite el diff.

## Atribución: de dónde viene un cambio

El repo necesita distinguir un PR de una persona de uno de un agente para poder medir su salud. La convención es doble y **las dos señales se declaran, no se verifican**:

1. **Rama** `agent/<alcance>` cuando el trabajo lo inicia un agente.
2. **Trailer** en el cuerpo del commit, en su propia línea: `Agent: <nombre>`.

```bash
git commit -m "feat(alta): pedir el piso" -m "Agent: pi (el Gentleman)"
```

El workflow `label-pr.yml` pone `agent-pr` si aparece cualquiera de las dos, y deja en el log cuál coincidió: `rama`, `trailer` o `ambas`.

**Por qué un trailer propio y no `Co-Authored-By`:** ese campo es para acreditar coautoría y las herramientas lo usan de forma inconsistente. Un trailer `Agent:` es inequívoco y se puede buscar con un `grep`.

**Qué no resuelve.** Las dos señales son auto-declaradas: un agente que no las ponga es invisible, y un humano puede escribirlas. La única señal que GitHub no puede confundir con una persona es una **identidad separada** —cuenta de máquina o GitHub App— con su propio token y sus propios permisos. Este repo no la usa, y es una decisión consciente: agregar una identidad que rotar no tiene retorno en un prototipo de demostración. El día que la métrica importe de verdad, ese es el paso que sigue.

**Consecuencia práctica:** si una persona commitea trabajo hecho por un agente, deja el trailer. Borrarlo no limpia el commit: rompe la medición.

## Definición de terminado

- La conducta pedida existe y se puede mostrar en pantalla o en una prueba.
- Las pruebas cubren la decisión y el motivo, no un rango de puntaje.
- Ningún botón queda muerto: toda acción cambia estado, deja historial y se puede deshacer si es destructiva.
- Los estados vacío, sin evidencia, error y decidido existen.
- Se revisó a 1440 px y a 430 px.
