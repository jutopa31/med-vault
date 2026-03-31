---
type: guide
last_updated: 2026-03-21
tags: [automatizaciones, ia]
---

# Automatizaciones Clinicas

Carpetas:

- `prompts/`: instrucciones para LLMs.
- `logs/`: ejecucion de pipelines.
- `outputs/`: artefactos intermedios si hicieran falta.

Flujo recomendado:

1. `scrape-ospedyc.js` genera agenda del dia.
2. `scrape-ospedyc-paciente.js` descarga HCE por paciente.
3. `normalize-patient-history.js` consolida historia.
4. `generate-patient-summary-claude.js` genera resumen y borrador.

Todos los pasos deben escribir archivos dentro del vault.

## Estado actual de scrapers

### `scrape-pilar.js`

Estado al 2026-03-21: funcionando.

- Comando validado: `DISPLAY=:0 node /home/jutopa/MedVault/scripts/scrape-pilar.js --headed`
- Flujo actual: entra directo a `Historia Clinica Web`, abre `Mis Agendas`, selecciona `NEUROLOGIA - DR ALONSO JULIAN` y extrae solo la fecha objetivo.
- Ultima verificacion funcional: genero `/home/jutopa/MedVault/agenda/consultorios/pilar/2026-03-18_lista.md` con 17 pacientes.
- Diagnosticos: `/home/jutopa/MedVault/agenda/consultorios/pilar/_debug/{YYYY-MM-DD}/`

Notas operativas:

- El portal devuelve multiples miercoles futuros; el scraper los filtra por la fecha objetivo antes de extraer.
- Si falla la navegacion visual, el motor comun usa espera explicita de selectores y fallback a click por JS para tabs legacy.
