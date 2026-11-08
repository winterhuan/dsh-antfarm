import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { WorkflowDraft } from '../workflow/types.ts';
interface Props extends PropsLocale<'antfarmRuns'> {
    readonly draft: WorkflowDraft;
    readonly pending: boolean;
    change(draft: WorkflowDraft): void;
}
/** @param props - Current source draft and a gesture-owned update. @returns Team overview and common Agent settings. */
export declare function TeamPanel({ draft, pending, change, t }: Props): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=TeamPanel.d.ts.map