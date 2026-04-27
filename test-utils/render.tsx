import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

function Providers({ children }: { children: ReactNode }) {
    return <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
}

export function renderWithProviders(
    ui: ReactElement,
    options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
    return render(ui, { wrapper: Providers, ...options });
}

export * from "@testing-library/react";
