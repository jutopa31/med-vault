#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ENV_PATH = path.join(__dirname, '.env');
const VAULT_ROOT = process.env.VAULT_ROOT || '/home/jutopa/MedVault';

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
}

function nextTuesday() {
  const d = new Date();
  const day = d.getDay();
  const daysUntil = (2 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntil);
  return d.toISOString().split('T')[0];
}

function formatDateDMY(dateString) {
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
}

function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function commandExists(command) {
  const result = spawnSync('bash', ['-lc', `command -v ${command}`], { encoding: 'utf8' });
  return result.status === 0;
}

function runtime() {
  if (process.env.AGENT_BROWSER_BIN && fs.existsSync(process.env.AGENT_BROWSER_BIN)) {
    return { cmd: process.env.AGENT_BROWSER_BIN, baseArgs: [] };
  }
  if (commandExists('agent-browser')) return { cmd: 'agent-browser', baseArgs: [] };
  const cacheRoot = path.join(process.env.HOME || '/home/jutopa', '.npm', '_npx');
  if (fs.existsSync(cacheRoot)) {
    const found = spawnSync('bash', ['-lc', `find ${JSON.stringify(cacheRoot)} -path '*/node_modules/agent-browser/bin/agent-browser-linux-arm64' | head -n 1`], { encoding: 'utf8' });
    const bin = (found.stdout || '').trim();
    if (bin && fs.existsSync(bin)) {
      return { cmd: bin, baseArgs: [] };
    }
  }
  return { cmd: 'npx', baseArgs: ['-y', 'agent-browser'] };
}

