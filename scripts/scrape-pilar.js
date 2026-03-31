#!/usr/bin/env node

const { runPortalScraper } = require('./lib/agent-browser-scraper');

runPortalScraper({
  slug: 'scrape-pilar',
  title: 'Hospital de Pilar',
  envPrefix: 'PILAR',
  urlKey: 'PILAR_URL',
  userKey: 'PILAR_USER',
  passKey: 'PILAR_PASS',
  targetWeekday: 3,
  outputDirName: 'pilar',
  location: 'hospital-pilar',
  tags: ['consultorio', 'pilar', 'agenda'],
  steps: [
    { type: 'goto', url: 'https://www.integrandosalud.com/src/hca/login_check.php?val=50', waitUntil: 'domcontentloaded', timeout: 45000 },
    { type: 'waitForSelector', selector: '#mis_agendas', state: 'attached', timeout: 45000 },
    { type: 'clickSelector', selector: '#mis_agendas', timeout: 15000 },
    { type: 'waitForSelector', selector: 'a[onclick*="showTurnosAgenda(20397"]', state: 'attached', timeout: 20000 },
    { type: 'eval', script: "showTurnosAgenda(20397, 'NEUROLOGIA - DR ALONSO JULIAN');" },
    { type: 'waitForSelector', selector: 'input[name=\"idAgenda\"][value=\"20397\"]', state: 'attached', timeout: 20000 },
    { type: 'eval', script: `showTurnosAgendaCuerpo();` },
    // Esperar a que el AJAX cargue los turnos antes de filtrar.
    { type: 'eval', script: `(async () => {
      await new Promise(resolve => {
        const check = () => document.querySelector('tr.resaltado') ? resolve() : setTimeout(check, 500);
        setTimeout(check, 500);
      });
    })()` },
    // El portal carga varios miércoles futuros; conservar solo la sección de la fecha objetivo.
    { type: 'eval', script: `
      const normalize = (value) => value
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .replace(/\\s+/g, ' ')
        .trim()
        .toLowerCase();

      const targetDate = new Date('__TARGET_DATE__T12:00:00');
      const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const expectedHeader = normalize(
        'Miercoles, ' +
        String(targetDate.getDate()).padStart(2, '0') +
        ' de ' +
        monthNames[targetDate.getMonth()] +
        ' del ' +
        targetDate.getFullYear()
      );

      let keepRows = false;
      document.querySelectorAll('#detalle_agenda_cuerpo table tbody tr, div.turnos table tbody tr').forEach(row => {
        const header = row.querySelector('td[colspan] label');
        if (header) {
          keepRows = normalize(header.textContent) === expectedHeader;
          if (!keepRows) row.remove();
          return;
        }

        if (!keepRows) row.remove();
      });
    ` },
  ],
  defaultSelectors: {
    rowSelector: 'tr.resaltado',
    hourSelector: 'td:nth-child(2)',
    nameSelector: 'td:nth-child(5)',
    reasonSelector: 'td:nth-child(6)',
  },
}).catch((err) => {
  console.error('[scrape-pilar] Error:', err.message);
  process.exit(1);
});
