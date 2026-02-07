"use client";

import { useCallback, useEffect, useRef } from "react";

export type Phase = "idle" | "countdown" | "running" | "finished";

export interface UseFocusManagementReturn {
    /** Ref to store the editor's focus function */
    focusEditorRef: React.MutableRefObject<(() => void) | null>;
    /** Ref to track if editor focus is allowed */
    allowEditorFocusRef: React.MutableRefObject<boolean>;
    /** Enable editor focus (call before focusing) */
    enableEditorFocus: () => void;
    /** Focus the editor if allowed */
    focusEditor: () => void;
    /** Callback to pass to CodePanel's onReady */
    handleEditorReady: (focus: () => void) => void;
}

/**
 * Hook to manage editor focus state and callbacks
 * Extracted from TypingSession.tsx focus management logic
 */
export function useFocusManagement(): UseFocusManagementReturn {
    const focusEditorRef = useRef<(() => void) | null>(null);
    const allowEditorFocusRef = useRef(false);

    const handleEditorReady = useCallback((focus: () => void) => {
        focusEditorRef.current = focus;
        if (allowEditorFocusRef.current) {
            focus();
        }
    }, []);

    const enableEditorFocus = useCallback(() => {
        allowEditorFocusRef.current = true;
    }, []);

    const focusEditor = useCallback(() => {
        focusEditorRef.current?.();
    }, []);

    return {
        focusEditorRef,
        allowEditorFocusRef,
        enableEditorFocus,
        focusEditor,
        handleEditorReady,
    };
}

/**
 * Hook to manage the cs-focus-active body class based on phase
 * Extracted from TypingSession.tsx body class management
 */
export function useFocusActiveClass(phase: Phase): void {
    useEffect(() => {
        if (typeof document === "undefined") return;
        const body = document.body;
        if (!body) return;

        if (phase === "running") {
            body.classList.add("cs-focus-active");
        } else {
            body.classList.remove("cs-focus-active");
        }

        return () => {
            body.classList.remove("cs-focus-active");
        };
    }, [phase]);
}
