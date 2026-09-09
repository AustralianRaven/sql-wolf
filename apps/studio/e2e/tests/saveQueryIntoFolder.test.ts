import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/** TEST_MODE points userDirectory at ./tmp, so the app db is isolated. */
const APP_DB = path.resolve('tmp/app.db');

// Both tests drive the same on-disk app db, so they cannot overlap.
test.describe.configure({ mode: 'serial' });

test.beforeEach(() => {
  fs.rmSync(path.resolve('tmp'), { recursive: true, force: true });
});

async function launch(): Promise<{ app: ElectronApplication; win: Page }> {
  const app = await electron.launch({
    args: ['dist/main.js'],
    env: { ...process.env, TEST_MODE: '1' },
  });
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1600, height: 1000 });
  await win.waitForTimeout(1500);
  try {
    await win.getByText("Don't show again", { exact: false }).click({ timeout: 800 });
  } catch (e) { /* no dialog */ }
  return { app, win };
}

async function connectSqlite(win: Page, dbFile: string) {
  await win.getByLabel('Connection Type').selectOption('sqlite');
  await win.locator('#Database').fill(dbFile);
  await win.getByRole('button', { name: 'Connect' }).click();
  // `.tab-pane` also matches the sidebar panes, so anchor on the tab ids.
  const editor = win.locator('#tab-0').getByRole('textbox');
  await expect(editor, 'the query editor is visible after connecting').toBeVisible({ timeout: 30000 });
  return editor;
}

/** Saves the active editor as a new query, picking a folder when one is named. */
async function saveNewQuery(win: Page, title: string, folderName?: string) {
  await win.keyboard.press('Control+s');
  const titleInput = win.locator('input[name="title"]');
  await expect(titleInput, `the save modal is open for ${title}`).toBeVisible({ timeout: 10000 });
  await titleInput.fill(title);

  if (folderName) {
    const picker = win.locator('.v--modal-box .folder-path-input');
    await expect(picker, 'the folder picker renders in the save modal').toBeVisible({ timeout: 5000 });
    await expect(picker, 'the folder picker is enabled').toBeEnabled();
    await picker.click();

    const slideover = win.locator('.folder-slideover');
    await expect(slideover, 'the folder slideover opens').toBeVisible({ timeout: 5000 });
    await slideover.getByText(folderName, { exact: true }).click();
    await slideover.getByRole('button', { name: 'Select' }).click();
    await expect(picker, `the picker shows ${folderName}`).toHaveValue(folderName, { timeout: 5000 });
  }

  await win.locator('.v--modal-box form button[type="submit"].btn-primary').first().click();
  await win.waitForTimeout(2500);
}

function readQueries() {
  const db = new DatabaseSync(APP_DB, { readOnly: true });
  const folders = db.prepare('select id, name from query_folder').all();
  const queries = db.prepare('select id, title, queryFolderId from favorite_query').all();
  db.close();
  return { folders, queries };
}

function seedFolders(names: string[]) {
  const db = new DatabaseSync(APP_DB);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 23);
  for (const name of names) {
    db.prepare(
      'insert into query_folder (name, description, expanded, parentId, createdAt, updatedAt, version) ' +
      "values (?, null, 1, null, ?, ?, '0.0.0')"
    ).run(name, now, now);
  }
  db.close();
}

