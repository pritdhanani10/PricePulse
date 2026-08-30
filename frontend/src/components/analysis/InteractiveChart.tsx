"use client";

import React, { useEffect, useRef, useState } from "react";
import { TechnicalAnalysisData } from "../../types/stock";

interface InteractiveChartProps {
  data: TechnicalAnalysisData;
  activeIndicators: {
    sma20: boolean;
    sma50: boolean;
    ema20: boolean;
    bb: boolean;
    vwap: boolean;
    rsi: boolean;
    macd: boolean;
    atr: boolean;
  };
}

export function InteractiveChart({ data, activeIndicators }: InteractiveChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverBar, setHoverBar] = useState<any | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.candles || data.candles.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || 800;
    const height = 550;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    // Layout configuration
    const padding = { top: 20, right: 65, bottom: activeIndicators.rsi || activeIndicators.macd ? 140 : 30, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const mainChartHeight = height - padding.top - padding.bottom;

    // Clear background
    ctx.fillStyle = "#0F1626";
    ctx.fillRect(0, 0, width, height);

    const candles = data.candles;
    const n = candles.length;
    const barWidth = Math.max(3, (chartWidth / n) * 0.75);
    const step = chartWidth / n;

    // Calculate Price Min & Max
    let minPrice = Math.min(...candles.map((c) => c.low));
    let maxPrice = Math.max(...candles.map((c) => c.high));

    // Expand bounds if Bollinger bands are active
    if (activeIndicators.bb && data.indicators.BB_20_2) {
      data.indicators.BB_20_2.forEach((pt) => {
        if (pt.upper) maxPrice = Math.max(maxPrice, pt.upper);
        if (pt.lower) minPrice = Math.min(minPrice, pt.lower);
      });
    }

    const priceRange = maxPrice - minPrice || 1;
    const priceToY = (p: number) => padding.top + mainChartHeight - ((p - minPrice) / priceRange) * mainChartHeight;

    // Draw Price Grid Lines
    ctx.strokeStyle = "#1F293D";
    ctx.lineWidth = 1;
    const gridCount = 5;
    for (let i = 0; i <= gridCount; i++) {
      const priceVal = minPrice + (priceRange / gridCount) * i;
      const y = priceToY(priceVal);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Price Label
      ctx.fillStyle = "#64748B";
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`₹${priceVal.toFixed(1)}`, width - padding.right + 6, y + 3);
    }

    // 1. Draw Bollinger Bands (fill area & lines)
    if (activeIndicators.bb && data.indicators.BB_20_2) {
      const bb = data.indicators.BB_20_2;
      ctx.fillStyle = "rgba(147, 51, 234, 0.08)";
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < bb.length; i++) {
        if (bb[i].upper !== null) {
          const x = padding.left + i * step + step / 2;
          const y = priceToY(bb[i].upper!);
          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      for (let i = bb.length - 1; i >= 0; i--) {
        if (bb[i].lower !== null) {
          const x = padding.left + i * step + step / 2;
          const y = priceToY(bb[i].lower!);
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();

      // Upper band line
      ctx.strokeStyle = "rgba(168, 85, 247, 0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 2. Draw Candlesticks
    candles.forEach((c, i) => {
      const x = padding.left + i * step + step / 2;
      const openY = priceToY(c.open);
      const closeY = priceToY(c.close);
      const highY = priceToY(c.high);
      const lowY = priceToY(c.low);
      const isBull = c.close >= c.open;

      ctx.strokeStyle = isBull ? "#10B981" : "#EF4444";
      ctx.fillStyle = isBull ? "#10B981" : "#EF4444";

      // Wick
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(2, Math.abs(closeY - openY));
      ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);
    });

    // 3. Draw Indicators Overlay Lines (SMA 20, SMA 50, EMA 20, VWAP)
    const drawLineIndicator = (points: { time: number; value: number | null }[] | undefined, color: string, width = 1.5) => {
      if (!points) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      let started = false;
      points.forEach((pt, i) => {
        if (pt.value !== null) {
          const x = padding.left + i * step + step / 2;
          const y = priceToY(pt.value);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      ctx.stroke();
    };

    if (activeIndicators.sma20) drawLineIndicator(data.indicators.SMA_20, "#06B6D4", 1.5);
    if (activeIndicators.sma50) drawLineIndicator(data.indicators.SMA_50, "#818CF8", 1.5);
    if (activeIndicators.ema20) drawLineIndicator(data.indicators.EMA_20, "#F59E0B", 1.5);
    if (activeIndicators.vwap) drawLineIndicator(data.indicators.VWAP, "#EC4899", 1.5);

    // 4. Sub-charts (RSI / MACD)
    if (activeIndicators.rsi && data.indicators.RSI_14) {
      const subTop = height - 120;
      const subHeight = 90;

      // Sub-chart box
      ctx.fillStyle = "#0A0E18";
      ctx.fillRect(padding.left, subTop, chartWidth, subHeight);
      ctx.strokeStyle = "#1F293D";
      ctx.strokeRect(padding.left, subTop, chartWidth, subHeight);

      // Overbought 70 and Oversold 30 lines
      const rsiToY = (r: number) => subTop + subHeight - (r / 100) * subHeight;
      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.left, rsiToY(70));
      ctx.lineTo(padding.left + chartWidth, rsiToY(70));
      ctx.stroke();

      ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
      ctx.beginPath();
      ctx.moveTo(padding.left, rsiToY(30));
      ctx.lineTo(padding.left + chartWidth, rsiToY(30));
      ctx.stroke();
      ctx.setLineDash([]);

      // RSI Curve
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      data.indicators.RSI_14.forEach((pt, i) => {
        if (pt.value !== null) {
          const x = padding.left + i * step + step / 2;
          const y = rsiToY(pt.value);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      ctx.stroke();

      // RSI Label
      ctx.fillStyle = "#38BDF8";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("RSI (14)", padding.left + 8, subTop + 14);
      ctx.fillStyle = "#64748B";
      ctx.fillText("70", width - padding.right + 6, rsiToY(70) + 3);
      ctx.fillText("30", width - padding.right + 6, rsiToY(30) + 3);
    }
  }, [data, activeIndicators]);

  return (
    <div className="relative w-full rounded-2xl border border-surface-border bg-surface p-4 shadow-2xl">
      {/* Legend & Stats Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <span className="text-lg font-black text-white font-mono">{data.symbol}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-surface-light border border-surface-border text-gray-400 font-mono">
            {data.timeframe} Candlesticks
          </span>
        </div>

        {/* Dynamic Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
          {activeIndicators.sma20 && (
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400" /> SMA 20
            </span>
          )}
          {activeIndicators.sma50 && (
            <span className="flex items-center gap-1 text-indigo-400">
              <span className="h-2 w-2 rounded-full bg-indigo-400" /> SMA 50
            </span>
          )}
          {activeIndicators.ema20 && (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> EMA 20
            </span>
          )}
          {activeIndicators.vwap && (
            <span className="flex items-center gap-1 text-pink-400">
              <span className="h-2 w-2 rounded-full bg-pink-400" /> VWAP
            </span>
          )}
          {activeIndicators.bb && (
            <span className="flex items-center gap-1 text-purple-400">
              <span className="h-2 w-2 rounded-full bg-purple-400" /> BB (20,2)
            </span>
          )}
          {activeIndicators.rsi && (
            <span className="flex items-center gap-1 text-sky-400">
              <span className="h-2 w-2 rounded-full bg-sky-400" /> RSI (14)
            </span>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="mt-3 relative w-full overflow-hidden flex justify-center">
        <canvas ref={canvasRef} className="rounded-xl w-full" />
      </div>

      {/* Compliance Disclaimer */}
      <div className="mt-3 pt-2 border-t border-surface-border/50 text-[10px] text-gray-500 text-center font-sans">
        {data.disclaimer}
      </div>
    </div>
  );
}
