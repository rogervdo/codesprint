import TypingSession from "@/components/TypingSession";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Box } from "@chakra-ui/react";

export default function HomePage() {
    return (
        <Box w="100%">
            <ErrorBoundary>
                <TypingSession />
            </ErrorBoundary>
        </Box>
    );
}
