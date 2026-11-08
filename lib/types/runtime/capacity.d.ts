/** FIFO within owners, with round-robin selection between eligible owners. */
export declare class RunCapacity {
    private readonly hostLimit;
    private readonly ownerLimit;
    private readonly waiting;
    private readonly active;
    private lastOwner;
    /** @param hostLimit - Total writers. @param ownerLimit - Writers per owner. */
    constructor(hostLimit: number, ownerLimit: number);
    /**
     * Wait for a slot; abort removes only this request without consuming capacity.
     * @param owner - Original owning Session.
     * @param signal - Lifetime of this execution request.
     * @returns Idempotent release, called after driver teardown.
     */
    acquire(owner: string, signal: AbortSignal): Promise<() => void>;
    private drain;
}
//# sourceMappingURL=capacity.d.ts.map