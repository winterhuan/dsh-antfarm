import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { SessionId } from '@deepseek-ai/dsh-session/types';
import type { AntfarmQueries } from './queries.ts';
import type { AntfarmOperations } from './operations.ts';
interface Actions {
    readonly hooks: {
        readonly refreshInterval: HostObservable<number>;
    };
    /** @param owners - Explicit authorized resources. @returns Bounded query face. */
    queries(owners: readonly SessionId[]): AntfarmQueries;
    readonly operations: AntfarmOperations;
    /** @param child - Native child id. @param parent - Native parent id. */
    openChild(child: string, parent: string): void;
}
/** @param props - Root Session list hook and scoped Host actions. @returns Workflow stage cards and progressive detail. */
export declare function BoardPanel({ useSessions, usePanelInfo, useRefreshInterval, queries, operations, openChild, t }: PropsRuntime<'main'> & PropsLocale<'antfarmRuns'> & InjectFace<Actions>): import("react/jsx-runtime").JSX.Element;
/** @param props - Native sidebar icon size. @returns Existing checklist glyph. */
export declare function BoardIcon({ size }: PropsRuntime<'sidebar.panellist'>): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=BoardPanel.d.ts.map