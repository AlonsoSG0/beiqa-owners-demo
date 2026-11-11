# prototipo-owners — Prototipo navegable de la Plataforma de Owners (BEIQA)

Demo del caso práctico: alta de inmueble, aviso de posible duplicado y vista del revisor
interno con las razones de cada coincidencia. HTML sin backend, reglas en JavaScript, datos
generados, pruebas automatizadas y CI. Este documento es la especificación que leen los
subagentes: se lee completo hasta `## Log`.

## Specs

**S1.** Del caso, sección 6: "Un **prototipo HTML navegable**, sin backend, con reglas
simuladas en JavaScript y datos que tú generes. Debe mostrar el alta de un inmueble, el aviso
de que podría ya existir y la vista del revisor interno con las razones de cada coincidencia."

**S2.** Del caso, sección 6: "Pruebas automatizadas de tus reglas de coincidencia, incluyendo
casos difíciles a propósito."

**S3.** Del caso, sección 6: "Al menos un **workflow de GitHub Actions** que corra esas pruebas
en cada PR."

**S4.** Del caso, sección 6: "Al menos **un PR** con la descripción como la escribirías en un
equipo real."

**S5.** Del caso, sección 6: "Los archivos de instrucciones que le darías a un agente de IA
para trabajar en ese repo."

**S6.** Del caso, sección 5B: "**Cómo sabemos si ya la tenemos en el catálogo:** qué señales
comparas, qué se decide solo y qué revisa un humano, y cómo deshaces un error."

**S7.** Del usuario: "para el diseño quiero que se haga con el mcp de open design". Aprobado:
"Las 4 pantallas, incluyendo la de valor del owner" con "interés agregado, visitas y
disponibilidad (con piso de anonimato ≥3)".

**S8.** Del usuario: "usa este directorio, solo mete los .md que tenemos ahora y la imagen en
el gitignore, maneja los commits de la mejor manera con el estandar de la industria y haz caso
a lo que piden en el caso, inicia el repo aqui y manejemoslo local".

**S9.** Del caso, sección 4: el portal "nunca datos de contacto del owner" y la plataforma de
owners "nunca la identidad del cliente sin su autorización".

**S10.** Del usuario (alcance de esta fase): "aquí es solo para el demo y el caso". Nada de
arquitectura de producción, React, Bun ni despliegue en esta entrega.

**S11.** Criterio de diseño aprobado en el mockup (`demo-contrato-de-decision.md`, no
versionado): el sistema **vincula** y solo una persona **fusiona**; un **veto gana al puntaje**;
la **cobertura de evidencia** se muestra junto al veredicto; no se puede fusionar sin ver el
diff y su consecuencia.

## Tasks

- [ ] T1 — Motor de coincidencia: normalización, blocking, señales, vetos, cobertura, umbrales. Tests primero. (S1, S2, S6, S11)
- [ ] T2 — Conjunto etiquetado + barrido de umbrales con precisión, recall y costo de revisión. (S2, S6)
- [ ] T3 — Datos generados: catálogo y los seis casos del contrato. (S1)
- [ ] T4 — Estado compartido entre pantallas (`js/store.js`), sin backend. (S1, S11)
- [ ] T5 — Pantalla de alta guiada, 3 pasos con extracción de brochure y completitud. (S1, S7)
- [ ] T6 — Pantalla de aviso de posible duplicado, lado owner, con acciones reales. (S1, S7, S9)
- [ ] T7 — Pantalla del revisor: cola, veredicto, cobertura, veto, convergencia, diff con precedencia, acciones, historial. (S1, S7, S11)
- [ ] T8 — Panel de valor del owner con piso de anonimato. (S7, S9)
- [ ] T9 — Workflow de GitHub Actions. (S3)
- [ ] T10 — `AGENTS.md` y README con las reglas del repo. (S5)
- [ ] T11 — Rama, commits por unidad y descripción de PR. (S4, S8)
- [ ] T12 — Correcciones detectadas en la revisión del mockup: registro entrante mal etiquetado, candidato que se apunta a sí mismo, aritmética del panel, navegación cortada a 430 px, etiquetas pisadas en la banda de convergencia, scores alineados al motor. (S1, S7)

## Log

**L1.** "necesito que me ayudes con este caso practivo - Documento que me dieron: @Caso-practico-Plataforma-de-Owners-Full-Stack.md + @diagrama-ecosistema.png - Contexto y resumen que tuve con otro agente: @beiqa-caso-owners-contexto-para-agente.md - Demo del otro agente: /home/atripp/Projects/beiqa-owners-platform necesito que lo revises, todo, realmente las propuestas de solucion del otro agente me gustaron, pero la ejecucion en la demo no me gusta para nada, asi que ahi entras tu mas un nuevo contexto y un nuevo criterio, como primera tarea es que revises los documentos y la demo del otro agente, vas a enliastar las soluciones que encontramos con el otro agente una opiniion tuya, algo que cambiarias si es que lo hay, por que y bajo que critero, tabmein si agregarias una mejora o algun detalle extra, aqui la idea primero es la demo y vemos despues el documetno, ahor enfoquemonos en resolver el caso de la mejor manera posible, los cambios, criticas, opiniones que hagas o tengas que sean fundamentadas, no solo por poner algo, ok? necesito el mejor criterio, aun no contruyas nada, haz el analisis y propuesta"

**L2.** Revisión hecha. Hallazgo que define el producto: el scoring aditivo sin veto duro
auto-fusiona dos oficinas distintas del mismo edificio (98 puntos, piso 4 vs piso 6). Evidencia
ejecutada sobre `js/matching.js` del v1. De ahí salen S11 y el caso héroe de la demo.

**L3.** "contigo toquemos lo de la demo y lo que pide la prueba no otras cosas, como la parte de
react y bun y eso, aqui es solo para el demo y el caso, va? primero para hacer esto una de las
cosas importantes es el diseño ui ux ... para el diseño quiero que se haga con el mcp de open
design, va? esta parte de ui ux es de las cosas mas importantes porque como dato extra esto me
lo hicieron saber en la entrevista, es gran parte del reto". Decide: 4 pantallas en una sola
dirección, incluyendo la de valor del owner.

**L4.** Mockup generado en OpenDesign (proyecto `beiqa-owners-demo`, 4 HTML autocontenidos +
DESIGN.md). Revisado renderizado a 1440 y 430 px. Seis defectos de contenido y responsive
anotados en T12; la dirección visual se aprueba.

**L5.** "usa este directorio, solo mete los .md que tenemos ahora y la imagen en el gitignore,
maneja los commits de la mejor manera con el estandar de la industria y haz caso a lo que piden
en el caso, inicia el repo aqui y manejemoslo local". Repo local, rama principal `main`,
ramas cortas por unidad, Conventional Commits.
