import { mkdir, open, readFile, rename, copyFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateCompany } from './schema.js';

export class RegistryError extends Error {
  constructor(code, message, status = 400, details) { super(message); Object.assign(this, { code, status, details }); }
}
export async function readJson(path) { return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')); }
export function snapshotState(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== '1.0' || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 1 ||
      !Array.isArray(snapshot.records) || snapshot.records.some(r => !r || validateCompany(r.company).length || !Number.isSafeInteger(r.version) || r.version < 1 || r.verification !== 'source_recorded') ||
      new Set(snapshot.records.map(r => r.company.id)).size !== snapshot.records.length) {
    throw new RegistryError('INVALID_SNAPSHOT', '公开快照格式不合法。', 422);
  }
  return { schemaVersion: '1.0', revision: snapshot.revision, proposals: {}, companies: Object.fromEntries(snapshot.records.map(record => [record.company.id, {
    ...record, history: [{ version: record.version, at: record.updatedAt, company: record.company }],
  }])) };
}
export function createSnapshotStore(path) {
  return { load: async () => snapshotState(await readJson(path)), update: async () => { throw new RegistryError('READ_ONLY', '公开快照只能读取。', 403); } };
}
export async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(temp, 'wx', 0o600);
    try { await file.writeFile(`${JSON.stringify(value, null, 2)}\n`); await file.sync(); } finally { await file.close(); }
    try { await copyFile(path, `${path}.bak`); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    await rename(temp, path);
  } finally { await unlink(temp).catch((e) => { if (e.code !== 'ENOENT') throw e; }); }
}
export async function withLock(path, work) {
  await mkdir(dirname(path), { recursive: true });
  const lockPath = `${path}.lock`;
  let lock;
  const deadline = Date.now() + 5000;
  while (!lock) {
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (Date.now() >= deadline) throw new RegistryError('STORE_BUSY', '存储正在写入；稍后重试。进程异常退出后的锁需维护者检查。', 503);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  try { await lock.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })); return await work(); }
  finally { await lock.close(); await unlink(lockPath); }
}
export function createStore(directory) {
  const path = join(directory, 'state.json');
  const load = async () => {
    try { return await readJson(path); }
    catch (e) { if (e.code === 'ENOENT') throw new RegistryError('NOT_INITIALIZED', '先执行 init 初始化目录。', 503); throw e; }
  };
  return {
    path, load,
    async init(seed, snapshot) {
      return withLock(path, async () => {
        try { await readJson(path); return { initialized: false }; } catch (e) { if (e.code !== 'ENOENT') throw e; }
        const now = new Date().toISOString();
        let companies = Object.fromEntries(seed.companies.map((company) => [company.id, {
          company, version: 1, publishedAt: now, updatedAt: now,
          verification: 'source_recorded', history: [{ version: 1, at: now, company }],
        }]));
        if (snapshot) companies = snapshotState(snapshot).companies;
        await atomicJson(path, { schemaVersion: '1.0', revision: snapshot?.revision ?? 1, companies, proposals: {}, createdAt: now });
        return { initialized: true, count: Object.keys(companies).length };
      });
    },
    async update(work) {
      return withLock(path, async () => {
        const state = await load();
        const before = JSON.stringify(state);
        const result = await work(state);
        if (before !== JSON.stringify(state)) { state.revision += 1; await atomicJson(path, state); }
        return result;
      });
    },
  };
}
