import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Grid } from "@mui/material";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import SettingsPanel from "./components/SettingsPanel";
import PreviewPanel from "./components/PreviewPanel";
import type { PreviewItem, ProgressState } from "./types";

type OutputSize = {
  key: "landscape" | "portrait";
  width: number;
  height: number;
  fontSize: number;
  offsetX: number;
  offsetY: number;
  label: string;
};

function naturalCompare(a: string, b: string): number {
  // "img2.png" < "img10.png" のように自然順で並べる
  const ax: Array<[number | string, string]> = [];
  const bx: Array<[number | string, string]> = [];

  a.replace(/(\d+)|(\D+)/g, (_, $1: string, $2: string) => {
    ax.push([$1 ? Number($1) : Number.POSITIVE_INFINITY, $2 ?? ""]);
    return "";
  });
  b.replace(/(\d+)|(\D+)/g, (_, $1: string, $2: string) => {
    bx.push([$1 ? Number($1) : Number.POSITIVE_INFINITY, $2 ?? ""]);
    return "";
  });

  while (ax.length && bx.length) {
    const an = ax.shift()!;
    const bn = bx.shift()!;
    const aNum = an[0] as number;
    const bNum = bn[0] as number;
    if (aNum !== bNum) return aNum - bNum;

    const aStr = an[1];
    const bStr = bn[1];
    if (aStr !== bStr) return aStr.localeCompare(bStr, "ja");
  }
  return ax.length - bx.length;
}

function padNumber(n: number, digits: number): string {
  const s = String(n);
  if (digits <= s.length) return s;
  return "0".repeat(digits - s.length) + s;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  img.loading = "eager";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = url;
  });

  // ※URL.revokeObjectURL(url) はプレビュー用に残したいのでここではしない
  return img;
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? new Blob()),
      type,
      quality
    );
  });
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}


