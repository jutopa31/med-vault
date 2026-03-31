#!/usr/bin/env node

const { runPortalScraper } = require('./lib/agent-browser-scraper');

runPortalScraper({
  slug: 'scrape-ospedyc',
  title: 'Ospedyc Moron',
  envPrefix: 'OSPEDYC',
  urlKey: 'OSPEDYC_URL',
  userKey: 'OSPEDYC_USER',
  passKey: 'OSPEDYC_PASS',
  targetWeekday: 2,
  outputDirName: 'ospedyc',
  location: 'ospedyc-moron',
  tags: ['consultorio', 'ospedyc', 'agenda'],
  defaultSelectors: {
    loginUserSelector: '#dni',
    loginPassSelector: 'input[name="password"]',
    loginSubmitSelector: 'button[type="submit"].MuiButton-fullWidth',
    postLoginWaitMs: 2500,
    rowSelector: 'table tr',
    hourSelector: 'td:nth-child(2)',
    nameSelector: 'td:nth-child(5)',
    insuranceSelector: 'td:nth-child(4)',
    reasonSelector: 'td:nth-child(7)',
  },
  steps: [
    { type: 'wait', ms: 1000 },
    { type: 'clickText', text: 'menu' },
    { type: 'wait', ms: 800 },
    { type: 'clickText', text: 'Historia Clínica Electrónica' },
    { type: 'wait', ms: 1800 },
    { type: 'clickText', text: 'Menu' },
    { type: 'wait', ms: 800 },
    { type: 'clickText', text: 'LISTADO DE PACIENTES' },
    { type: 'wait', ms: 1200 },
    { type: 'fillFirstTextbox', value: '5' },
    { type: 'clickText', text: 'GUARDAR' },
    { type: 'wait', ms: 1800 },
    { type: 'fillFirstTextbox', value: '__TARGET_DATE_DMY__' },
    { type: 'clickSelector', selector: 'button[aria-label="change date"]' },
    { type: 'wait', ms: 1800 },
  ],
}).catch((err) => {
  console.error('[scrape-ospedyc] Error:', err.message);
  process.exit(1);
});
