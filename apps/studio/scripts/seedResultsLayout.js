/**
 * Sets queryResultsLayout in an app database, so an e2e run can exercise a
 * specific results layout. There is no settings control reachable from the
 * query screen, and the renderer's Vuex store is not exposed in a production
 * build, so the value has to be in place before the app starts.
 *
 * better-sqlite3 is built against Electron's ABI, so run this under Electron:
 *
 *   ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron \
 *     apps/studio/scripts/seedResultsLayout.js apps/studio/tmp/app.db stacked
 */
const Database = require('better-sqlite3');

const [dbPath, layout] = process.argv.slice(2);

if (!dbPath || !['tabs', 'stacked'].includes(layout)) {
  console.error('usage: seedResultsLayout.js <app.db> <tabs|stacked>');
  process.exit(1);
}

const db = new Database(dbPath);
const existing = db.prepare("SELECT id FROM user_setting WHERE key = 'queryResultsLayout'").get();

if (existing) {
  db.prepare('UPDATE user_setting SET userValue = ? WHERE id = ?').run(layout, existing.id);
} else {
  db.prepare(`
    INSERT INTO user_setting (section, key, userValue, defaultValue, valueType, createdAt, updatedAt, version)
    VALUES (NULL, 'queryResultsLayout', ?, 'tabs', 0, datetime('now'), datetime('now'), 0)
  `).run(layout);
}

const saved = db.prepare("SELECT userValue FROM user_setting WHERE key = 'queryResultsLayout'").get();
console.log('queryResultsLayout =', saved.userValue);
db.close();
