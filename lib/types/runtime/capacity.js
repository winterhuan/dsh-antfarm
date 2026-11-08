/** FIFO within owners, with round-robin selection between eligible owners. */
export class RunCapacity {
    hostLimit;
    ownerLimit;
    waiting = [];
    active = new Map();
    lastOwner;
    /** @param hostLimit - Total writers. @param ownerLimit - Writers per owner. */
    constructor(hostLimit, ownerLimit) {
        this.hostLimit = hostLimit;
        this.ownerLimit = ownerLimit;
    }
    /**
     * Wait for a slot; abort removes only this request without consuming capacity.
     * @param owner - Original owning Session.
     * @param signal - Lifetime of this execution request.
     * @returns Idempotent release, called after driver teardown.
     */
    acquire(owner, signal) {
        signal.throwIfAborted();
        return new Promise((grant, reject) => {
            const row = { owner, signal, grant, reject, abort: () => {
                    const index = this.waiting.indexOf(row);
                    if (index >= 0)
                        this.waiting.splice(index, 1);
                    signal.removeEventListener('abort', row.abort);
                    reject(signal.reason);
                    this.drain();
                } };
            this.waiting.push(row);
            signal.addEventListener('abort', row.abort, { once: true });
            this.drain();
        });
    }
    drain() {
        while ([...this.active.values()].reduce((sum, count) => sum + count, 0) < this.hostLimit) {
            const eligible = this.waiting.filter(row => (this.active.get(row.owner) ?? 0) < this.ownerLimit);
            const row = eligible.find(candidate => candidate.owner !== this.lastOwner) ?? eligible[0];
            if (row === undefined)
                return;
            this.waiting.splice(this.waiting.indexOf(row), 1);
            row.signal.removeEventListener('abort', row.abort);
            this.active.set(row.owner, (this.active.get(row.owner) ?? 0) + 1);
            this.lastOwner = row.owner;
            let released = false;
            row.grant(() => {
                if (released)
                    return;
                released = true;
                const count = (this.active.get(row.owner) ?? 1) - 1;
                if (count === 0)
                    this.active.delete(row.owner);
                else
                    this.active.set(row.owner, count);
                this.drain();
            });
        }
    }
}
//# sourceMappingURL=capacity.js.map