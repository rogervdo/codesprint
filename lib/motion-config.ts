import type { MotionProps } from "framer-motion";
import { FADE_IN_UP, MOTION_DURATION, MOTION_EASE, POP_IN, SPRING_SMOOTH } from "@/lib/motion";

/**
 * Session-specific motion configurations extracted from TypingSession.tsx
 * These build on the base motion presets in lib/motion.ts
 */

export function getControlsMotion(prefersReducedMotion: boolean): MotionProps {
    if (prefersReducedMotion) return {};
    return {
        variants: FADE_IN_UP,
        initial: "hidden",
        animate: "visible",
        transition: { ...SPRING_SMOOTH, stiffness: 280, damping: 30 },
    };
}

export function getStartButtonMotion(prefersReducedMotion: boolean): MotionProps {
    if (prefersReducedMotion) return {};
    return {
        initial: { opacity: 0, scale: 0.92 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.88 },
        whileHover: { scale: 1.03 },
        whileTap: { scale: 0.97 },
        transition: { duration: MOTION_DURATION.quick, ease: MOTION_EASE.out },
    };
}

export function getResultCardMotion(prefersReducedMotion: boolean): MotionProps {
    if (prefersReducedMotion) return {};
    return {
        variants: POP_IN,
        initial: "hidden",
        animate: "visible",
        exit: "exit",
        transition: { ...SPRING_SMOOTH, stiffness: 260, damping: 28 },
    };
}

export function getPanelMotion(prefersReducedMotion: boolean): MotionProps {
    if (prefersReducedMotion) return {};
    return {
        variants: POP_IN,
        initial: "hidden",
        animate: "visible",
        transition: { ...SPRING_SMOOTH, stiffness: 220, damping: 24 },
    };
}

export function getCountdownOverlayMotion(prefersReducedMotion: boolean): MotionProps {
    if (prefersReducedMotion) return {};
    return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: MOTION_DURATION.quick, ease: MOTION_EASE.inOut },
    };
}

export function getCountdownNumberMotion(prefersReducedMotion: boolean): MotionProps {
    if (prefersReducedMotion) return {};
    return {
        initial: { opacity: 0, scale: 0.6 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.85 },
        transition: { duration: MOTION_DURATION.quick, ease: MOTION_EASE.out },
    };
}
