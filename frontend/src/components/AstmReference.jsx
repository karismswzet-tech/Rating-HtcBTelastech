import React from "react";
import { ASTM_RATINGS, getReadableTextOn } from "@/lib/astm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AstmReference({ highlightRating }) {
  return (
    <Card
      data-testid="astm-reference-card"
      className="sticky top-24 border-slate-200 shadow-sm"
    >
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg font-bold tracking-tight">
          ASTM D130 Reference
        </CardTitle>
        <p className="text-xs text-slate-500">
          12 standard corrosion ratings. Hover for description.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {ASTM_RATINGS.map((r) => {
            const isActive = highlightRating === r.rating;
            const textColor = getReadableTextOn(r.color);
            return (
              <div
                key={r.rating}
                data-testid={`astm-swatch-${r.rating}`}
                title={`${r.rating.toUpperCase()} — ${r.category}: ${r.description}`}
                className={`group relative flex aspect-square flex-col items-center justify-center rounded-md border transition-transform duration-200 hover:-translate-y-0.5 ${
                  isActive
                    ? "ring-4 ring-offset-2 ring-blue-500 border-blue-500"
                    : "border-slate-200"
                }`}
                style={{ backgroundColor: r.color, color: textColor }}
              >
                <span className="rating-display text-2xl">{r.rating}</span>
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-90">
                  {r.category.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 space-y-2 text-xs">
          <LegendRow label="1a · 1b" text="Slight Tarnish" dot="bg-amber-500" />
          <LegendRow label="2a — 2e" text="Moderate Tarnish" dot="bg-violet-500" />
          <LegendRow label="3a · 3b" text="Dark Tarnish" dot="bg-rose-600" />
          <LegendRow label="4a — 4c" text="Corrosion" dot="bg-slate-800" />
        </div>
      </CardContent>
    </Card>
  );
}

const LegendRow = ({ label, text, dot }) => (
  <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5">
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="font-mono text-[11px] text-slate-500">{label}</span>
    </div>
    <span className="text-[11px] font-medium text-slate-700">{text}</span>
  </div>
);
