"use client";

import { useState } from "react";

export type ChartType = "bar" | "line" | "horizontalBar";

export interface ChartConfig {
    chartType: ChartType;
    title: string;
    backgroundColor: string;
    barColor: string;
    fontColor: string;
    titleColor: string;
    titleSize: number;
    xAxisFontSize: number;
    yAxisFontSize: number;
    xAxisFontColor: string;
    yAxisFontColor: string;
    sourceText: string;
    sourceColor: string;
    sourceFontSize: number;
    barWidth: number | undefined;
    showValues: boolean;
    showGrid: boolean;
}

export const DEFAULT_CHART_CONFIG: ChartConfig = {
    chartType: "bar",
    title: "Data Results",
    backgroundColor: "#ffffff",
    barColor: "#6ada1b",
    fontColor: "#1e293b",
    titleColor: "#1e293b",
    titleSize: 24,
    xAxisFontSize: 12,
    yAxisFontSize: 12,
    xAxisFontColor: "#64748b",
    yAxisFontColor: "#64748b",
    sourceText: "source: evjuice.net",
    sourceColor: "#6ada1b",
    sourceFontSize: 11,
    barWidth: undefined,
    showValues: true,
    showGrid: true,
};

interface ChartCustomizerProps {
    config: ChartConfig;
    onChange: (config: ChartConfig) => void;
    isOpen: boolean;
    onToggle: () => void;
}

function ColorInput({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <label className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {label}
            </span>
            <div className="relative">
                <input
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-7 w-7 cursor-pointer rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5"
                />
            </div>
        </label>
    );
}

function NumberInput({
    label,
    value,
    onChange,
    placeholder,
    min,
    max,
}: {
    label: string;
    value: number | undefined;
    onChange: (v: number | undefined) => void;
    placeholder?: string;
    min?: number;
    max?: number;
}) {
    return (
        <label className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {label}
            </span>
            <input
                type="number"
                value={value ?? ""}
                onChange={(e) => {
                    const v = Number(e.target.value);
                    onChange(Number.isFinite(v) && v > 0 ? v : undefined);
                }}
                placeholder={placeholder || "Auto"}
                min={min}
                max={max}
                className="h-7 w-16 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-center text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
            />
        </label>
    );
}

