/** Run controls, accepted evidence and native child-session navigation. */
import { type ReactNode } from 'react';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { AntfarmSessionId } from '../types.ts';
import type { AntfarmViewState } from './queries.ts';
import type { AntfarmOperations } from './operations.ts';
interface Props extends PropsLocale<'antfarmRuns'> {
    readonly state: AntfarmViewState;
    readonly workspace: string | undefined;
    readonly owner?: AntfarmSessionId;
    readonly visible?: boolean;
    readonly operations?: AntfarmOperations;
    readonly showLaunch?: boolean;
    /** @param childSessionId - durable child id belonging to the selected run. */
    readonly openChild: (childSessionId: string) => void;
}
/**
 * Render the Session's run list and its selected durable details.
 * @param props - run queries, selected Session workspace, localized copy and child navigation.
 * @returns retained run content with retryable query notices.
 */
export declare function RunsPanel({ state, workspace, openChild, owner, visible, operations, showLaunch, t }: Props): ReactNode;
export {};
//# sourceMappingURL=RunsPanel.d.ts.map