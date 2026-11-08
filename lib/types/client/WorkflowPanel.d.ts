import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { AntfarmSessionId } from '../types.ts';
import type { AntfarmOperations } from './operations.ts';
interface Props extends PropsLocale<'antfarmRuns'> {
    readonly owner: AntfarmSessionId;
    readonly visible: boolean;
    readonly operations: AntfarmOperations;
    launched(runId: string): void;
}
/** @param props - Session-scoped operations and localized copy. @returns Launch and configuration forms. */
export declare function WorkflowPanel({ owner, visible, operations, launched, t }: Props): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=WorkflowPanel.d.ts.map