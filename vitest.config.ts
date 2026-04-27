import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        exclude: [
            "**/node_modules/**",
            "**/.claude/**",
            "**/.next/**",
            "**/e2e/**",
            "**/coverage/**",
            "**/playwright-report/**",
            "**/test-results/**",
        ],
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "./"),
        },
    },
});
