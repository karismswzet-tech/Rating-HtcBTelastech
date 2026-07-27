import React, { useState } from "react";
import { BookOpen, Maximize2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CHART_URL = "/assets/astm_reference_chart.png";

export default function AstmStandardChart() {
  const [open, setOpen] = useState(false);

  return (
    <Card
      data-testid="astm-standard-chart-card"
      className="border-slate-200 shadow-sm overflow-hidden"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="font-display text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-slate-500" />
              ASTM D130 / IP 154 · Printed Standard Chart
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Official color-gradient reference used by the AI to classify each
              uploaded sample. Click to enlarge.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            data-testid="astm-chart-zoom-btn"
          >
            <Maximize2 className="mr-1 h-3.5 w-3.5" />
            Zoom
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative block w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3 transition-shadow duration-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          data-testid="astm-standard-chart-image-wrapper"
        >
          <img
            src={CHART_URL}
            alt="ASTM D130 / IP 154 copper strip corrosion standards chart"
            className="mx-auto w-full max-w-3xl select-none transition-transform duration-300 ease-out group-hover:scale-[1.01]"
            data-testid="astm-standard-chart-image"
            loading="lazy"
          />
        </button>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Legend label="1a · 1b" text="Slight Tarnish" swatch="#E2955B" />
          <Legend label="2a — 2e" text="Moderate Tarnish" swatch="#795270" />
          <Legend label="3a · 3b" text="Dark Tarnish" swatch="#8E354A" />
          <Legend label="4a — 4c" text="Corrosion" swatch="#111111" />
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-5xl p-0"
          data-testid="astm-chart-dialog"
        >
          <DialogHeader className="border-b border-slate-200 px-6 py-4">
            <DialogTitle className="font-display text-xl font-bold tracking-tight">
              ASTM D130 / IP 154 — Copper Strip Corrosion Standards
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-slate-50">
            <img
              src={CHART_URL}
              alt="ASTM D130 / IP 154 copper strip corrosion standards chart, enlarged"
              className="mx-auto w-full rounded-md"
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const Legend = ({ label, text, swatch }) => (
  <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
    <span
      className="h-4 w-4 rounded-sm ring-1 ring-inset ring-slate-300"
      style={{ backgroundColor: swatch }}
    />
    <div className="min-w-0">
      <div className="font-mono text-[11px] text-slate-500 leading-tight">
        {label}
      </div>
      <div className="text-[11px] font-semibold text-slate-800 leading-tight truncate">
        {text}
      </div>
    </div>
  </div>
);
