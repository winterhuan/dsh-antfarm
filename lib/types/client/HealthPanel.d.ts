import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { AntfarmSessionId } from '../types.ts';
import type { AntfarmOperations } from './operations.ts';
/** @param props - Authorized owner, native operations and locale. @returns Health disclosure. */
export declare function HealthPanel({ owner, operations, refresh, t }: PropsLocale<'antfarmRuns'> & {
    readonly owner: AntfarmSessionId;
    readonly operations: AntfarmOperations;
    refresh(): void;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=HealthPanel.d.ts.map