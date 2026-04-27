"use client";

import {
    DialogBackdrop,
    DialogBody,
    DialogCloseTrigger,
    DialogContent,
    DialogHeader,
    DialogPositioner,
    DialogRoot,
    DialogTitle,
    Portal,
} from "@chakra-ui/react";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";

type AnalyticsModalProps = {
    isOpen: boolean;
    onOpenChange: (details: { open: boolean }) => void;
};

export default function AnalyticsModal({ isOpen, onOpenChange }: AnalyticsModalProps) {
    return (
        <DialogRoot
            open={isOpen}
            onOpenChange={onOpenChange}
            size="xl"
            placement="center"
            scrollBehavior="inside"
        >
            <Portal>
                <DialogBackdrop backdropFilter="blur(6px)" />
                <DialogPositioner>
                    <DialogContent
                        bg="var(--panel-soft)"
                        backdropFilter="blur(12px)"
                        border="1px solid var(--border)"
                    >
                        <DialogCloseTrigger />
                        <DialogHeader borderBottom="1px solid var(--border)">
                            <DialogTitle fontSize="xl" fontWeight="bold" color="var(--accent)">Analytics</DialogTitle>
                        </DialogHeader>
                        <DialogBody py={4}>
                            <AnalyticsDashboard />
                        </DialogBody>
                    </DialogContent>
                </DialogPositioner>
            </Portal>
        </DialogRoot>
    );
}
