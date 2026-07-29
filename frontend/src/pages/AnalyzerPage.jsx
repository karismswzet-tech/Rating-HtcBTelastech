import React, { useCallback, useRef, useState } from "react";
import { UploadCloud, Loader2, Save, Sparkles, X, FileDown } from "lucide-react";
import { toast } from "sonner";

import { api, API } from "@/lib/api";
import AstmReference from "@/components/AstmReference";
import AstmStandardChart from "@/components/AstmStandardChart";
import IpWebcamCard from "@/components/IpWebcamCard";
import CategoryBadge from "@/components/CategoryBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_DIM = 1600;

async function toResizedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resizeDataUrl(reader.result).then(resolve, reject);
    reader.readAsDataURL(file);
  });
}

async function resizeDataUrl(url, mime = "image/jpeg", quality = 0.92) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Could not load image"));
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, MAX_DIM / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL(mime, quality));
    };
    img.src = url;
  });
}

export default function AnalyzerPage() {
  const [dataUrl, setDataUrl] = useState(null);
  const [sampleName, setSampleName] = useState("");
  const [notes, setNotes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const onFile = useCallback(async (file) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Unsupported format. Use JPEG, PNG or WEBP.");
      return;
    }
    try {
      const url = await toResizedDataUrl(file);
      setDataUrl(url);
      setResult(null);
    } catch (e) {
      toast.error("Could not read the image.");
    }
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  };

  const onCameraCapture = async (rawDataUrl) => {
    if (!rawDataUrl) return;
    let resized = rawDataUrl;
    try {
      resized = await resizeDataUrl(rawDataUrl);
    } catch (_) {
      // fall back to raw dataURL
    }
    // Auto-fill sample name with timestamp if the user hasn't set one
    let effectiveSampleName = sampleName;
    if (!sampleName.trim()) {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      effectiveSampleName =
        `IPCAM-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
        `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      setSampleName(effectiveSampleName);
    }
    setDataUrl(resized);
    setResult(null);
    toast.info("Auto-analyzing captured frame…");
    await analyze(resized, effectiveSampleName);
  };

  const analyze = async (overrideDataUrl, overrideSampleName) => {
    const source = overrideDataUrl || dataUrl;
    const name = overrideSampleName != null ? overrideSampleName : sampleName;
    if (!source) {
      toast.error("Please upload a copper strip photo first.");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const { data } = await api.post("/analyze", {
        image_data: source,
        sample_name: name,
        notes,
      });
      setResult(data);
      toast.success(`Rated ${data.rating.toUpperCase()} · ${data.category}`);
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Analysis failed";
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setDataUrl(null);
    setResult(null);
    setSampleName("");
    setNotes("");
  };

  const downloadPdf = () => {
    if (!result?.id) return;
    window.open(`${API}/analyses/${result.id}/pdf`, "_blank");
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left: Upload / Analyze */}
      <div className="lg:col-span-8 space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-display text-2xl font-bold tracking-tight">
                  New Analysis
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Upload a photo of your copper strip test. AI Vision will classify
                  it against the ASTM D130 reference.
                </p>
              </div>
              {dataUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  data-testid="reset-btn"
                >
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!dataUrl ? (
              <div
                data-testid="upload-dropzone"
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-slate-50 p-8 text-center transition-colors duration-200 ${
                  dragActive
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-300 hover:bg-slate-100"
                }`}
              >
                <UploadCloud
                  className={`mb-3 h-12 w-12 transition-transform duration-200 ${
                    dragActive ? "scale-110 text-blue-600" : "text-slate-400"
                  }`}
                />
                <div className="font-display text-lg font-semibold text-slate-800">
                  Drop copper strip photo here
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  or click to browse · JPEG, PNG, WEBP · up to 10&nbsp;MB
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  data-testid="file-input"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div
                  className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                  data-testid="image-preview"
                >
                  <img
                    src={dataUrl}
                    alt="Sample"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sample-name">Sample ID / Name (optional)</Label>
                    <Input
                      id="sample-name"
                      data-testid="sample-name-input"
                      placeholder="e.g. Batch-2026-04-A"
                      value={sampleName}
                      onChange={(e) => setSampleName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      data-testid="notes-input"
                      rows={4}
                      placeholder="Test conditions, technician, temperature, duration…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full bg-slate-900 hover:bg-slate-800"
                    onClick={analyze}
                    disabled={analyzing}
                    data-testid="analyze-btn"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing with AI Vision…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Analyze & Save
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {result && <ResultCard result={result} onPdf={downloadPdf} />}

        <IpWebcamCard onCapture={onCameraCapture} analyzing={analyzing} />

        <AstmStandardChart />
      </div>

      {/* Right: ASTM reference */}
      <div className="lg:col-span-4">
        <AstmReference highlightRating={result?.rating} />
      </div>
    </div>
  );
}

function ResultCard({ result, onPdf }) {
  return (
    <Card
      data-testid="result-card"
      className="slide-up border-slate-200 shadow-md"
    >
      <CardContent className="p-6 md:p-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-1 flex flex-col items-start">
            <div className="text-xs font-medium uppercase tracking-widest text-slate-500">
              ASTM D130 Rating
            </div>
            <div
              data-testid="result-rating"
              className="rating-display mt-1 text-7xl md:text-8xl text-blue-700"
            >
              {result.rating.toUpperCase()}
            </div>
            <div className="mt-3">
              <CategoryBadge
                category={result.category}
                testid="result-category-badge"
              />
            </div>
            {typeof result.confidence === "number" && (
              <div className="mt-2 font-mono text-xs text-slate-500">
                Confidence · {(result.confidence * 100).toFixed(1)}%
              </div>
            )}
          </div>

          <div className="md:col-span-2 space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Description
              </div>
              <p
                data-testid="result-description"
                className="mt-1 text-slate-800 leading-relaxed"
              >
                {result.description}
              </p>
            </div>

            {result.sample_name && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Sample
                </div>
                <div className="mt-1 font-mono text-sm text-slate-700">
                  {result.sample_name}
                </div>
              </div>
            )}

            {result.notes && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Notes
                </div>
                <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                  {result.notes}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                onClick={onPdf}
                data-testid="download-pdf-btn"
              >
                <FileDown className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
              <Button
                asChild
                variant="secondary"
                data-testid="go-history-btn"
              >
                <a href="/history">
                  <Save className="mr-2 h-4 w-4" />
                  View in History
                </a>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
