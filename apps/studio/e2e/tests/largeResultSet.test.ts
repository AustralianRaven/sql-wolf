import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchElectron } from 'e2e/helpers/launchElectron';
import { NewDatabaseConnection } from '../pageComponents/NewDatabaseConnection';
import { QueryTab } from '../pageComponents/QueryTab';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Regression guard for issue #17 — "queries that output 500+ rows break the app".
 *
 * Tabulator only virtualises when it is given a definite height. The stacked
 * results layout sizes each block by its content, so the table's "100%" used to
 * resolve to auto and every row went into the DOM. Five thousand rows took ~30s
 * to render and left the window unusable.
 *
 * The test connects to a SQLite file it builds itself and counts the rows
 * Tabulator actually committed to the DOM. A virtualised table renders a
 * screenful whatever the row count.
 *
 * The layout under test comes from RESULTS_LAYOUT and must already be saved in
 * the app database, because there is no settings control reachable from this
 * screen. To exercise the stacked path:
 *
 *   node scripts/seedResultsLayout.js apps/studio/tmp/app.db stacked
 *   RESULTS_LAYOUT=stacked TEST_MODE=1 yarn playwright test e2e/tests/largeResultSet.test.ts
 */

const LAYOUT = process.env.RESULTS_LAYOUT ?? 'tabs';
const ROW_COUNT = 5000;
/** Generous enough to cover any screen; far below an unvirtualised render. */
const VIRTUALISED_CEILING = 200;

const dbPath = path.join(os.tmpdir(), `bks-large-result-${LAYOUT}.db`);

let electronApp: ElectronApplication;
let window: Page;
let connection: NewDatabaseConnection;
let queryTab: QueryTab;

async function connectToSqlite() {
  await connection.newConnectionDropdown.selectOption('sqlite');
  await window.locator('#Database').fill(dbPath);
  await connection.connectButton.click();
  await expect(queryTab.queryTabTextArea).toBeVisible({ timeout: 30000 });
}

async function runQuery(sql: string) {
  await queryTab.queryTabTextArea.fill(sql);
  await (await queryTab.tabRunQueryButton()).click();
}

test.describe('Large result sets', () => {
  test.beforeAll(() => {
    // A fresh file each run, so the fixture never drifts.
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(dbPath + suffix, { force: true });
    }
  });

  test.beforeEach(async () => {
    electronApp = await launchElectron();
    window = await electronApp.firstWindow();
    connection = new NewDatabaseConnection(window);
    queryTab = new QueryTab(window);
  });

  test.afterEach(async () => {
    if (electronApp) await electronApp.close();
  });

  test(`Given ${ROW_COUNT} rows in the ${LAYOUT} layout, Tabulator renders only a screenful`, async () => {
    await connectToSqlite();

    // Build the fixture through the app itself, so the test needs no native
    // sqlite binding of its own.
    await runQuery(`
      DROP TABLE IF EXISTS big;
      CREATE TABLE big AS
      WITH RECURSIVE counter(x) AS (
        SELECT 1 UNION ALL SELECT x + 1 FROM counter WHERE x < ${ROW_COUNT}
      )
      SELECT
        x AS id,
        'Subject ' || x AS name,
        'subject' || x || '@aperture.test' AS email,
        'Row note number ' || x || ' for testing large result sets' AS note,
        x * 1.5 AS amount
      FROM counter;
    `);
    await window.waitForTimeout(3000);

    await runQuery('SELECT * FROM big;');
    await expect(window.locator('.tabulator-row').first()).toBeVisible({ timeout: 60000 });
    // Let Tabulator settle its render pass before counting.
    await window.waitForTimeout(3000);

    const renderedRows = await window.locator('.tabulator-row').count();
    if (process.env.RESULTS_SCREENSHOT) {
      await window.screenshot({ path: process.env.RESULTS_SCREENSHOT });
    }

    expect(
      renderedRows,
      `${LAYOUT} layout put ${renderedRows} of ${ROW_COUNT} rows in the DOM — ` +
      `Tabulator is not virtualising, so it has no definite height`
    ).toBeLessThan(VIRTUALISED_CEILING);

    expect(renderedRows, 'the table should still render something').toBeGreaterThan(0);
  });
});