export function ChartCustomizer({
    config,
    onChange,
    isOpen,
    onToggle,
}: ChartCustomizerProps) {
    const [activeSection, setActiveSection] = useState<string>("type");

    const update = (partial: Partial<ChartConfig>) =>
        onChange({ ...config, ...partial });

    const chartTypes: { value: ChartType; icon: string; label: string }[] = [
        { value: "bar", icon: "bar_chart", label: "Bar" },
        { value: "line", icon: "show_chart", label: "Line" },
        { value: "horizontalBar", icon: "align_horizontal_left", label: "H-Bar" },
    ];

    const sections = [
        { id: "type", icon: "dashboard", label: "Type" },
        { id: "colors", icon: "palette", label: "Colors" },
        { id: "typography", icon: "text_fields", label: "Text" },
        { id: "source", icon: "copyright", label: "Source" },
    ];

    if (!isOpen) return null;

    return (
        <div className="w-72 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden shadow-inner">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-2">
                    <span className="material-icons-round text-primary text-lg">tune</span>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                        Customize
                    </h3>
                </div>
                <button
                    onClick={onToggle}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                    <span className="material-icons-round text-lg">close</span>
                </button>
            </div>

            {/* Section Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 px-2 py-1">
                {sections.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors ${activeSection === s.id
                                ? "bg-primary/10 text-primary"
                                : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                            }`}
                    >
                        <span className="material-icons-round text-base">{s.icon}</span>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Chart Type Section */}
                {activeSection === "type" && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 block">
                                Chart Type
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {chartTypes.map((ct) => (
                                    <button
                                        key={ct.value}
                                        onClick={() => update({ chartType: ct.value })}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs font-medium transition-all ${config.chartType === ct.value
                                                ? "border-primary bg-primary/10 text-primary shadow-sm"
                                                : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary/50 hover:text-primary"
                                            }`}
                                    >
                                        <span className="material-icons-round text-xl">
                                            {ct.icon}
                                        </span>
                                        {ct.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 block">
                                Title
                            </label>
                            <input
                                type="text"
                                value={config.title}
                                onChange={(e) => update({ title: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                placeholder="Chart title..."
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                Show Values
                            </span>
                            <button
                                onClick={() => update({ showValues: !config.showValues })}
                                className={`w-9 h-5 rounded-full transition-colors relative ${config.showValues ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
                                    }`}
                            >
                                <span
                                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.showValues ? "left-[18px]" : "left-0.5"
                                        }`}
                                />
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                Show Grid
                            </span>
                            <button
                                onClick={() => update({ showGrid: !config.showGrid })}
                                className={`w-9 h-5 rounded-full transition-colors relative ${config.showGrid ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
                                    }`}
                            >
                                <span
                                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.showGrid ? "left-[18px]" : "left-0.5"
                                        }`}
                                />
                            </button>
                        </div>

                        <NumberInput
                            label="Bar Width"
                            value={config.barWidth}
                            onChange={(v) => update({ barWidth: v })}
                            min={1}
                            max={100}
                        />
                    </div>
                )}

                {/* Colors Section */}
                {activeSection === "colors" && (
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1 block">
                            Palette
                        </label>
                        {/* Quick Presets */}
                        <div className="flex gap-2 mb-3">
                            {[
                                { bg: "#ffffff", bar: "#6ada1b", label: "Lime" },
                                { bg: "#0f172a", bar: "#6ada1b", label: "Dark" },
                                { bg: "#ffffff", bar: "#3b82f6", label: "Blue" },
                                { bg: "#fefce8", bar: "#eab308", label: "Gold" },
                            ].map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() =>
                                        update({
                                            backgroundColor: preset.bg,
                                            barColor: preset.bar,
                                        })
                                    }
                                    className="flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary/50 transition-colors group"
                                    title={preset.label}
                                >
                                    <div className="flex gap-0.5 w-full h-4 rounded overflow-hidden">
                                        <div
                                            className="flex-1 rounded-l"
                                            style={{ backgroundColor: preset.bg }}
                                        />
                                        <div
                                            className="flex-1 rounded-r"
                                            style={{ backgroundColor: preset.bar }}
                                        />
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-400 group-hover:text-primary uppercase">
                                        {preset.label}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <ColorInput
                            label="Background"
                            value={config.backgroundColor}
                            onChange={(v) => update({ backgroundColor: v })}
                        />
                        <ColorInput
                            label="Bar / Line Color"
                            value={config.barColor}
                            onChange={(v) => update({ barColor: v })}
                        />
                        <ColorInput
                            label="Font Color"
                            value={config.fontColor}
                            onChange={(v) => update({ fontColor: v })}
                        />
                    </div>
                )}

                {/* Typography Section */}
                {activeSection === "typography" && (
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1 block">
                            Title
                        </label>
                        <ColorInput
                            label="Title Color"
                            value={config.titleColor}
                            onChange={(v) => update({ titleColor: v })}
                        />
                        <NumberInput
                            label="Title Size"
                            value={config.titleSize}
                            onChange={(v) => update({ titleSize: v ?? 24 })}
                            min={10}
                            max={48}
                        />

                        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 block">
                                Axes
                            </label>
                        </div>
                        <NumberInput
                            label="X-Axis Font Size"
                            value={config.xAxisFontSize}
                            onChange={(v) => update({ xAxisFontSize: v ?? 12 })}
                            min={8}
                            max={24}
                        />
                        <ColorInput
                            label="X-Axis Color"
                            value={config.xAxisFontColor}
                            onChange={(v) => update({ xAxisFontColor: v })}
                        />
                        <NumberInput
                            label="Y-Axis Font Size"
                            value={config.yAxisFontSize}
                            onChange={(v) => update({ yAxisFontSize: v ?? 12 })}
                            min={8}
                            max={24}
                        />
                        <ColorInput
                            label="Y-Axis Color"
                            value={config.yAxisFontColor}
                            onChange={(v) => update({ yAxisFontColor: v })}
                        />
                    </div>
                )}

                {/* Source Section */}
                {activeSection === "source" && (
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1 block">
                            Watermark / Source
                        </label>
                        <div>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                                Source Text
                            </span>
                            <input
                                type="text"
                                value={config.sourceText}
                                onChange={(e) => update({ sourceText: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                placeholder="source: evjuice.net"
                            />
                        </div>
                        <ColorInput
                            label="Source Color"
                            value={config.sourceColor}
                            onChange={(v) => update({ sourceColor: v })}
                        />
                        <NumberInput
                            label="Source Font Size"
                            value={config.sourceFontSize}
                            onChange={(v) => update({ sourceFontSize: v ?? 11 })}
                            min={8}
                            max={24}
                        />
                    </div>
                )}
            </div>

            {/* Reset Button */}
            <div className="border-t border-slate-100 dark:border-slate-800 p-3">
                <button
                    onClick={() => onChange(DEFAULT_CHART_CONFIG)}
                    className="w-full py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-primary uppercase tracking-wide transition-colors flex items-center justify-center gap-1"
                >
                    <span className="material-icons-round text-sm">restart_alt</span>
                    Reset All
                </button>
            </div>
        </div>
    );
}
