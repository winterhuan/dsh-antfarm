import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
interface Notice {
    readonly seq: number;
    readonly success: boolean;
}
interface NoticeFace {
    readonly hooks: {
        readonly notice: HostObservable<Notice | null>;
    };
    dismiss(): void;
}
/** @returns Scope-owned feedback source and narrow overlay injection. */
export declare function createNotices(): {
    report: (success: boolean) => void;
    face: {
        hooks: {
            notice: import("@deepseek-ai/dsh-client-store").SnapshotStore<Notice | null>;
        };
        dismiss: () => void;
    };
};
/** @param props - Framework-bound notice and locale. @returns Transient banner. */
export declare function OperationNotice({ useNotice, dismiss, t }: PropsRuntime<'shell.overlay'> & PropsLocale<'antfarmRuns'> & InjectFace<NoticeFace>): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=notice.d.ts.map