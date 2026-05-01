/**
 * ProjectGraphScanner — multi-root workspace tests.
 *
 * Regression coverage for the bug where the scanner only walked
 * `workspaceFolders[0]`, ignoring every other folder added to a
 * VS Code multi-root workspace. Verifies:
 *
 *  - scanWorkspace indexes files from every workspaceFolders entry
 *  - rescanFiles({ sinceMs }) picks up mtime-bumped files outside folder[0]
 *  - duplicated/nested roots don't cause double-indexing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProjectGraphDB } from '../../projectGraph/projectGraphDb.js';
import { ProjectGraphScanner } from '../../projectGraph/scanner.js';
import { TreeSitterExtractor } from '../../projectGraph/treeSitterExtractor.js';

describe('ProjectGraphScanner — multi-root workspace', () => {
  let folderA: string;
  let folderB: string;
  let folderC: string;
  let db: ProjectGraphDB;
  let scanner: ProjectGraphScanner;

  const setFolders = (paths: string[]): void => {
    (vscode.workspace as unknown as { workspaceFolders: { uri: { fsPath: string } }[] }).workspaceFolders =
      paths.map((p) => ({ uri: { fsPath: p } }));
  };

  beforeEach(async () => {
    folderA = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-multiroot-a-'));
    folderB = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-multiroot-b-'));
    folderC = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-multiroot-c-'));

    setFolders([folderA, folderB, folderC]);

    db = await ProjectGraphDB.create();
    const ts = new TreeSitterExtractor();
    scanner = new ProjectGraphScanner(
      db.getStore(),
      { treeSitter: ts },
      { workspaceFolder: folderA, maxFiles: 1000, includeMarkdown: false },
    );
  });

  afterEach(() => {
    db.close();
    for (const f of [folderA, folderB, folderC]) {
      try { fs.rmSync(f, { recursive: true, force: true }); } catch { /* best-effort */ }
    }
  });

  it('scanWorkspace indexes files from every workspace folder', async () => {
    const fileA = path.join(folderA, 'alpha.ts');
    const fileB = path.join(folderB, 'beta.ts');
    const fileC = path.join(folderC, 'gamma.ts');
    fs.writeFileSync(fileA, 'export function alpha() {}\n');
    fs.writeFileSync(fileB, 'export function beta() {}\n');
    fs.writeFileSync(fileC, 'export function gamma() {}\n');

    const summary = await scanner.scanWorkspace();

    expect(summary.filesProcessed).toBe(3);
    expect(summary.rootsScanned).toEqual([folderA, folderB, folderC].map((p) => path.resolve(p)));
    expect(summary.rootScanned).toBe(path.resolve(folderA));

    const store = db.getStore();
    expect(store.getNodesByFile(fileA).some((n) => n.label === 'alpha')).toBe(true);
    expect(store.getNodesByFile(fileB).some((n) => n.label === 'beta')).toBe(true);
    expect(store.getNodesByFile(fileC).some((n) => n.label === 'gamma')).toBe(true);
  });

  it('rescanFiles sinceMs picks up mtime-bumped files in non-primary folders', async () => {
    const fileA = path.join(folderA, 'a.ts');
    const fileB = path.join(folderB, 'b.ts');
    const fileC = path.join(folderC, 'c.ts');
    fs.writeFileSync(fileA, 'export function a() {}\n');
    fs.writeFileSync(fileB, 'export function b() {}\n');
    fs.writeFileSync(fileC, 'export function c() {}\n');

    await scanner.scanWorkspace();

    const since = Date.now();

    // Bump mtime on a file in folderB and folderC (not folderA).
    fs.writeFileSync(fileB, 'export function bUpdated() {}\n');
    fs.writeFileSync(fileC, 'export function cUpdated() {}\n');
    const future = new Date(since + 2000);
    fs.utimesSync(fileB, future, future);
    fs.utimesSync(fileC, future, future);

    const summary = await scanner.rescanFiles([], { sinceMs: since });

    expect(summary.filesProcessed).toBeGreaterThanOrEqual(2);

    const store = db.getStore();
    expect(store.getNodesByFile(fileB).some((n) => n.label === 'bUpdated')).toBe(true);
    expect(store.getNodesByFile(fileC).some((n) => n.label === 'cUpdated')).toBe(true);
    // folderA file was untouched.
    expect(store.getNodesByFile(fileA).some((n) => n.label === 'a')).toBe(true);
  });

  it('duplicated workspace folders do not double-index files', async () => {
    setFolders([folderA, folderA, folderB]);

    const fileA = path.join(folderA, 'dup.ts');
    const fileB = path.join(folderB, 'b.ts');
    fs.writeFileSync(fileA, 'export function dup() {}\n');
    fs.writeFileSync(fileB, 'export function b() {}\n');

    const summary = await scanner.scanWorkspace();

    expect(summary.filesProcessed).toBe(2);
    expect(summary.rootsScanned).toEqual([folderA, folderB].map((p) => path.resolve(p)));
  });

  it('nested workspace folders do not double-index files', async () => {
    const nested = path.join(folderA, 'nested');
    fs.mkdirSync(nested);
    setFolders([folderA, nested]);

    const fileNested = path.join(nested, 'inside.ts');
    fs.writeFileSync(fileNested, 'export function inside() {}\n');

    const summary = await scanner.scanWorkspace();

    // walkDir visits folderA recursively which already includes `nested`,
    // and the per-file dedupe Set prevents the second root from re-adding it.
    expect(summary.filesProcessed).toBe(1);
    const store = db.getStore();
    expect(store.getNodesByFile(fileNested).some((n) => n.label === 'inside')).toBe(true);
  });

  it('returns no-workspace error when workspaceFolders is empty', async () => {
    setFolders([]);
    const summary = await scanner.scanWorkspace();
    expect(summary.workspaceFoldersAvailable).toBe(false);
    expect(summary.rootsScanned).toEqual([]);
    expect(summary.firstError).toMatch(/no workspace folder open/i);
  });
});