export default function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [progress, setProgress] = useState<ProgressState>({ done: 0, total: 0 });

  // --- stamp settings ---
  const [prefix, setPrefix] = useState<string>("EP.");
  // 追加: 横用/縦用のファイル名prefix
  const [landscapePrefix, setLandscapePrefix] = useState<string>("No7_");
  const [portraitPrefix, setPortraitPrefix] = useState<string>("No8_");
  // 追加: 横用/縦用のタグ
  const [landscapeTag, setLandscapeTag] = useState<string>("_Horizontal");
  const [portraitTag, setPortraitTag] = useState<string>("_Vertical");
  const [startNumber, setStartNumber] = useState<number>(1);
  const [digits, setDigits] = useState<number>(1);
  const [fontFamily, setFontFamily] = useState<string>(
    "Noto Sans JP, system-ui, -apple-system, Segoe UI, Arial"
  );
  const [bold, setBold] = useState<boolean>(true);
  const [textColor, setTextColor] = useState<string>("#ffffff");

  const [useBg, setUseBg] = useState<boolean>(false);
  const [bgColor, setBgColor] = useState<string>("#000000");
  const [bgAlpha, setBgAlpha] = useState<number>(0.55);
  const [padding, setPadding] = useState<number>(18);

  const [useShadow, setUseShadow] = useState<boolean>(true);
  const [shadowAlpha, setShadowAlpha] = useState<number>(0.6);

  const [jpegQuality, setJpegQuality] = useState<number>(0.92);

  const outputSizes: OutputSize[] = useMemo(
    () => [
      {
        key: "landscape",
        width: 1920,
        height: 1080,
        fontSize: 170,
        offsetX: 30,
        offsetY: 30,
        label: "1920x1080",
      },
      {
        key: "portrait",
        width: 500,
        height: 750,
        fontSize: 80,
        offsetX: 12,
        offsetY: 8,
        label: "500x750",
      },
    ],
    []
  );

  const sortedFiles = useMemo<File[]>(() => {
    const arr = [...files];
    arr.sort((fa, fb) => naturalCompare(fa.name, fb.name));
    return arr;
  }, [files]);

  const revokePreviewUrls = useCallback((items: PreviewItem[]) => {
    items.forEach((p) => {
      if (p.originalUrl) URL.revokeObjectURL(p.originalUrl);
      if (p.stampedUrl) URL.revokeObjectURL(p.stampedUrl);
    });
  }, []);

  const resetAll = useCallback(() => {
    revokePreviewUrls(previews);
    setFiles([]);
    setPreviews([]);
    setProgress({ done: 0, total: 0 });
    if (inputRef.current) inputRef.current.value = "";
  }, [previews, revokePreviewUrls]);

  const onPickFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(e.target.files ?? []);
      if (!list.length) return;
      setFiles(list);
    },
    []
  );

  const renderAll = useCallback(async () => {
    if (!sortedFiles.length) return;

    revokePreviewUrls(previews);
    setPreviews([]);
    setIsRendering(true);
    setProgress({ done: 0, total: sortedFiles.length * outputSizes.length });

    try {
      const next: PreviewItem[] = [];

      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i];
        const originalUrl = URL.createObjectURL(file);

        let img: HTMLImageElement;
        try {
          img = await fileToImage(file);
        } catch {
          const num = startNumber + i;
          outputSizes.forEach((size) => {
            next.push({
              id: `${file.name}-${i}-${size.key}`,
              name: file.name,
              originalUrl,
              stampedUrl: "",
              stampedBlob: null,
              label: "",
              sequenceNumber: num,
              width: size.width,
              height: size.height,
              sizeLabel: size.label,
              error: "画像の読み込みに失敗しました",
            });
          });
          setProgress((p) => ({ ...p, done: p.done + outputSizes.length }));
          continue;
        }

        const num = startNumber + i;
        const label = `${prefix}${padNumber(num, digits)}`;
        for (let s = 0; s < outputSizes.length; s++) {
          const size = outputSizes[s];
          const canvas = document.createElement("canvas");
          canvas.width = size.width;
          canvas.height = size.height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            next.push({
              id: `${file.name}-${i}-${size.key}`,
              name: file.name,
              originalUrl,
              stampedUrl: "",
              stampedBlob: null,
              label: "",
              sequenceNumber: num,
              width: size.width,
              height: size.height,
              sizeLabel: size.label,
              error: "Canvasの初期化に失敗しました",
            });
            setProgress((p) => ({ ...p, done: p.done + 1 }));
            continue;
          }

          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const srcW = img.naturalWidth || img.width;
          const srcH = img.naturalHeight || img.height;
          const scale = Math.min(canvas.width / srcW, canvas.height / srcH);
          const drawW = srcW * scale;
          const drawH = srcH * scale;
          const drawX = (canvas.width - drawW) / 2;
          const drawY = (canvas.height - drawH) / 2;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          const weight = bold ? "700" : "400";
          ctx.font = `${weight} ${size.fontSize}px ${fontFamily}`;
          ctx.textBaseline = "top";
          ctx.textAlign = "left";

          const metrics = ctx.measureText(label);
          const textW = metrics.width;
          const textH = size.fontSize * 1.1;

          const x = clamp(size.offsetX, 0, canvas.width - 1);
          const y = clamp(size.offsetY, 0, canvas.height - 1);

          if (useBg) {
            const rectW = textW + padding * 2;
            const rectH = textH + padding * 2;
            ctx.fillStyle = hexToRgba(bgColor, bgAlpha);
            ctx.fillRect(x, y, rectW, rectH);
          }

          if (useShadow) {
            ctx.shadowColor = `rgba(0,0,0,${shadowAlpha})`;
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
          } else {
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }

          ctx.fillStyle = textColor;
          ctx.fillText(label, x + padding, y + padding);

          const mime = "image/jpeg";
          const blob = await canvasToBlob(canvas, mime, jpegQuality);
          const stampedUrl = URL.createObjectURL(blob);

          next.push({
            id: `${file.name}-${i}-${size.key}`,
            name: file.name,
            originalUrl,
            stampedUrl,
            stampedBlob: blob,
            label,
            sequenceNumber: num,
            width: size.width,
            height: size.height,
            sizeLabel: size.label,
          });

          setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      }

      setPreviews(next);
    } finally {
      setIsRendering(false);
    }
  }, [
    sortedFiles,
    previews,
    revokePreviewUrls,
    prefix,
    startNumber,
    digits,
    fontFamily,
    bold,
    textColor,
    useBg,
    bgColor,
    bgAlpha,
    padding,
    useShadow,
    shadowAlpha,
    jpegQuality,
    outputSizes,
  ]);

  useEffect(() => {
    if (files.length) void renderAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const downloadZip = useCallback(async () => {
    const valid = previews.filter((p) => p.stampedBlob);
    if (!valid.length) return;

    const zip = new JSZip();
    valid.forEach((p) => {
      const base = p.name.replace(/\.[^.]+$/, "");
      const ext = "jpg";
      const isPortrait = p.width === 500 && p.height === 750;
      const prefix = isPortrait ? portraitPrefix : landscapePrefix;
      const tag = isPortrait ? portraitTag : landscapeTag;
      const fileName = `${prefix}${base}_${tag}.${ext}`;
      zip.file(fileName, p.stampedBlob as Blob);
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const zipName = `stamped_${new Date().toISOString().slice(0, 10)}.zip`;
    saveAs(blob, zipName);
  }, [previews, landscapePrefix, portraitPrefix, landscapeTag, portraitTag]);

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        <Grid  size={{ xs: 12, md: 4 }}>
          <SettingsPanel
            inputRef={inputRef}
            files={files}
            previews={previews}
            isRendering={isRendering}
            progress={progress}
            prefix={prefix}
            setPrefix={setPrefix}
            landscapePrefix={landscapePrefix}
            setLandscapePrefix={setLandscapePrefix}
            portraitPrefix={portraitPrefix}
            setPortraitPrefix={setPortraitPrefix}
            landscapeTag={landscapeTag}
            setLandscapeTag={setLandscapeTag}
            portraitTag={portraitTag}
            setPortraitTag={setPortraitTag}
            startNumber={startNumber}
            setStartNumber={setStartNumber}
            digits={digits}
            setDigits={setDigits}
            fontFamily={fontFamily}
            setFontFamily={setFontFamily}
            bold={bold}
            setBold={setBold}
            textColor={textColor}
            setTextColor={setTextColor}
            useBg={useBg}
            setUseBg={setUseBg}
            bgColor={bgColor}
            setBgColor={setBgColor}
            bgAlpha={bgAlpha}
            setBgAlpha={setBgAlpha}
            padding={padding}
            setPadding={setPadding}
            useShadow={useShadow}
            setUseShadow={setUseShadow}
            shadowAlpha={shadowAlpha}
            setShadowAlpha={setShadowAlpha}
            jpegQuality={jpegQuality}
            setJpegQuality={setJpegQuality}
            onPickFiles={onPickFiles}
            resetAll={resetAll}
            renderAll={() => void renderAll()}
            downloadZip={() => void downloadZip()}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <PreviewPanel previews={previews} />
        </Grid>
      </Grid>
    </Box>
  );
}
