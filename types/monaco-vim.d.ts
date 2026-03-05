declare module "monaco-vim" {
    export type VimModeController = {
        dispose: () => void;
    };

    export function initVimMode(editor: unknown, statusNode?: HTMLElement | null): VimModeController;
}
