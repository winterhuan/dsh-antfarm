import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { AntfarmSessionId, AntfarmStatus } from '../types.ts';
import type { AntfarmOperations } from './operations.ts';
/** @param props - Durable state, revision-bound operations and localized copy. @returns Valid lifecycle actions. */
export declare function RunControls({ owner, detail, operations, refresh, t }: PropsLocale<'antfarmRuns'> & {
    readonly owner: AntfarmSessionId;
    readonly detail: AntfarmStatus;
    readonly operations: AntfarmOperations;
    refresh(): void;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=RunControls.d.ts.map