import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Divider,
  FormControlLabel,
  Grid,
  InputAdornment,
  LinearProgress,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import JSZip from "jszip";
import { saveAs } from "file-saver";

type OutputFormat = "png" | "jpeg";

type PreviewItem = {
  id: string;
  name: string;
  originalUrl: string;
  stampedUrl: string;
  stampedBlob: Blob | null;
  label: string;
  error?: string;
};

type ProgressState = { done: number; total: number };

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
  const [prefix, setPrefix] = useState<string>("EP ");
  const [startNumber, setStartNumber] = useState<number>(1);
  const [digits, setDigits] = useState<number>(2);

  const [fontSize, setFontSize] = useState<number>(64);
  const [fontFamily, setFontFamily] = useState<string>(
    "Noto Sans JP, system-ui, -apple-system, Segoe UI, Arial"
  );
  const [bold, setBold] = useState<boolean>(true);
  const [textColor, setTextColor] = useState<string>("#ffffff");

  const [useBg, setUseBg] = useState<boolean>(true);
  const [bgColor, setBgColor] = useState<string>("#000000");
  const [bgAlpha, setBgAlpha] = useState<number>(0.55);
  const [padding, setPadding] = useState<number>(18);

  const [useShadow, setUseShadow] = useState<boolean>(true);
  const [shadowAlpha, setShadowAlpha] = useState<number>(0.6);

  const [offsetX, setOffsetX] = useState<number>(30);
  const [offsetY, setOffsetY] = useState<number>(30);

  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");
  const [jpegQuality, setJpegQuality] = useState<number>(0.92);

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
    setProgress({ done: 0, total: sortedFiles.length });

    try {
      const next: PreviewItem[] = [];

      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i];
        const originalUrl = URL.createObjectURL(file);

        let img: HTMLImageElement;
        try {
          img = await fileToImage(file);
        } catch {
          next.push({
            id: `${file.name}-${i}`,
            name: file.name,
            originalUrl,
            stampedUrl: "",
            stampedBlob: null,
            label: "",
            error: "画像の読み込みに失敗しました",
          });
          setProgress((p) => ({ ...p, done: i + 1 }));
          continue;
        }

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          next.push({
            id: `${file.name}-${i}`,
            name: file.name,
            originalUrl,
            stampedUrl: "",
            stampedBlob: null,
            label: "",
            error: "Canvasの初期化に失敗しました",
          });
          setProgress((p) => ({ ...p, done: i + 1 }));
          continue;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const num = startNumber + i;
        const label = `${prefix}${padNumber(num, digits)}`;

        const weight = bold ? "700" : "400";
        ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
        ctx.textBaseline = "top";
        ctx.textAlign = "left";

        const metrics = ctx.measureText(label);
        const textW = metrics.width;
        const textH = fontSize * 1.1;

        const x = clamp(offsetX, 0, canvas.width - 1);
        const y = clamp(offsetY, 0, canvas.height - 1);

        if (useBg) {
          const rectW = textW + padding * 2;
          const rectH = textH + padding * 2;
          ctx.fillStyle = hexToRgba(bgColor, bgAlpha);
          ctx.fillRect(x, y, rectW, rectH);
        }

        if (useShadow) {
          ctx.shadowColor = `rgba(0,0,0,${shadowAlpha})`;
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        } else {
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        ctx.fillStyle = textColor;
        ctx.fillText(label, x + padding, y + padding);

        const mime = outputFormat === "jpeg" ? "image/jpeg" : "image/png";
        const blob = await canvasToBlob(canvas, mime, jpegQuality);
        const stampedUrl = URL.createObjectURL(blob);

        next.push({
          id: `${file.name}-${i}`,
          name: file.name,
          originalUrl,
          stampedUrl,
          stampedBlob: blob,
          label,
        });

        setProgress((p) => ({ ...p, done: i + 1 }));
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
    fontSize,
    fontFamily,
    bold,
    textColor,
    useBg,
    bgColor,
    bgAlpha,
    padding,
    useShadow,
    shadowAlpha,
    offsetX,
    offsetY,
    outputFormat,
    jpegQuality,
  ]);

  useEffect(() => {
    if (files.length) void renderAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const downloadZip = useCallback(async () => {
    const valid = previews.filter((p) => p.stampedBlob);
    if (!valid.length) return;

    const zip = new JSZip();
    valid.forEach((p, idx) => {
      const base = p.name.replace(/\.[^.]+$/, "");
      const ext = outputFormat === "jpeg" ? "jpg" : "png";
      const n = padNumber(startNumber + idx, digits);
      const fileName = `${n}_${base}.${ext}`;
      zip.file(fileName, p.stampedBlob as Blob);
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const zipName = `stamped_${new Date().toISOString().slice(0, 10)}.zip`;
    saveAs(blob, zipName);
  }, [previews, outputFormat, startNumber, digits]);

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        <Grid  size={{ xs: 12, md: 4 }}>
          <Card>
            <CardHeader
              title="スタンプ設定"
              subheader="複数画像をファイル名順で処理し、左上に話数スタンプを付けてZIPでDL"
            />
            <CardContent>
              <Stack spacing={2}>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onPickFiles}
                  style={{ display: "none" }}
                />

                <Button
                  variant="contained"
                  startIcon={<UploadFileIcon />}
                  onClick={() => inputRef.current?.click()}
                >
                  画像を選択（複数可）
                </Button>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={resetAll}
                    disabled={!files.length && !previews.length}
                    fullWidth
                  >
                    リセット
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => void renderAll()}
                    disabled={!files.length || isRendering}
                    fullWidth
                  >
                    再生成
                  </Button>
                </Stack>

                <Divider />

                <TextField
                  label="プレフィックス"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  helperText="例：EP / 第 / # など"
                  fullWidth
                />

                <Stack direction="row" spacing={1}>
                  <TextField
                    label="開始番号"
                    type="number"
                    value={startNumber}
                    onChange={(e) => setStartNumber(Number(e.target.value || 1))}
                    fullWidth
                    inputProps={{ min: 0 }}
                  />
                  <TextField
                    label="桁数"
                    type="number"
                    value={digits}
                    onChange={(e) => setDigits(clamp(Number(e.target.value || 2), 1, 6))}
                    fullWidth
                    inputProps={{ min: 1, max: 6 }}
                  />
                </Stack>

                <Stack direction="row" spacing={1}>
                  <TextField
                    label="フォントサイズ(px)"
                    type="number"
                    value={fontSize}
                    onChange={(e) => setFontSize(clamp(Number(e.target.value || 64), 8, 400))}
                    fullWidth
                    inputProps={{ min: 8, max: 400 }}
                  />
                  <TextField
                    label="文字色"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    fullWidth
                    InputProps={{
                      startAdornment: <InputAdornment position="start">#</InputAdornment>,
                    }}
                    helperText="例：#ffffff"
                    onBlur={() => {
                      const v = textColor.startsWith("#") ? textColor : `#${textColor}`;
                      setTextColor(v);
                    }}
                  />
                </Stack>

                <TextField
                  label="フォントファミリー"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  fullWidth
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={bold}
                      onChange={(e) => setBold(e.target.checked)}
                    />
                  }
                  label="太字"
                />

                <Divider />

                <Typography variant="subtitle2">配置（左上からのオフセット）</Typography>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="X"
                    type="number"
                    value={offsetX}
                    onChange={(e) => setOffsetX(Math.max(0, Number(e.target.value || 0)))}
                    fullWidth
                  />
                  <TextField
                    label="Y"
                    type="number"
                    value={offsetY}
                    onChange={(e) => setOffsetY(Math.max(0, Number(e.target.value || 0)))}
                    fullWidth
                  />
                </Stack>

                <Divider />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useBg}
                      onChange={(e) => setUseBg(e.target.checked)}
                    />
                  }
                  label="背景ボックスを付ける"
                />

                {useBg && (
                  <>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        label="背景色"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        fullWidth
                        onBlur={() => {
                          const v = bgColor.startsWith("#") ? bgColor : `#${bgColor}`;
                          setBgColor(v);
                        }}
                      />
                      <TextField
                        label="余白(px)"
                        type="number"
                        value={padding}
                        onChange={(e) => setPadding(clamp(Number(e.target.value || 18), 0, 200))}
                        fullWidth
                      />
                    </Stack>

                    <Typography variant="body2">背景透明度</Typography>
                    <Slider
                      value={bgAlpha}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(_, v) => setBgAlpha(v as number)}
                      valueLabelDisplay="auto"
                    />
                  </>
                )}

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useShadow}
                      onChange={(e) => setUseShadow(e.target.checked)}
                    />
                  }
                  label="文字影（読みやすさ）"
                />

                {useShadow && (
                  <>
                    <Typography variant="body2">影の濃さ</Typography>
                    <Slider
                      value={shadowAlpha}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(_, v) => setShadowAlpha(v as number)}
                      valueLabelDisplay="auto"
                    />
                  </>
                )}

                <Divider />

                <Stack direction="row" spacing={1}>
                  <TextField
                    label="出力形式"
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value === "jpeg" ? "jpeg" : "png")}
                    select
                    SelectProps={{ native: true }}
                    fullWidth
                  >
                    <option value="png">PNG（劣化なし）</option>
                    <option value="jpeg">JPEG（軽い）</option>
                  </TextField>
                  <TextField
                    label="JPEG品質"
                    type="number"
                    value={jpegQuality}
                    disabled={outputFormat !== "jpeg"}
                    onChange={(e) => setJpegQuality(clamp(Number(e.target.value || 0.92), 0.1, 1))}
                    inputProps={{ min: 0.1, max: 1, step: 0.01 }}
                    fullWidth
                  />
                </Stack>

                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={() => void downloadZip()}
                  disabled={!previews.length || isRendering}
                >
                  ZIPで一括ダウンロード
                </Button>

                {isRendering && (
                  <Box>
                    <LinearProgress
                      variant="determinate"
                      value={(progress.done / Math.max(progress.total, 1)) * 100}
                    />
                    <Typography variant="caption">
                      生成中… {progress.done}/{progress.total}
                    </Typography>
                  </Box>
                )}

                <Typography variant="caption" color="text.secondary">
                  ※ ブラウザ上で処理します。大量/高解像度だと重いので必要なら最適化（WebWorker / リサイズ）追加可能。
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader
              title={`プレビュー (${previews.length})`}
              subheader="スタンプ済み画像"
            />
            <CardContent>
              {!previews.length ? (
                <Typography color="text.secondary">
                  画像を選択すると自動で生成・プレビュー表示されます。
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {previews.map((p) => (
                    <Grid size={{ xs: 12, md: 6 }} key={p.id}>
                      <Box
                        sx={{
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                          overflow: "hidden",
                        }}
                      >
                        <Box sx={{ p: 1, bgcolor: "background.default" }}>
                          <Typography variant="caption" sx={{ display: "block" }} noWrap title={p.name}>
                            {p.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap title={p.label}>
                            {p.label || "—"}
                          </Typography>
                        </Box>

                        <Box sx={{ aspectRatio: "4/3", bgcolor: "black" }}>
                          {p.error ? (
                            <Box sx={{ p: 2 }}>
                              <Typography color="error" variant="body2">
                                {p.error}
                              </Typography>
                            </Box>
                          ) : (
                            <img
                              src={p.stampedUrl}
                              alt={p.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                display: "block",
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