test('Given a query already saved at the root, When Move to Folder is used from the editor, Then the query is filed in that folder', async () => {
  const dbFile = path.join(os.tmpdir(), `bks-refile-${Date.now()}.db`);

  // --- Given: a query saved at the root, and a folder that appeared afterwards
  let { app, win } = await launch();
  let editor = await connectSqlite(win, dbFile);
  await editor.click();
  await editor.fill('select 1 as needs_a_home;');
  await saveNewQuery(win, 'HomelessQuery');
  await app.close();

  expect(readQueries().queries, 'the query starts at the root').toEqual([
    { id: 1, title: 'HomelessQuery', queryFolderId: null },
  ]);

  seedFolders(['Generic']);

  ({ app, win } = await launch());
  const recent = win.locator('.recent-connection-list').getByText(path.basename(dbFile), { exact: false }).first();
  await expect(recent, 'the recent connection is listed').toBeVisible({ timeout: 15000 });
  await recent.dblclick();

  editor = win.locator('#tab-0').getByRole('textbox');
  await expect(editor, 'the saved query tab is restored').toBeVisible({ timeout: 30000 });

  // --- When: the editor context menu files it
  await editor.click({ button: 'right' });
  const moveItem = win.getByText('Move to Folder', { exact: false }).first();
  await expect(moveItem, 'the editor context menu offers Move to Folder').toBeVisible({ timeout: 10000 });
  await moveItem.click();

  const moveModal = win.locator('.v--modal-box');
  await expect(moveModal.getByText('Generic', { exact: true }), 'the move dialog lists the folder')
    .toBeVisible({ timeout: 10000 });
  await moveModal.getByText('Generic', { exact: true }).click();
  await moveModal.getByRole('button', { name: 'Move' }).click();
  await win.waitForTimeout(2500);
  await app.close();

  // --- Then: the query moved into the folder
  const state = readQueries();
  const generic: any = state.folders.find((f: any) => f.name === 'Generic');
  const saved: any = state.queries.find((q: any) => q.title === 'HomelessQuery');
  expect(saved.queryFolderId, 'the moved query is filed under Generic').toBe(generic.id);
});

test('Given folders that predate the session, When a new query is saved into one, Then the query is stored in that folder', async () => {
  const dbFile = path.join(os.tmpdir(), `bks-folder-${Date.now()}.db`);

  // ---------- Session 1: create the appdb schema and one root query ----------
  let { app, win } = await launch();
  let editor = await connectSqlite(win, dbFile);
  await editor.click();
  await editor.fill('select 1 as root_query;');
  await saveNewQuery(win, 'RootQuery');
  await app.close();

  let state = readQueries();
  expect(state.queries, 'the first query saved at the root').toEqual([
    { id: 1, title: 'RootQuery', queryFolderId: null },
  ]);

  // ---------- Folders now exist in the appdb, created outside this session ----------
  seedFolders(['Worflow Lookups', 'Generic']);
  expect(readQueries().folders.map((f: any) => f.name), 'both folders are seeded')
    .toEqual(['Worflow Lookups', 'Generic']);

  // ---------- Session 2: save a brand new query into the "Generic" folder ----------
  ({ app, win } = await launch());

  const recent = win.locator('.recent-connection-list').getByText(path.basename(dbFile), { exact: false }).first();
  await expect(recent, 'the recent connection is listed').toBeVisible({ timeout: 15000 });
  await recent.dblclick();

  await expect(win.locator('#tab-0').getByRole('textbox'), 'the saved tab is restored in the second session')
    .toBeVisible({ timeout: 30000 });

  // A brand new tab: Ctrl+S only opens the save modal for a query with no id.
  await win.keyboard.press('Control+t');
  editor = win.locator('#tab-1').getByRole('textbox');
  await expect(editor, 'the new tab editor is visible').toBeVisible({ timeout: 15000 });
  await editor.click();
  await editor.fill('select 2 as foldered_query;');

  await saveNewQuery(win, 'FolderedQuery', 'Generic');

  // ---------- Then: the new query belongs to "Generic", not the root ----------
  state = readQueries();
  const generic: any = state.folders.find((f: any) => f.name === 'Generic');
  let saved: any = state.queries.find((q: any) => q.title === 'FolderedQuery');
  expect(saved, 'the new query was persisted').toBeTruthy();
  expect(saved.queryFolderId, 'the new query is filed under the Generic folder').toBe(generic.id);

  // ---------- And: a later quick save keeps it there ----------
  await editor.click();
  await editor.fill('select 3 as edited_in_place;');
  await win.keyboard.press('Control+s');
  await win.waitForTimeout(2500);
  await app.close();

  saved = readQueries().queries.find((q: any) => q.title === 'FolderedQuery');
  expect(saved.queryFolderId, 'a quick save does not drop the query back to the root').toBe(generic.id);
});