function run(args, options = {}) {
  const rt = runtime();
  const result = spawnSync(rt.cmd, [...rt.baseArgs, ...args], {
    encoding: 'utf8',
    cwd: options.cwd || __dirname,
    env: { ...process.env, ...(options.env || {}) },
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error((result.stderr || result.stdout || 'Fallo agent-browser').trim());
  }

  return (result.stdout || '').trim();
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function sleepMs(ms) {
  spawnSync('bash', ['-lc', `sleep ${Math.max(ms, 0) / 1000}`], { stdio: 'ignore' });
}

function fillFirstVisibleTextInput(value) {
  run(['--session', 'scrape-ospedyc-session', 'eval', `(() => {
    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const input = Array.from(document.querySelectorAll('input'))
      .find(el => ['text', 'search', ''].includes((el.type || '').toLowerCase()) && isVisible(el));
    if (!input) throw new Error('No se encontro input visible de texto');
    input.focus();
    input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return input.value;
  })()`]);
}

function snapshotInteractive() {
  return run(['--session', 'scrape-ospedyc-session', 'snapshot', '-i']);
}

function findButtonRef(snapshot, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = snapshot.match(new RegExp(`button "${escaped}" \\[ref=(e\\d+)\\]`));
  return match ? `@${match[1]}` : null;
}

function findTextboxRefs(snapshot) {
  return [...snapshot.matchAll(/textbox \[ref=(e\d+)\]/g)].map((match) => `@${match[1]}`);
}

function fillSelectDialog(consultorioValue) {
  const snapshot = snapshotInteractive();
  const textboxes = findTextboxRefs(snapshot);
  if (!snapshot.includes('Seleccione') || !textboxes.length) {
    throw new Error('No se pudo resolver el dialogo Seleccione por snapshot');
  }
  run(['--session', 'scrape-ospedyc-session', 'fill', textboxes[textboxes.length - 1], consultorioValue]);
  const saveRef = findButtonRef(snapshot, 'GUARDAR');
  if (!saveRef) throw new Error('No se encontro boton GUARDAR en dialogo Seleccione');
  run(['--session', 'scrape-ospedyc-session', 'click', saveRef]);
}

function waitForPatientRow(carnet, attempts = 8, delayMs = 1000) {
  for (let index = 0; index < attempts; index += 1) {
    const result = run(['--session', 'scrape-ospedyc-session', 'eval', `(() => {
      const row = [...document.querySelectorAll('table tr')]
        .find(tr => (tr.innerText || '').includes(${JSON.stringify(carnet)}));
      if (!row) return 'missing';
      const btn = row.querySelector('button');
      return btn ? 'ready' : 'no-button';
    })()`], { allowFailure: true });
    if (result.includes('ready')) return;
    sleepMs(delayMs);
  }
  throw new Error(`No se encontro fila para carnet ${carnet}`);
}

function openProblemsTab() {
  run(['--session', 'scrape-ospedyc-session', 'eval', `(() => {
    const normalize = (text) => (text || '').replace(/\\s+/g, ' ').trim();
    const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], span, div'));
    const found = nodes.find(el => normalize(el.innerText) === 'PROBLEMAS');
    if (!found) throw new Error('No se encontro tab PROBLEMAS');
    (found.closest('button, a, [role="button"]') || found).click();
    return 'ok';
  })()`]);
  for (let index = 0; index < 8; index += 1) {
    const result = run(['--session', 'scrape-ospedyc-session', 'eval', `(() => {
      return Array.from(document.querySelectorAll('h2'))
        .some(el => ((el.innerText || '').replace(/\\s+/g, ' ').trim()).startsWith('Problemas Activos')) ? 'ready' : 'missing';
    })()`], { allowFailure: true });
    if (result.includes('ready')) return;
    sleepMs(800);
  }
  throw new Error('No cargo la tab PROBLEMAS');
}

function fillVisibleDateAndSearch(dateValue) {
  const snapshot = snapshotInteractive();
  const textboxRefs = findTextboxRefs(snapshot);
  const dateRef = textboxRefs[0];
  const changeDateRef = findButtonRef(snapshot, 'change date');
  if (!dateRef || !changeDateRef) {
    throw new Error('No se pudieron resolver fecha/change date por snapshot');
  }

  run(['--session', 'scrape-ospedyc-session', 'fill', dateRef, dateValue]);
  run(['--session', 'scrape-ospedyc-session', 'click', changeDateRef]);
  sleepMs(800);

  const pickerSnapshot = snapshotInteractive();
  const okRef = findButtonRef(pickerSnapshot, 'OK');
  if (okRef) {
    run(['--session', 'scrape-ospedyc-session', 'click', okRef]);
    sleepMs(800);
  }

  const postPickerSnapshot = snapshotInteractive();
  const searchRef = findButtonRef(postPickerSnapshot, 'Buscar');
  if (!searchRef) {
    throw new Error('No se encontro boton Buscar luego de aplicar fecha');
  }
  run(['--session', 'scrape-ospedyc-session', 'click', searchRef]);
}

function ensureLoggedIn() {
  console.log('[scrape-ospedyc-paciente] Abriendo login');
  run(['--session', 'scrape-ospedyc-session', 'open', process.env.OSPEDYC_URL]);
  sleepMs(1200);

  const snapshot = run(['--session', 'scrape-ospedyc-session', 'snapshot', '-i']);
  if (!snapshot.includes('Ingreso al Sistema')) {
    console.log('[scrape-ospedyc-paciente] Sesion ya autenticada');
    return;
  }

  console.log('[scrape-ospedyc-paciente] Completando credenciales');
  run(['--session', 'scrape-ospedyc-session', 'fill', '#dni', process.env.OSPEDYC_USER]);
  run(['--session', 'scrape-ospedyc-session', 'fill', 'input[name="password"]', process.env.OSPEDYC_PASS]);
  run(['--session', 'scrape-ospedyc-session', 'click', 'button[type="submit"]']);
  sleepMs(2500);
  console.log('[scrape-ospedyc-paciente] Login enviado');
}

function navigateToPatient(carnet, targetDate) {
  const dmy = formatDateDMY(targetDate);
  console.log(`[scrape-ospedyc-paciente] Navegando a listado ${dmy} para carnet ${carnet}`);

  run(['--session', 'scrape-ospedyc-session', 'eval', `(() => {
    const byText = (text) => {
      const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], span, div'));
      const found = nodes.find(el => (el.innerText || '').replace(/\\s+/g, ' ').trim() === text);
      if (!found) throw new Error('No se encontro: ' + text);
      (found.closest('button, a, [role="button"]') || found).click();
    };
    byText('menu');
    return 'ok';
  })()`]);
  sleepMs(800);

  run(['--session', 'scrape-ospedyc-session', 'eval', `(() => {
    const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], span, div'));
    const found = nodes.find(el => (el.innerText || '').replace(/\\s+/g, ' ').trim() === 'Historia Clínica Electrónica');
    if (!found) throw new Error('No se encontro Historia Clínica Electrónica');
    (found.closest('button, a, [role="button"]') || found).click();
    return 'ok';
  })()`]);
  sleepMs(1800);

  run(['--session', 'scrape-ospedyc-session', 'eval', `(() => {
    const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], span, div'));
    const found = nodes.find(el => (el.innerText || '').replace(/\\s+/g, ' ').trim() === 'Menu');
    if (!found) throw new Error('No se encontro Menu');
    (found.closest('button, a, [role="button"]') || found).click();
    return 'ok';
  })()`]);
  sleepMs(800);

  run(['--session', 'scrape-ospedyc-session', 'eval', `(() => {
    const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], span, div'));
    const found = nodes.find(el => (el.innerText || '').replace(/\\s+/g, ' ').trim() === 'LISTADO DE PACIENTES');
    if (!found) throw new Error('No se encontro LISTADO DE PACIENTES');
    (found.closest('button, a, [role="button"]') || found).click();
    return 'ok';
  })()`]);
  sleepMs(1200);

  let snapshot = snapshotInteractive();
  if (snapshot.includes('Seleccione')) {
    console.log('[scrape-ospedyc-paciente] Resolviendo dialogo Seleccione');
    fillSelectDialog('5');
    sleepMs(2400);
  }

  console.log('[scrape-ospedyc-paciente] Aplicando fecha y buscando');
  fillVisibleDateAndSearch(dmy);
  sleepMs(1800);
  console.log('[scrape-ospedyc-paciente] Esperando fila de paciente');
  waitForPatientRow(carnet, 10, 1200);

  run(['--session', 'scrape-ospedyc-session', 'eval', `(() => {
    const row = [...document.querySelectorAll('table tr')].find(tr => tr.innerText.includes(${JSON.stringify(carnet)}));
    if (!row) throw new Error('No se encontro fila para carnet ${carnet}');
    const btn = row.querySelector('button');
    if (!btn) throw new Error('No se encontro boton de acceso para carnet ${carnet}');
    btn.click();
    return 'ok';
  })()`]);
  sleepMs(1600);
  console.log('[scrape-ospedyc-paciente] Abriendo tab PROBLEMAS');
  openProblemsTab();
  console.log('[scrape-ospedyc-paciente] Ficha del paciente abierta');
}

function extractPatientData() {
  const raw = run(['--session', 'scrape-ospedyc-session', 'eval', `(() => {
    const normalize = (text) => (text || '').replace(/\\s+/g, ' ').trim();
    const pairHeadings = Array.from(document.querySelectorAll('h6'))
      .map(el => normalize(el.innerText))
      .filter(Boolean);

    const kv = {};
    for (const line of pairHeadings) {
      const idx = line.indexOf(':');
      if (idx > 0) kv[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }

    const sectionNames = ['Problemas Activos', 'Problemas Resueltos', 'Antecedentes Personales', 'Antecedentes Familiares', 'Procedimientos'];
    const sections = {};

    for (const name of sectionNames) {
      const heading = Array.from(document.querySelectorAll('h2')).find(el => normalize(el.innerText).startsWith(name));
      if (!heading) {
        sections[name] = [];
        continue;
      }

      const rows = [];
      let cursor = heading.nextElementSibling;
      while (cursor && !/^H2$/i.test(cursor.tagName || '')) {
        if ((cursor.tagName || '').toLowerCase() === 'table') {
          const headers = Array.from(cursor.querySelectorAll('th')).map(th => normalize(th.innerText));
          rows.push(...Array.from(cursor.querySelectorAll('tr')).slice(1).map(tr => {
            const cells = Array.from(tr.querySelectorAll('td')).map(td => normalize(td.innerText));
            if (!cells.some(Boolean)) return null;
            const obj = {};
            headers.forEach((header, index) => { obj[header || 'col' + index] = cells[index] || ''; });
            return obj;
          }).filter(Boolean));
        }
        cursor = cursor.nextElementSibling;
      }
      sections[name] = rows;
    }

    const notes = Array.from(document.querySelectorAll('textarea, input[type="text"]'))
      .map(el => normalize(el.value))
      .filter(Boolean);

    return JSON.stringify({
      extracted_at: new Date().toISOString(),
      patient: {
        nombre: kv['Nombre'] || '',
        dni: kv['Dni'] || '',
        edad: kv['Edad'] || '',
        fecha_nacimiento: kv['FechaNacimiento'] || '',
        nro_beneficiario: kv['Nro Beneficiario'] || '',
        domicilio: kv['Domicilio'] || '',
        telefono: kv['Telefono'] || '',
        celular: kv['Celular'] || '',
        email: kv['Email'] || ''
      },
      sections,
      notes
    });
  })()`]);
  const parsed = JSON.parse(raw);
  return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
}

function extractProblemNames() {
  const raw = run(['--session', 'scrape-ospedyc-session', 'eval', `(() => {
    const normalize = (text) => (text || '').replace(/\\s+/g, ' ').trim();
    const heading = Array.from(document.querySelectorAll('h2')).find(el => normalize(el.innerText).startsWith('Problemas Activos'));
    if (!heading) return JSON.stringify([]);
    let table = heading.nextElementSibling;
    while (table && (table.tagName || '').toLowerCase() !== 'table') {
      table = table.nextElementSibling;
    }
    if (!table) return JSON.stringify([]);
    const names = Array.from(table.querySelectorAll('tr td:first-child span'))
      .map(el => (el.innerText || '').replace(/\\s+/g, ' ').trim())
      .filter(Boolean);
    return JSON.stringify(names);
  })()`]);
  const parsed = JSON.parse(raw);
  return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
}

function extractEvolutionsForProblem(problemName) {
  console.log(`[scrape-ospedyc-paciente] Abriendo problema: ${problemName}`);
  run(['--session', 'scrape-ospedyc-session', 'eval', `(() => {
    const normalize = (text) => (text || '').replace(/\\s+/g, ' ').trim();
    const span = Array.from(document.querySelectorAll('td span'))
      .find(el => normalize(el.innerText) === ${JSON.stringify(problemName)});
    if (!span) throw new Error('No se encontro problema: ' + ${JSON.stringify(problemName)});
    span.scrollIntoView({ block: 'center' });
    span.click();
    return 'ok';
  })()`]);
  sleepMs(1200);

  const raw = run(['--session', 'scrape-ospedyc-session', 'eval', `(() => {
    const normalize = (text) => (text || '').replace(/\\s+/g, ' ').trim();
    const dialog = Array.from(document.querySelectorAll('[role="dialog"]'))
      .find(el => Array.from(el.querySelectorAll('h1,h2,h3,h4,h5,h6')).some(h => normalize(h.innerText) === 'Evoluciones Paciente'));
    if (!dialog) throw new Error('No se encontro modal Evoluciones Paciente');

    const items = Array.from(dialog.querySelectorAll('li.MuiListItem-container, li'))
      .map((li) => {
        const textareas = Array.from(li.querySelectorAll('textarea'));
        const note = textareas.map(t => (t.value || '').trim()).find(Boolean) || '';
        const p = li.querySelector('p');
        const span = li.querySelector('span');
        return {
          problem: ${JSON.stringify(problemName)},
          note,
          meta: p ? normalize(p.innerText) : '',
          specialty: span ? normalize(span.innerText) : ''
        };
      })
      .filter(item => item.note || item.meta);

    return JSON.stringify(items);
  })()`]);

  const closeResult = run(['--session', 'scrape-ospedyc-session', 'eval', `(() => {
    const normalize = (text) => (text || '').replace(/\\s+/g, ' ').trim();
    const dialog = Array.from(document.querySelectorAll('[role="dialog"]'))
      .find(el => Array.from(el.querySelectorAll('h1,h2,h3,h4,h5,h6')).some(h => normalize(h.innerText) === 'Evoluciones Paciente'));
    if (!dialog) return 'missing';
    const closeBtn = dialog.querySelector('button[aria-label="close"]');
    if (!closeBtn) return 'no-close-btn';
    closeBtn.click();
    return 'closed';
  })()`], { allowFailure: true });
  if (!closeResult.includes('closed')) {
    run(['--session', 'scrape-ospedyc-session', 'press', 'Escape'], { allowFailure: true });
  }
  sleepMs(500);

  const parsed = JSON.parse(raw);
  const items = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
  console.log(`[scrape-ospedyc-paciente] Evoluciones en "${problemName}": ${items.length}`);
  return items;
}

function ensurePatientFiles(baseDir, data, targetDate) {
  const patient = data.patient;
  const humanName = patient.nombre || 'Paciente sin nombre';
  const frontmatterTime = new Date().toISOString();

  const indexPath = path.join(baseDir, '_index.md');
  if (!fs.existsSync(indexPath)) {
    writeFile(indexPath, `---
type: patient-index
patient_id: ${patient.nro_beneficiario || ''}
name: ${humanName}
document: ${patient.dni || ''}
birth_date: ${patient.fecha_nacimiento || ''}
coverage: OSPEDYC
source_system: ospedyc
last_scraped_at: ${frontmatterTime}
tags: [paciente]
---

# ${humanName}

- Patient ID: ${patient.nro_beneficiario || ''}
- Documento: ${patient.dni || ''}
- Fecha de nacimiento: ${patient.fecha_nacimiento || ''}
- Cobertura: OSPEDYC
- Fuente: Ospedyc HCE
- Ultima sincronizacion: ${frontmatterTime}

## Historia

- [[historia/normalizado/problemas]]
- [[historia/normalizado/timeline]]

## Resumen

- [[resumen/resumen-clinico]]
- [[resumen/resumen-ia]]

## Evoluciones

- [[evoluciones/${targetDate}_borrador-ia]]
`);
  }

  writeFile(path.join(baseDir, 'demografia.md'), `---
type: patient-demography
patient_id: ${patient.nro_beneficiario || ''}
name: ${humanName}
document: ${patient.dni || ''}
birth_date: ${patient.fecha_nacimiento || ''}
coverage: OSPEDYC
phone: ${patient.telefono || ''}
address: ${patient.domicilio || ''}
last_updated: ${frontmatterTime}
tags: [paciente, demografia]
---

# Demografia

## Datos personales

- Nombre: ${humanName}
- Documento: ${patient.dni || '-'}
- Fecha de nacimiento: ${patient.fecha_nacimiento || '-'}
- Edad: ${patient.edad || '-'}

## Contacto

- Telefono: ${patient.telefono || '-'}
- Celular: ${patient.celular || '-'}
- Email: ${patient.email || '-'}
- Domicilio: ${patient.domicilio || '-'}

## Cobertura

- Obra social / plan: OSPEDYC
- Numero de afiliado: ${patient.nro_beneficiario || '-'}
`);

  const activeProblems = (data.sections['Problemas Activos'] || []).map((row) =>
    `| ${row.Problema || '-'} | Activo | ${row.FechaAlta || '-'} | ${row.FechaAlta || '-'} | ${row.Doctor || '-'} |`
  ).join('\n');
  const resolvedProblems = (data.sections['Problemas Resueltos'] || []).map((row) =>
    `| ${row.Problema || '-'} | ${row.FechaAlta || '-'} | ${row.Doctor || '-'} |`
  ).join('\n');

  writeFile(path.join(baseDir, 'historia/normalizado/problemas.md'), `---
type: patient-problem-list
patient_id: ${patient.nro_beneficiario || ''}
name: ${humanName}
source_system: ospedyc
source_file: historia/raw/${targetDate}_ospedyc_hce.json
scraped_at: ${frontmatterTime}
tags: [paciente, problemas]
---

# Problemas Activos

| Problema | Estado | Inicio | Ultima mencion | Notas |
|----------|--------|--------|----------------|-------|
${activeProblems || '| - | - | - | - | - |'}

## Problemas Resueltos

| Problema | Resuelto | Notas |
|----------|----------|-------|
${resolvedProblems || '| - | - | - |'}

## Observaciones

- Extraido automaticamente desde la tab PROBLEMAS de Ospedyc.
`);

  const timelineRows = (data.sections['Problemas Activos'] || []).map((row) => `### ${row.FechaAlta || 'Sin fecha'}

- Problema: ${row.Problema || '-'}
- Profesional: ${row.Doctor || '-'}
- Fuente: Ospedyc / Problemas activos
`).join('\n');

  writeFile(path.join(baseDir, 'historia/normalizado/timeline.md'), `---
type: patient-timeline
patient_id: ${patient.nro_beneficiario || ''}
name: ${humanName}
source_system: ospedyc
source_file: historia/raw/${targetDate}_ospedyc_hce.json
scraped_at: ${frontmatterTime}
tags: [paciente, timeline]
---

# Timeline Clinico

${data.evolutions && data.evolutions.length
    ? data.evolutions.map((item) => `### ${item.meta || 'Sin fecha'}

- Problema: ${item.problem || '-'}
- Especialidad: ${item.specialty || '-'}
- Texto:

${item.note || '-'}
`).join('\n')
    : timelineRows || '## Eventos\n\n- Sin eventos normalizados todavia.'}

## Alertas

- Evoluciones clinicas detalladas: ${data.evolutions && data.evolutions.length ? 'extraidas desde Ospedyc' : 'pendiente de automatizar'}.
`);

  const summaryPath = path.join(baseDir, 'resumen/resumen-clinico.md');
  if (!fs.existsSync(summaryPath)) {
    writeFile(summaryPath, `---
type: patient-summary
patient_id: ${patient.nro_beneficiario || ''}
name: ${humanName}
summary_kind: clinico
generated_by: plantilla
generated_at: ${frontmatterTime}
tags: [paciente, resumen]
---

# Resumen del Paciente

## Identificacion

- Nombre: ${humanName}
- Documento / carnet: ${patient.nro_beneficiario || patient.dni || '-'}
- Cobertura: OSPEDYC

## Diagnosticos o problemas relevantes

- Completar desde [[../historia/normalizado/problemas]]

## Tratamientos actuales

- Pendiente

## Antecedentes relevantes

- Pendiente

## Estudios relevantes

- Pendiente

## Pendientes

- Automatizar extraccion de evoluciones clinicas.
`);
  }

  const aiSummaryPath = path.join(baseDir, 'resumen/resumen-ia.md');
  if (!fs.existsSync(aiSummaryPath)) {
    writeFile(aiSummaryPath, `---
type: patient-summary
patient_id: ${patient.nro_beneficiario || ''}
name: ${humanName}
summary_kind: ia
generated_by:
generated_at:
tags: [paciente, resumen, ia]
---

# Resumen IA

Pendiente de generar con Claude a partir de:

- [[../historia/normalizado/problemas]]
- [[../historia/normalizado/timeline]]
- [[../demografia]]
`);
  }

  const evoDraftPath = path.join(baseDir, `evoluciones/${targetDate}_borrador-ia.md`);
  if (!fs.existsSync(evoDraftPath)) {
    writeFile(evoDraftPath, `---
type: patient-evolution
patient_id: ${patient.nro_beneficiario || ''}
name: ${humanName}
date: ${targetDate}
status: borrador-ia
source_system: ospedyc
generated_by:
generated_at:
tags: [paciente, evolucion, borrador]
---

# Evolucion Borrador

## Motivo de consulta

-

## Subjetivo

-

## Objetivo

-

## Evaluacion

-

## Plan

-

## Fuente utilizada

- [[../historia/normalizado/problemas]]
- [[../historia/normalizado/timeline]]
- [[../resumen/resumen-ia]]
`);
  }
}

async function main() {
  loadEnv();

  const carnet = process.argv[2];
  const targetDate = process.argv[3] || nextTuesday();

  if (!carnet) {
    console.error('Uso: node scrape-ospedyc-paciente.js <carnet> [YYYY-MM-DD]');
    process.exit(1);
  }

  if (!process.env.OSPEDYC_URL || !process.env.OSPEDYC_USER || !process.env.OSPEDYC_PASS) {
    console.error('Faltan OSPEDYC_URL / OSPEDYC_USER / OSPEDYC_PASS en scripts/.env');
    process.exit(1);
  }

  console.log(`[scrape-ospedyc-paciente] Inicio carnet=${carnet} fecha=${targetDate}`);
  ensureLoggedIn();
  navigateToPatient(carnet, targetDate);
  const data = extractPatientData();
  const problemNames = extractProblemNames();
  console.log(`[scrape-ospedyc-paciente] Problemas activos detectados: ${problemNames.length}`);
  const evolutions = [];
  for (const problemName of problemNames) {
    try {
      evolutions.push(...extractEvolutionsForProblem(problemName));
    } catch (error) {
      evolutions.push({
        problem: problemName,
        note: '',
        meta: `ERROR: ${error.message}`,
        specialty: '',
      });
    }
  }
  data.evolutions = evolutions;

  const patientId = data.patient.nro_beneficiario || carnet;
  const patientSlug = slugify(data.patient.nombre || patientId);
  const patientDir = path.join(VAULT_ROOT, 'pacientes', `${patientId}-${patientSlug}`);
  const rawFile = path.join(patientDir, 'historia/raw', `${targetDate}_ospedyc_hce.json`);
  const rawSummary = path.join(patientDir, 'historia/raw', `${targetDate}_ospedyc_hce.md`);

  writeFile(rawFile, JSON.stringify(data, null, 2));
  writeFile(rawSummary, `---
type: patient-history-raw
patient_id: ${patientId}
name: ${data.patient.nombre || ''}
source_system: ospedyc
scraped_at: ${data.extracted_at}
tags: [paciente, raw, ospedyc]
---

# Extraccion cruda Ospedyc

- Nombre: ${data.patient.nombre || '-'}
- DNI: ${data.patient.dni || '-'}
- Beneficiario: ${data.patient.nro_beneficiario || '-'}
- Fecha de extraccion: ${data.extracted_at}

## Secciones extraidas

- Problemas Activos: ${(data.sections['Problemas Activos'] || []).length}
- Problemas Resueltos: ${(data.sections['Problemas Resueltos'] || []).length}
- Antecedentes Personales: ${(data.sections['Antecedentes Personales'] || []).length}
- Antecedentes Familiares: ${(data.sections['Antecedentes Familiares'] || []).length}
- Procedimientos: ${(data.sections['Procedimientos'] || []).length}
- Evoluciones: ${(data.evolutions || []).length}

## Evoluciones

${(data.evolutions || []).map((item) => `### ${item.problem}

- ${item.meta || '-'}
- ${item.specialty || '-'}

${item.note || '-'}
`).join('\n') || 'Sin evoluciones extraidas.'}
`);

  ensurePatientFiles(patientDir, data, targetDate);

  console.log(`[scrape-ospedyc-paciente] Paciente: ${data.patient.nombre || patientId}`);
  console.log(`[scrape-ospedyc-paciente] Carpeta: ${patientDir}`);
  console.log(`[scrape-ospedyc-paciente] Raw JSON: ${rawFile}`);
  console.log(`[scrape-ospedyc-paciente] Problemas activos: ${(data.sections['Problemas Activos'] || []).length}`);
  console.log(`[scrape-ospedyc-paciente] Evoluciones: ${(data.evolutions || []).length}`);
}

main().catch((err) => {
  console.error('[scrape-ospedyc-paciente] Error:', err.message);
  process.exit(1);
});
