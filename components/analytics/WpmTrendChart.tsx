"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import type { WpmTrend } from "@/lib/analytics/aggregations";

export type WpmTrendChartProps = {
    data: WpmTrend;
    height?: number;
    showLabels?: boolean;
};

type ChartDimensions = {
    width: number;
    height: number;
    padding: { top: number; right: number; bottom: number; left: number };
    innerWidth: number;
    innerHeight: number;
};

function calculateDimensions(height: number): ChartDimensions {
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = 600;
    return {
        width,
        height,
        padding,
        innerWidth: width - padding.left - padding.right,
        innerHeight: height - padding.top - padding.bottom,
    };
}

function buildLinePath(
    dataPoints: { wpm: number }[],
    dimensions: ChartDimensions,
    maxWpm: number
): string {
    const { padding, innerWidth, innerHeight } = dimensions;
    const pointCount = Math.max(dataPoints.length - 1, 1);

    return dataPoints
        .map((point, index) => {
            const x = padding.left + (index / pointCount) * innerWidth;
            const y = padding.top + innerHeight - (point.wpm / maxWpm) * innerHeight;
            return `${index === 0 ? "M" : "L"} ${x},${y}`;
        })
        .join(" ");
}

function buildAreaPath(
    linePath: string,
    dataPoints: { wpm: number }[],
    dimensions: ChartDimensions
): string {
    const { padding, innerWidth, height } = dimensions;
    const lastX = padding.left + ((dataPoints.length - 1) / Math.max(dataPoints.length - 1, 1)) * innerWidth;
    const bottomY = height - padding.bottom;
    return `${linePath} L ${lastX},${bottomY} L ${padding.left},${bottomY} Z`;
}

function GridLines({
    dimensions,
    maxWpm,
}: {
    dimensions: ChartDimensions;
    maxWpm: number;
}) {
    const { padding, innerHeight, width } = dimensions;
    const gridLevels = [0, 0.5, 1];

    return (
        <>
            {gridLevels.map((level) => {
                const y = padding.top + innerHeight * (1 - level);
                return (
                    <g key={level}>
                        <line
                            x1={padding.left}
                            y1={y}
                            x2={width - padding.right}
                            y2={y}
                            stroke="var(--border)"
                            strokeDasharray="4 4"
                        />
                        <text
                            x={padding.left - 10}
                            y={y + 4}
                            textAnchor="end"
                            fontSize="10"
                            fill="var(--text-subtle)"
                        >
                            {Math.round(maxWpm * level)}
                        </text>
                    </g>
                );
            })}
        </>
    );
}

function DataPoints({
    dataPoints,
    dimensions,
    maxWpm,
}: {
    dataPoints: { wpm: number; date: string }[];
    dimensions: ChartDimensions;
    maxWpm: number;
}) {
    const { padding, innerWidth, innerHeight } = dimensions;
    const pointCount = Math.max(dataPoints.length - 1, 1);

    return (
        <>
            {dataPoints.map((point, index) => {
                const x = padding.left + (index / pointCount) * innerWidth;
                const y = padding.top + innerHeight - (point.wpm / maxWpm) * innerHeight;
                return (
                    <circle
                        key={index}
                        cx={x}
                        cy={y}
                        r="4"
                        fill="var(--accent)"
                    />
                );
            })}
        </>
    );
}

function XAxisLabels({
    dataPoints,
    dimensions,
    showLabels,
}: {
    dataPoints: { date: string }[];
    dimensions: ChartDimensions;
    showLabels: boolean;
}) {
    const { padding, innerWidth, height } = dimensions;
    const pointCount = Math.max(dataPoints.length - 1, 1);

    if (!showLabels || dataPoints.length > 7) {
        return null;
    }

    return (
        <>
            {dataPoints.map((point, index) => {
                const x = padding.left + (index / pointCount) * innerWidth;
                return (
                    <text
                        key={index}
                        x={x}
                        y={height - 8}
                        textAnchor="middle"
                        fontSize="9"
                        fill="var(--text-subtle)"
                    >
                        {point.date.slice(5)}
                    </text>
                );
            })}
        </>
    );
}

function EmptyState() {
    return (
        <Flex
            justify="center"
            align="center"
            h="200px"
            bg="var(--surface)"
            borderRadius="lg"
            border="1px solid var(--border)"
        >
            <Text color="var(--text-subtle)">No data available</Text>
        </Flex>
    );
}

export default function WpmTrendChart({
    data,
    height = 200,
    showLabels = true,
}: WpmTrendChartProps) {
    if (data.dataPoints.length === 0) {
        return <EmptyState />;
    }

    const maxWpm = Math.max(...data.dataPoints.map((d) => d.wpm), 60);
    const dimensions = calculateDimensions(height);
    const linePath = buildLinePath(data.dataPoints, dimensions, maxWpm);
    const areaPath = buildAreaPath(linePath, data.dataPoints, dimensions);

    return (
        <Box w="100%" h={`${height}px`} position="relative">
            <svg
                viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                style={{ width: "100%", height: "100%", overflow: "visible" }}
                role="img"
                aria-label="WPM trend chart"
            >
                <GridLines dimensions={dimensions} maxWpm={maxWpm} />

                <path
                    d={areaPath}
                    fill="var(--accent)"
                    opacity="0.1"
                    data-testid="area-fill"
                />

                <path
                    d={linePath}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    data-testid="wpm-line"
                />

                <DataPoints
                    dataPoints={data.dataPoints}
                    dimensions={dimensions}
                    maxWpm={maxWpm}
                />

                <XAxisLabels
                    dataPoints={data.dataPoints}
                    dimensions={dimensions}
                    showLabels={showLabels}
                />
            </svg>
        </Box>
    );
}

export { calculateDimensions, buildLinePath, buildAreaPath };
