import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Video,
  Settings2,
  Camera,
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Timer,
  X as XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "copperstrip.ipcam.baseUrl";
const DELAY_KEY = "copperstrip.ipcam.captureDelay";
const DELAY_OPTIONS = [0, 3, 5, 10];

function normalizeBase(url) {
  if (!url) return "";
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = "http://" + u;
  return u.replace(/\/+$/, "");
}

function buildUrls(base) {
  const clean = normalizeBase(base);
  if (!clean) return { stream: "", snapshot: "" };
  return {
    stream: `${clean}/video`,
    snapshot: `${clean}/shot.jpg`,
  };
}

async function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("read failed"));
    r.readAsDataURL(blob);
  });
}

function imageToDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (e) {
        reject(new Error("Canvas tainted (CORS blocked). Enable CORS in the IP Webcam app."));
      }
    };
    img.onerror = () => reject(new Error("Could not load snapshot"));
    img.src = url;
  });
}

async function captureFromCamera(snapshotUrl) {
  const url = `${snapshotUrl}?t=${Date.now()}`;
  // Try fetch first — works if the camera returns CORS headers
  try {
    const resp = await fetch(url, { mode: "cors" });
    if (resp.ok) {
      const blob = await resp.blob();
      return await blobToDataUrl(blob);
    }
  } catch (_) {
    // fall through to <img> fallback
  }
  return await imageToDataUrl(url);
}

