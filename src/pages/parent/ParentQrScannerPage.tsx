import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { logError } from "@/lib/errorLogger";
import { resolveSessionFromInput, validateSeminarSession } from "@/lib/parentCheckIn";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetectorLike;
    };
  }
}

const ParentQrScannerPage = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const lastScanAtRef = useRef(0);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  const resolveScannedValueRef = useRef<(rawValue: string) => Promise<boolean>>(
    async () => false,
  );

  const barcodeDetector = useMemo(() => {
    if (!window.BarcodeDetector) return null;
    return new window.BarcodeDetector({ formats: ["qr_code"] });
  }, []);

  const stopCamera = useCallback(() => {
    if (scanFrameRef.current) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setCameraError(null);

      if (!barcodeDetector) {
        setCameraError("이 브라우저는 QR 자동 인식을 지원하지 않습니다.");
        setManualOpen(true);
      }
    } catch {
      setCameraError("카메라 권한이 필요합니다.");
      setManualOpen(true);
    }
  }, [barcodeDetector]);

  const startScanLoop = useCallback(() => {
    if (!barcodeDetector || !videoRef.current || !canvasRef.current) return;

    const tick = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        scanFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        scanFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 1280;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const result = await barcodeDetector.detect(canvas);
        const value = result.find((item) => item.rawValue)?.rawValue;
        if (value) {
          const handled = await resolveScannedValueRef.current(value);
          if (handled) return;
        }
      } catch {
        // 브라우저별 detect 예외는 재시도로 흡수
      }

      scanFrameRef.current = requestAnimationFrame(tick);
    };

    scanFrameRef.current = requestAnimationFrame(tick);
  }, [barcodeDetector]);

  const resolveScannedValue = useCallback(
    async (rawValue: string) => {
      const trimmed = rawValue.trim();
      if (!trimmed) return false;

      const now = Date.now();
      if (now - lastScanAtRef.current < 1200) return false;
      lastScanAtRef.current = now;

      setIsResolving(true);
      stopCamera();

      try {
        const sessionId = await resolveSessionFromInput(trimmed);
        if (!sessionId) {
          toast.error("유효하지 않은 QR입니다. 세션 코드를 직접 입력해주세요.");
          setManualOpen(true);
          await startCamera();
          startScanLoop();
          return false;
        }

        const validation = await validateSeminarSession(sessionId);
        if (!validation.valid) {
          toast.error(validation.message ?? "유효하지 않은 세션입니다.");
          await startCamera();
          startScanLoop();
          return false;
        }

        navigate(`/p/check-in/${sessionId}/verify`);
        return true;
      } catch (error) {
        logError("check-in-resolve-session", error);
        toast.error("QR을 해석하지 못했습니다. 세션 코드를 직접 입력해주세요.");
        setManualOpen(true);
        await startCamera();
        startScanLoop();
        return false;
      } finally {
        setIsResolving(false);
      }
    },
    [navigate, startCamera, startScanLoop, stopCamera],
  );

  useEffect(() => {
    resolveScannedValueRef.current = resolveScannedValue;
  }, [resolveScannedValue]);

  useEffect(() => {
    startCamera().then(() => {
      if (barcodeDetector) startScanLoop();
    });
    return () => stopCamera();
  }, [barcodeDetector, startCamera, startScanLoop, stopCamera]);

  const handleManualSubmit = async () => {
    const normalized = manualCode.trim();
    if (!normalized) {
      toast.error("세션 코드를 입력해주세요.");
      return;
    }

    const handled = await resolveScannedValue(normalized);
    if (handled) setManualOpen(false);
  };

  return (
    <div className="min-h-screen bg-black text-white relative">
      <header className="absolute inset-x-0 top-0 z-20 px-4 pt-[max(1rem,env(safe-area-inset-top))] h-16 flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:text-white hover:bg-white/15"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </header>

      <main className="relative min-h-screen">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        <div className="absolute inset-x-0 bottom-24 px-4">
          <div className="mx-auto max-w-sm rounded-xl bg-black/50 backdrop-blur-sm border border-white/20 px-4 py-3 text-center">
            <p className="text-sm font-medium">QR을 카메라 중앙에 맞춰주세요</p>
            <p className="text-xs text-white/80 mt-1">
              {cameraError
                ? "카메라 사용이 어려우면 세션 코드를 직접 입력하세요."
                : cameraReady
                  ? "인식되면 자동으로 다음 단계로 이동합니다."
                  : "카메라를 준비하고 있습니다."}
            </p>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-8 text-center">
          <button
            type="button"
            className="text-sm text-white/90 underline underline-offset-4 hover:text-white"
            onClick={() => setManualOpen(true)}
          >
            세션 코드 직접 입력
          </button>
        </div>

        {!cameraReady && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="flex flex-col items-center gap-2">
              <Camera className="w-8 h-8 animate-pulse" />
              <p className="text-sm text-white/85">카메라 연결 중</p>
            </div>
          </div>
        )}
      </main>

      <Sheet open={manualOpen} onOpenChange={setManualOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle>세션 코드 직접 입력</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="sessionCode">세션 코드</Label>
              <Input
                id="sessionCode"
                placeholder="예: SEM-20260520"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                autoComplete="off"
              />
            </div>
            <Button className="w-full" onClick={handleManualSubmit} disabled={isResolving}>
              확인
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ParentQrScannerPage;
