---
type: agent-guide
version: 1.0
last_updated: 2026-03-21
tags: [meta, guia-agente]
---

# AGENT_GUIDE.md — Guía de operaciones del agente para MedVault

Este documento es la fuente de verdad para cualquier agente de IA que opere
este vault. Seguir estas convenciones garantiza consistencia, buscabilidad
y privacidad.

---

## Principios generales

1. **Todo es markdown local.** No hay sincronización cloud. Los archivos
   viven en `/home/jutopa/MedVault/`.
2. **Los templates en `_templates/` son la única fuente de verdad** para
   el formato de cada tipo de nota. Antes de crear cualquier nota nueva,
   leer el template correspondiente.
3. **Los IDs de paciente son el slug único.** Formato:
   `apellido-nombre_YYYYMMDD` (fecha de nacimiento). Ejemplo:
   `garcia-carlos_19580312`.
   Si no se conoce la fecha de nacimiento, usar `_desconocida`.
4. **Nunca modificar archivos en `_templates/`.** Solo leer.
5. **Siempre actualizar `last_updated`** en el frontmatter al editar una nota existente.
6. **El campo `tags` en frontmatter usa listas YAML**, nunca hashtags inline
   en el frontmatter. Los hashtags `#tag` son válidos en el cuerpo del
   documento para el sistema de tareas.

---

## Cómo agregar un paciente nuevo

**Operación:** Primera consulta de un paciente desconocido.

**Pasos:**
1. Ejecutar:
   ```bash
   ./vault.sh new patient "Apellido Nombre" "YYYY-MM-DD" "obra-social"
   ```
2. El script crea:
   - `pacientes/{patient_id}/historia-clinica.md`
   - `pacientes/{patient_id}/evoluciones/` (carpeta vacía)
   - Agrega línea al índice `pacientes/_index.md`
3. Completar manualmente en `historia-clinica.md`:
   - Sexo, edad, teléfono, domicilio
   - Antecedentes patológicos
   - Medicación habitual
4. Registrar la primera evolución (ver sección siguiente).

**Convención de nombre de carpeta:**
`{apellido-nombre}_{YYYYMMDD}` todo en minúsculas, sin acentos,
espacios reemplazados por guiones.

---

## Cómo registrar una evolución / consulta

**Operación:** El médico atendió a un paciente existente.

**Pasos:**
1. Identificar el `patient_id` (buscar en `pacientes/_index.md` o
   ejecutar `./vault.sh patient search "apellido"`).
2. Determinar el número de visita:
   ```bash
   ./vault.sh patient evolutions "{patient_id}" | wc -l
   # sumarle 1 para el número de visita siguiente
   ```
3. Crear el archivo de evolución:
   ```
   pacientes/{patient_id}/evoluciones/{YYYY-MM-DD}_evolucion.md
   ```
   Usando el template `_templates/TPL_patient-evolution.md`.
4. Completar todos los campos del cuerpo clínico.
5. Actualizar `last_updated` en `historia-clinica.md`.
6. Si hay cambios en medicación crónica, actualizar la tabla en
   `historia-clinica.md`.
7. Agregar link a la evolución en la sección "Evoluciones" de
   `historia-clinica.md`:
   ```markdown
   - [[evoluciones/YYYY-MM-DD_evolucion|YYYY-MM-DD — motivo]]
   ```
8. En la nota diaria, registrar bajo "Evoluciones registradas hoy":
   ```markdown
   - [[pacientes/{patient_id}/evoluciones/YYYY-MM-DD_evolucion|Apellido — motivo]]
   ```

---

## Cómo agregar un turno / cita a la agenda

**Pasos:**
1. Abrir o crear la nota diaria:
   ```bash
   ./vault.sh init day          # crea si no existe
   ./vault.sh agenda today      # muestra contenido
   ```
2. Editar la tabla "Agenda del día" agregando la fila:
   ```markdown
   | 10:00 | [[pacientes/{id}/historia-clinica|Apellido]] | consultorio-belgrano | control HTA |
   ```
3. Si la cita tiene una tarea de preparación, agregarla como tarea:
   ```markdown
   - [ ] 📅 YYYY-MM-DD Pedir laboratorio antes de turno de Apellido #administrativo/obra-social
   ```

### Automatizacion disponible: Hospital de Pilar

Si la agenda de neurologia del Hospital de Pilar se obtiene desde el portal,
usar:

```bash
DISPLAY=:0 node /home/jutopa/MedVault/scripts/scrape-pilar.js --headed
```

Resultado esperado:

- Escribe la agenda en `agenda/consultorios/pilar/{YYYY-MM-DD}_lista.md`
- Guarda capturas y HTML de diagnostico en `agenda/consultorios/pilar/_debug/{YYYY-MM-DD}/`
- Filtra los miercoles futuros para conservar solo la fecha objetivo

Si el portal cambia y deja de responder, revisar primero los snapshots de
`_debug/` antes de tocar selectores o cambiar el flujo.

---

## Cómo agregar una guardia

**Pasos:**
1. Crear archivo:
   ```
   agenda/guardias/YYYY-MM-DD_guardia_{lugar}.md
   ```
   Usando el frontmatter de tipo `guardia`.
2. Al inicio: completar `shift_start` y `location`.
3. Durante: tomar notas de casos (sin identificadores si son notas breves;
   crear evolución completa si el paciente se registra).
4. Al terminar: completar `shift_end`, `cases_count`, `notable_cases`.
5. Linkear desde la nota diaria correspondiente.

---

## Cómo agregar una tarea administrativa