export default function IpWebcamCard({ onCapture, analyzing = false }) {
  const [baseUrl, setBaseUrl] = useState(
    () => (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) || ""
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState(baseUrl);
  const [streamOk, setStreamOk] = useState(null); // null | true | false
  const [streamKey, setStreamKey] = useState(0); // force reload
  const [capturing, setCapturing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [countdown, setCountdown] = useState(null); // null | 3 | 2 | 1
  const [captureDelay, setCaptureDelay] = useState(() => {
    if (typeof window === "undefined") return 3;
    const raw = localStorage.getItem(DELAY_KEY);
    const n = raw == null ? 3 : parseInt(raw, 10);
    return DELAY_OPTIONS.includes(n) ? n : 3;
  });
  const countdownTimerRef = useRef(null);
  const imgRef = useRef(null);

  const { stream, snapshot } = useMemo(() => buildUrls(baseUrl), [baseUrl]);
  const configured = !!baseUrl;

  // Reset the ok indicator when the URL changes
  useEffect(() => {
    setStreamOk(null);
  }, [baseUrl, streamKey]);

  const openSettings = () => {
    setDraft(baseUrl);
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    const clean = normalizeBase(draft);
    if (!clean) {
      toast.error("Enter a valid IP camera URL");
      return;
    }
    localStorage.setItem(STORAGE_KEY, clean);
    setBaseUrl(clean);
    setSettingsOpen(false);
    setStreamKey((k) => k + 1);
    toast.success("IP camera saved");
  };

  const clearSettings = () => {
    localStorage.removeItem(STORAGE_KEY);
    setBaseUrl("");
    setDraft("");
    setSettingsOpen(false);
    toast.success("IP camera cleared");
  };

  const testConnection = async () => {
    const clean = normalizeBase(draft);
    if (!clean) return;
    setTesting(true);
    try {
      await imageToDataUrl(`${clean}/shot.jpg?t=${Date.now()}`);
      toast.success("Camera reachable — CORS OK");
    } catch (e) {
      toast.error(e.message || "Camera unreachable");
    } finally {
      setTesting(false);
    }
  };

  const doCapture = async () => {
    if (!snapshot) return;
    setCapturing(true);
    try {
      const dataUrl = await captureFromCamera(snapshot);
      onCapture?.(dataUrl);
    } catch (e) {
      toast.error(e.message || "Capture failed");
    } finally {
      setCapturing(false);
    }
  };

  const clearCountdown = () => {
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  const cancelCountdown = () => {
    if (countdown != null) {
      clearCountdown();
      setCountdown(null);
      toast.info("Capture cancelled");
    }
  };

  const startCapture = () => {
    if (!snapshot || capturing || analyzing || countdown != null) return;
    if (captureDelay <= 0) {
      doCapture();
      return;
    }
    setCountdown(captureDelay);
  };

  // Countdown driver — pure effect, safe under React StrictMode.
  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) {
      setCountdown(null);
      doCapture();
      return;
    }
    countdownTimerRef.current = setTimeout(() => {
      setCountdown((n) => (n != null ? n - 1 : null));
    }, 1000);
    return () => {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const changeDelay = (val) => {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n)) return;
    setCaptureDelay(n);
    localStorage.setItem(DELAY_KEY, String(n));
  };

  useEffect(() => () => clearCountdown(), []);

  return (
    <Card
      data-testid="ipcam-card"
      className="border-slate-200 shadow-sm overflow-hidden"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="font-display text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Video className="h-5 w-5 text-slate-500" />
              IP WebCam
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Live view from your IP camera. Capture <span className="font-semibold text-slate-700">auto-analyzes</span> the frame instantly.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {configured && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                  streamOk === true
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : streamOk === false
                    ? "bg-rose-50 text-rose-700 ring-rose-200"
                    : "bg-slate-50 text-slate-600 ring-slate-200"
                }`}
                data-testid="ipcam-status"
              >
                {streamOk === true ? (
                  <Wifi className="h-3 w-3" />
                ) : streamOk === false ? (
                  <WifiOff className="h-3 w-3" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {streamOk === true
                  ? "Live"
                  : streamOk === false
                  ? "Offline"
                  : "Connecting"}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={openSettings}
              data-testid="ipcam-settings-btn"
              title="IP camera settings"
            >
              <Settings2 className="mr-1 h-3.5 w-3.5" />
              Settings
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!configured ? (
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center"
            data-testid="ipcam-empty-state"
          >
            <Video className="mb-3 h-10 w-10 text-slate-400" />
            <div className="font-display text-base font-semibold text-slate-800">
              No IP camera configured
            </div>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              Install the &quot;IP Webcam&quot; app on Android (or any MJPEG source),
              start the server, and paste the base URL below (e.g.{" "}
              <span className="font-mono">http://192.168.1.10:8080</span>).
            </p>
            <Button
              className="mt-4 bg-slate-900 hover:bg-slate-800"
              onClick={openSettings}
              data-testid="ipcam-configure-btn"
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Configure IP Camera
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className="relative overflow-hidden rounded-lg border border-slate-200 bg-black"
              data-testid="ipcam-preview"
            >
              <img
                ref={imgRef}
                key={`${stream}?k=${streamKey}`}
                src={`${stream}?k=${streamKey}`}
                alt="IP camera live stream"
                className="mx-auto block max-h-[420px] w-full object-contain"
                onLoad={() => setStreamOk(true)}
                onError={() => setStreamOk(false)}
                data-testid="ipcam-stream-img"
              />
              {streamOk === false && countdown == null && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 text-center text-slate-100">
                  <div className="max-w-sm px-4">
                    <AlertCircle className="mx-auto mb-2 h-8 w-8 text-rose-400" />
                    <div className="font-semibold">Can&apos;t reach the camera</div>
                    <p className="mt-1 text-xs text-slate-300">
                      Check that the camera is on the same network and that CORS
                      is enabled in the IP Webcam app.
                    </p>
                  </div>
                </div>
              )}
              {countdown != null && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[2px]"
                  data-testid="ipcam-countdown-overlay"
                >
                  <div
                    key={countdown}
                    className="rating-display text-white text-[10rem] leading-none drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)] fade-in"
                    data-testid="ipcam-countdown-number"
                  >
                    {countdown}
                  </div>
                  <div className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                    Position the copper strip
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 border-white/30 bg-white/10 text-white hover:bg-white/20"
                    onClick={cancelCountdown}
                    data-testid="ipcam-countdown-cancel"
                  >
                    <XIcon className="mr-1 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="font-mono text-[11px] text-slate-500 truncate max-w-[220px]">
                  {baseUrl}
                </div>
                <div
                  className="hidden items-center gap-1.5 sm:flex"
                  data-testid="ipcam-delay-wrapper"
                >
                  <Timer className="h-3.5 w-3.5 text-slate-400" />
                  <Select
                    value={String(captureDelay)}
                    onValueChange={changeDelay}
                    disabled={countdown != null || capturing || analyzing}
                  >
                    <SelectTrigger
                      className="h-7 w-[92px] text-xs"
                      data-testid="ipcam-delay-select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELAY_OPTIONS.map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d === 0 ? "Instant" : `${d}s delay`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStreamKey((k) => k + 1)}
                  disabled={countdown != null}
                  data-testid="ipcam-reload-btn"
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  Reload
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                  onClick={startCapture}
                  disabled={
                    capturing || analyzing || streamOk === false || countdown != null
                  }
                  data-testid="ipcam-capture-btn"
                >
                  <Camera className="mr-1.5 h-4 w-4" />
                  {analyzing
                    ? "Analyzing…"
                    : capturing
                    ? "Capturing…"
                    : captureDelay > 0
                    ? `Capture in ${captureDelay}s`
                    : "Capture & Analyze"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent data-testid="ipcam-settings-dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold tracking-tight flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-slate-500" />
              IP Camera Settings
            </DialogTitle>
            <DialogDescription>
              Enter the base URL of your IP Webcam server. The stream must be
              reachable from this browser.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ipcam-url">Base URL</Label>
              <Input
                id="ipcam-url"
                data-testid="ipcam-url-input"
                placeholder="http://192.168.1.10:8080"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="font-mono"
              />
              <p className="text-[11px] text-slate-500">
                The app will use <span className="font-mono">/video</span> for
                the live stream and <span className="font-mono">/shot.jpg</span>{" "}
                for capture.
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Tips
              </div>
              <ul className="list-inside list-disc space-y-0.5">
                <li>
                  Android &quot;IP Webcam&quot; app → enable{" "}
                  <span className="font-mono">Access &gt; CORS</span> so capture
                  works.
                </li>
                <li>Use HTTP (not HTTPS) when the camera has no SSL cert.</li>
                <li>
                  Test that <span className="font-mono">/shot.jpg</span> opens
                  in your browser first.
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex gap-2">
              {baseUrl && (
                <Button
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  onClick={clearSettings}
                  data-testid="ipcam-clear-btn"
                >
                  Clear
                </Button>
              )}
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={testing || !draft}
                data-testid="ipcam-test-btn"
              >
                {testing ? "Testing…" : "Test Connection"}
              </Button>
            </div>
            <Button
              className="bg-slate-900 hover:bg-slate-800"
              onClick={saveSettings}
              data-testid="ipcam-save-btn"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
