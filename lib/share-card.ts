/**
 * Canvas-based shareable result card generator.
 *
 * Renders a PNG image with the user's session results using theme colors.
 * Designed for sharing on social media, Discord, etc.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShareCardData = {
    wpm: number;
    accuracy: number;
    patternScore?: number;
    snippetTitle: string;
    language: string;
    difficulty: string;
    timeMs: number;
    /** WPM history for sparkline */
    history: { time: number; wpm: number }[];
};

type ThemeColors = {
    bg: string;
    text: string;
    textSubtle: string;
    accent: string;
    surface: string;
    border: string;
};

// ---------------------------------------------------------------------------
// Theme color extraction
// ---------------------------------------------------------------------------

function getThemeColors(): ThemeColors {
    if (typeof window === "undefined") {
        return {
            bg: "#0f0f0f",
            text: "#e0e0e0",
            textSubtle: "#888888",
            accent: "#f5c542",
            surface: "#1a1a1a",
            border: "#333333",
        };
    }

    const styles = getComputedStyle(document.documentElement);
    return {
        bg: styles.getPropertyValue("--bg").trim() || "#0f0f0f",
        text: styles.getPropertyValue("--text").trim() || "#e0e0e0",
        textSubtle: styles.getPropertyValue("--text-subtle").trim() || "#888888",
        accent: styles.getPropertyValue("--accent").trim() || "#f5c542",
        surface: styles.getPropertyValue("--surface").trim() || "#1a1a1a",
        border: styles.getPropertyValue("--border").trim() || "#333333",
    };
}

// ---------------------------------------------------------------------------
// Canvas rendering
// ---------------------------------------------------------------------------

const CARD_WIDTH = 600;
const CARD_HEIGHT = 400;
const PADDING = 32;

export async function renderShareCard(data: ShareCardData): Promise<HTMLCanvasElement> {
    const canvas = document.createElement("canvas");
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext("2d")!;
    const colors = getThemeColors();

    // Background
    ctx.fillStyle = colors.bg;
    roundRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, 16);
    ctx.fill();

    // Border
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    roundRect(ctx, 0.5, 0.5, CARD_WIDTH - 1, CARD_HEIGHT - 1, 16);
    ctx.stroke();

    // Title: "CodeSprint"
    ctx.fillStyle = colors.accent;
    ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
    ctx.fillText("CodeSprint", PADDING, PADDING + 20);

    // Problem title + meta
    ctx.fillStyle = colors.textSubtle;
    ctx.font = "14px system-ui, -apple-system, sans-serif";
    const meta = `${data.snippetTitle}  ·  ${data.language.toUpperCase()}  ·  ${capitalize(data.difficulty)}`;
    ctx.fillText(meta, PADDING, PADDING + 44);

    // Divider
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING, PADDING + 60);
    ctx.lineTo(CARD_WIDTH - PADDING, PADDING + 60);
    ctx.stroke();

    // Stats row
    const statsY = PADDING + 110;
    drawStat(ctx, colors, PADDING + 60, statsY, `${Math.round(data.wpm)}`, "WPM", true);
    drawStat(ctx, colors, PADDING + 200, statsY, `${Math.round(data.accuracy * 100)}%`, "Accuracy", false);

    if (data.patternScore !== undefined) {
        drawStat(ctx, colors, PADDING + 340, statsY, `${data.patternScore}`, "Pattern", false);
    } else {
        drawStat(ctx, colors, PADDING + 340, statsY, formatDuration(data.timeMs), "Time", false);
    }

    // Sparkline
    if (data.history.length > 1) {
        drawSparkline(ctx, colors, PADDING, statsY + 60, CARD_WIDTH - PADDING * 2, 100, data.history);
    }

    // Footer
    ctx.fillStyle = colors.textSubtle;
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillText("codesprint.dev", PADDING, CARD_HEIGHT - PADDING + 4);

    return canvas;
}

function drawStat(
    ctx: CanvasRenderingContext2D,
    colors: ThemeColors,
    x: number,
    y: number,
    value: string,
    label: string,
    isAccent: boolean,
) {
    ctx.textAlign = "center";
    ctx.fillStyle = isAccent ? colors.accent : colors.text;
    ctx.font = "bold 36px system-ui, -apple-system, sans-serif";
    ctx.fillText(value, x, y);

    ctx.fillStyle = colors.textSubtle;
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillText(label.toUpperCase(), x, y + 22);
    ctx.textAlign = "left";
}

function drawSparkline(
    ctx: CanvasRenderingContext2D,
    colors: ThemeColors,
    x: number,
    y: number,
    width: number,
    height: number,
    history: { time: number; wpm: number }[],
) {
    if (history.length < 2) return;

    const wpmValues = history.map((h) => h.wpm);
    const minWpm = Math.max(0, Math.min(...wpmValues) - 5);
    const maxWpm = Math.max(...wpmValues) + 5;
    const range = maxWpm - minWpm || 1;

    // Background area
    ctx.fillStyle = colors.surface;
    roundRect(ctx, x, y, width, height, 8);
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    for (let i = 0; i < history.length; i++) {
        const px = x + (i / (history.length - 1)) * width;
        const py = y + height - ((history[i].wpm - minWpm) / range) * (height - 16) - 8;

        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.stroke();

    // Gradient fill under the line
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, `${colors.accent}40`);
    gradient.addColorStop(1, `${colors.accent}05`);

    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ---------------------------------------------------------------------------
// Sharing utilities
// ---------------------------------------------------------------------------

export async function shareCard(canvas: HTMLCanvasElement, data: ShareCardData): Promise<void> {
    const blob = await canvasToBlob(canvas);
    const textSummary = generateTextSummary(data);

    // Try Web Share API first
    if (navigator.share && navigator.canShare) {
        const file = new File([blob], "codesprint-result.png", { type: "image/png" });
        const shareData = { text: textSummary, files: [file] };

        if (navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
                return;
            } catch {
                // User cancelled or share failed — fall through to clipboard
            }
        }
    }

    // Fallback: copy image to clipboard
    try {
        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
        ]);
    } catch {
        // Final fallback: download
        downloadCanvas(canvas);
    }
}

export function downloadCanvas(canvas: HTMLCanvasElement): void {
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "codesprint-result.png";
    a.click();
}

export function generateTextSummary(data: ShareCardData): string {
    const parts = [
        "CodeSprint",
        `${data.snippetTitle} (${data.language.toUpperCase()}, ${capitalize(data.difficulty)})`,
        `${Math.round(data.wpm)} WPM`,
        `${Math.round(data.accuracy * 100)}% accuracy`,
    ];
    if (data.patternScore !== undefined) {
        parts.push(`Pattern: ${data.patternScore}/100`);
    }
    parts.push("codesprint.dev");
    return parts.join(" | ");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob"));
        }, "image/png");
    });
}

function capitalize(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function formatDuration(ms: number): string {
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