**Pasos:**
1. Crear archivo en `administrativo/tareas/`:
   ```
   YYYY-MM-DD_{categoria}-{descripcion-breve}.md
   ```
   Usando `_templates/TPL_admin-task.md`.
2. Establecer `due_date` y `priority` en el frontmatter.
3. En el cuerpo, crear ítems con sintaxis Obsidian Tasks:
   ```markdown
   - [ ] 📅 YYYY-MM-DD Descripción de la tarea #administrativo/pami
   ```
4. Para listar todas las tareas pendientes:
   ```bash
   ./vault.sh tasks pending
   ./vault.sh tasks due today
   ```

---

## Cómo marcar una tarea como completada

**Opción A — Con script:**
```bash
./vault.sh tasks done "administrativo/tareas/archivo.md" 15
# 15 = número de línea de la tarea
```

**Opción B — Edición directa:**
Cambiar `- [ ]` por `- [x]` y agregar ` ✅ YYYY-MM-DD` al final.

**Formato Obsidian Tasks:**
```markdown
- [x] 📅 2026-03-15 Tarea completada ✅ 2026-03-20 #administrativo/pami
```

---

## Cómo registrar una reunión / ateneo

**Pasos:**
1. Crear archivo en `reuniones/`:
   ```
   YYYY-MM-DD_{tipo}-{titulo-slug}.md
   ```
2. Usar `_templates/TPL_meeting-note.md`.
3. Tipos válidos: `ateneo`, `reunion-servicio`, `congreso`, `curso`, `interconsulta`.
4. Si hay acciones derivadas, agregarlas como tareas con fecha límite.

---

## Convenciones de naming de archivos

| Tipo                 | Formato                                     | Ejemplo                                 |
|----------------------|---------------------------------------------|-----------------------------------------|
| Nota diaria          | `YYYY-MM-DD.md`                             | `2026-03-15.md`                         |
| Resumen semanal      | `YYYY-WNN.md`                               | `2026-W11.md`                           |
| Guardia              | `YYYY-MM-DD_guardia_{lugar}.md`             | `2026-03-15_guardia_hospitalcentral.md` |
| Historia clínica     | `historia-clinica.md` (dentro del paciente) | —                                       |
| Evolución            | `YYYY-MM-DD_evolucion.md`                   | `2026-03-15_evolucion.md`               |
| Reunión              | `YYYY-MM-DD_{tipo}-{slug}.md`               | `2026-03-15_ateneo-acv-isquemico.md`    |
| Tarea administrativa | `YYYY-MM-DD_{cat}-{slug}.md`                | `2026-03-15_pami-renovacion-garcia.md`  |
| Carpeta de paciente  | `{apellido-nombre}_{YYYYMMDD}/`             | `garcia-carlos_19580312/`               |

**Reglas de slug:**
- Todo minúsculas
- Sin acentos ni ñ (á→a, é→e, ñ→n)
- Espacios → guiones
- Solo caracteres `[a-z0-9-_]`

---

## Sistema de tareas — Sintaxis Obsidian Tasks

```markdown
- [ ] 📅 YYYY-MM-DD Descripción de la tarea #tag
- [x] 📅 YYYY-MM-DD Tarea completada ✅ YYYY-MM-DD #tag
```

**Emojis de metadatos:**
- `📅` — fecha de vencimiento (due date) — **OBLIGATORIO** para que el script funcione
- `⏫` — prioridad alta
- `🔼` — prioridad media
- `🔽` — prioridad baja
- `🔁` — tarea recurrente

**Tags de tareas más usados:**
- `#administrativo/pami`
- `#administrativo/obra-social`
- `#administrativo/receta`
- `#administrativo/certificado`
- `#paciente/seguimiento`
- `#formacion`

---

## Búsquedas frecuentes

```bash
# Pacientes con PAMI
grep -rl "obra_social: pami" /home/jutopa/MedVault/pacientes --include="*.md"

# Evoluciones del mes actual
find /home/jutopa/MedVault/pacientes -name "$(date +%Y-%m)*.md" -path "*/evoluciones/*"

# Pacientes con próxima visita este mes
grep -rn "next_visit: $(date +%Y-%m)" /home/jutopa/MedVault/pacientes --include="*.md"

# Tareas de PAMI pendientes
grep -rn "- \[ \].*pami" /home/jutopa/MedVault --include="*.md" | grep -v _templates

# Guardias del mes
find /home/jutopa/MedVault/agenda/guardias -name "$(date +%Y-%m)*.md"
```

---

## Privacidad y respaldo

- **Nunca** sacar datos de pacientes fuera de `/home/jutopa/MedVault/pacientes/`.
- Para respaldo local:
  ```bash
  tar -czf ~/backup-medvault-$(date +%Y%m%d).tar.gz /home/jutopa/MedVault/
  ```
- Almacenar respaldos en disco local o externo, **nunca** en servicios cloud sin cifrado.
- Para compartir casos clínicos: **anonimizar** todos los campos identificatorios antes de exportar.

---

## Tipos de nota válidos (campo `type` en frontmatter)

| Valor               | Descripción                  |
|---------------------|------------------------------|
| `daily-note`        | Nota diaria                  |
| `weekly-overview`   | Resumen semanal              |
| `guardia`           | Turno de guardia             |
| `patient-history`   | Historia clínica base        |
| `patient-evolution` | Evolución / consulta         |
| `meeting-note`      | Reunión / ateneo             |
| `admin-task`        | Tarea administrativa         |
| `agent-guide`       | Documentación interna (meta) |
| `dashboard`         | Tablero resumen              |
| `reference`         | Material de referencia       |
