import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchElectron } from 'e2e/helpers/launchElectron';
import { NewDatabaseConnection } from '../pageComponents/NewDatabaseConnection';
import { QueryTab } from '../pageComponents/QueryTab';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

/**
 * "Open as HTML" on a result cell opens an html-preview tab: raw source on the
 * left, the rendered page on the right in a sandboxed iframe.
 *
 * Runs against a throwaway SQLite file, so no database server is needed:
 *   TEST_MODE=1 yarn playwright test e2e/tests/htmlPreview.test.ts
 */

const dbPath = path.join(os.tmpdir(), 'bks-html-preview.db');

// The script tag proves the sandbox: if scripts ran, #script-ran would exist.
const HTML = '<h1 id="greeting">Hello Kat</h1><p>Notification body</p>' +
  '<script>document.body.insertAdjacentHTML("beforeend", "<i id=script-ran>ran</i>")</script>';

let electronApp: ElectronApplication;
let win: Page;
let connection: NewDatabaseConnection;
let queryTab: QueryTab;

/** Result columns are keyed by generated ids, so find the cell by its content. */
function resultCell(column: 'HtmlContent' | 'Answer') {
  const cells = win.locator('.tabulator-row .tabulator-cell');
  return column === 'Answer'
    ? cells.filter({ hasText: /^42$/ }).first()
    : cells.filter({ hasText: 'Hello Kat' }).first();
}

test.describe('Open as HTML', () => {
  test.beforeAll(() => {
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(dbPath + suffix, { force: true });
    }
  });

  test.beforeEach(async () => {
    electronApp = await launchElectron();
    win = await electronApp.firstWindow();
    connection = new NewDatabaseConnection(win);
    queryTab = new QueryTab(win);

    await connection.newConnectionDropdown.selectOption('sqlite');
    await win.locator('#Database').fill(dbPath);
    await connection.connectButton.click();
    await expect(queryTab.queryTabTextArea, 'Then the query editor is visible after connecting')
      .toBeVisible({ timeout: 30000 });

    const sql = `SELECT '${HTML.replace(/'/g, "''")}' AS HtmlContent, 42 AS Answer;`;
    await queryTab.queryTabTextArea.fill(sql);
    await (await queryTab.tabRunQueryButton()).click();
    await expect(win.locator('.tabulator-row').first(), 'Then the result row is rendered')
      .toBeVisible({ timeout: 30000 });
  });

  test.afterEach(async () => {
    if (electronApp) await electronApp.close();
  });

  for (const { column, disabled } of [
    { column: 'Answer' as const, disabled: true },
    { column: 'HtmlContent' as const, disabled: false },
  ]) {
  test(`Given a ${column} cell, the "Open as HTML" item is ${disabled ? 'disabled' : 'enabled'}`, async () => {
    const cell = resultCell(column);
    await expect(cell, `Given the ${column} cell is visible`).toBeVisible();

    await cell.click({ button: 'right' });
    const item = win.getByRole('menuitem', { name: 'Open as HTML' });
    await expect(item, 'Then the context menu offers "Open as HTML"').toBeVisible();

    const parent = item.locator('xpath=ancestor-or-self::*[contains(@class,"tabulator-menu-item")][1]');
    if (disabled) {
      await expect(parent, `Then the item is disabled for ${column}`).toHaveClass(/tabulator-menu-item-disabled/);
    } else {
      await expect(parent, `Then the item is enabled for ${column}`).not.toHaveClass(/tabulator-menu-item-disabled/);
    }
  });
  }

  test('When the user opens an HTML cell, then a split tab shows the source and the rendered page', async () => {
    const cell = resultCell('HtmlContent');
    await cell.click({ button: 'right' });
    await win.getByRole('menuitem', { name: 'Open as HTML' }).click();

    const pane = win.locator('.tab-pane.active .html-preview');
    await expect(pane, 'Then the html-preview tab is active').toBeVisible({ timeout: 10000 });
    await expect(win.locator('.tab-pane.active .html-preview-toolbar .title'), 'Then the tab is titled after the column')
      .toHaveText('HTML: HtmlContent');

    await expect(pane.locator('.html-preview-source'), 'Then the left pane shows the raw HTML')
      .toContainText('<h1 id="greeting">Hello Kat</h1>');

    const frame = pane.frameLocator('.html-preview-render iframe');
    await expect(frame.locator('#greeting'), 'Then the right pane renders the HTML').toHaveText('Hello Kat');
    await expect(frame.locator('#script-ran'), 'Then scripts in the HTML do not run').toHaveCount(0);
  });
});
