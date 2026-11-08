/** OS-backed Host exclusion and a rebuildable query projection. */
import { mkdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
/** One local storage root has one Host writer until its OS lock is released. */
export class RunStorage {
    lease;
    index;
    constructor(lease, index) {
        this.lease = lease;
        this.index = index;
    }
    /**
     * Acquire SQLite's process lock; elapsed time never authorizes a takeover.
     * @param root - Local filesystem storage root, shared by all plugin instances.
     * @returns Owner of the root and its disposable derived index.
     */
    static async acquire(root) {
        await mkdir(root, { recursive: true });
        const canonical = await realpath(root);
        for (const name of ['host.sqlite', 'index.sqlite']) {
            try {
                if (await realpath(join(canonical, name)) !== join(canonical, name))
                    throw new Error('antfarm storage file must not be a symbolic link');
            }
            catch (error) {
                if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
                    throw error;
            }
        }
        const lease = new DatabaseSync(join(canonical, 'host.sqlite'));
        let index;
        try {
            lease.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE');
            index = new DatabaseSync(join(canonical, 'index.sqlite'));
            index.exec('CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, updated INTEGER NOT NULL, summary TEXT NOT NULL); CREATE INDEX IF NOT EXISTS runs_owner ON runs(owner, updated DESC)');
            index.exec('CREATE TABLE IF NOT EXISTS health_reports (id INTEGER PRIMARY KEY, time INTEGER NOT NULL, report TEXT NOT NULL)');
            return new RunStorage(lease, index);
        }
        catch (error) {
            index?.close();
            lease.close();
            throw new Error('antfarm storage root is already being held or is unavailable', { cause: error });
        }
    }
    /** Drop derived rows before rebuilding from authoritative Run journals. */
    reset() { this.index.exec('DELETE FROM runs'); }
    /** @param row - Projection of an already committed Run transition. */
    put(row) {
        this.index.prepare('INSERT INTO runs VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner, updated=excluded.updated, summary=excluded.summary').run(row.runId, row.ownerSessionId, row.updatedAt, JSON.stringify(row));
    }
    /** @param owner - Authorized Session. @returns At most fifty recent projections. */
    list(owner) {
        return this.page([owner], 0);
    }
    /** @param owners - Authorized resources. @param offset - Number of newer rows already read. @returns Fifty ordered projections. */
    page(owners, offset) {
        if (owners.length === 0)
            return [];
        if (owners.length > 100 || !Number.isSafeInteger(offset) || offset < 0)
            throw new Error('invalid Run page');
        return this.index.prepare(`SELECT summary FROM runs WHERE owner IN (${owners.map(() => '?').join(',')}) ORDER BY updated DESC, id LIMIT 50 OFFSET ?`).all(...owners, offset).map(row => JSON.parse(String(row['summary'])));
    }
    /** @param owner - Optional owner scope. @returns Bounded unsettled projections for health inspection. */
    unsettled(owner) {
        const sql = "SELECT summary FROM runs WHERE json_extract(summary, '$.status') NOT IN ('completed','cancelled')";
        const rows = owner === undefined ? this.index.prepare(`${sql} ORDER BY updated LIMIT 200`).all() : this.index.prepare(`${sql} AND owner=? ORDER BY updated LIMIT 200`).all(owner);
        return rows.map(row => JSON.parse(String(row['summary'])));
    }
    /** @param owner - Authorized owner. @param query - Id, number, prefix or literal task substring. @returns At most two matches, preserving ambiguity. */
    search(owner, query) {
        const exact = this.index.prepare("SELECT summary FROM runs WHERE owner=? AND (id=? OR CAST(json_extract(summary,'$.number') AS TEXT)=?) LIMIT 2").all(owner, query, query);
        const rows = exact.length > 0 ? exact : this.index.prepare("SELECT summary FROM runs WHERE owner=? AND (substr(id,1,length(?))=? OR instr(lower(COALESCE(json_extract(summary,'$.task'),'')),lower(?))>0) LIMIT 2").all(owner, query, query, query);
        return rows.map(row => JSON.parse(String(row['summary'])));
    }
    /** @param report - Diagnostic facts, independent of business acceptance. */
    recordHealth(report) {
        this.index.prepare('INSERT INTO health_reports(time, report) VALUES (?,?)').run(report.time, JSON.stringify(report));
        this.index.exec('DELETE FROM health_reports WHERE id NOT IN (SELECT id FROM health_reports ORDER BY id DESC LIMIT 500)');
    }
    /** @param owner - Explicit authorized resource. @returns Last twenty relevant checks and rolling issue count. */
    healthHistory(owner) {
        const all = this.index.prepare('SELECT report FROM health_reports ORDER BY id DESC LIMIT 500').all().map(row => JSON.parse(String(row['report'])));
        const owned = new Set(this.index.prepare('SELECT id FROM runs WHERE owner=?').all(owner).map(row => String(row['id'])));
        const relevant = all.map(report => ({ ...report, findings: report.findings.filter(finding => owned.has(finding.runId)) }));
        return { reports: relevant.slice(0, 20), issues24h: relevant.filter(report => report.time >= Date.now() - 86_400_000).reduce((total, report) => total + report.findings.length, 0) };
    }
    /** Release the lock only after all owned drivers and writes have stopped. */
    dispose() { this.index.close(); this.lease.close(); }
}
//# sourceMappingURL=storage.js.map