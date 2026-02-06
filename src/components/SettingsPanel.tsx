import React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Divider,
  FormControlLabel,
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
import type { ProgressState, PreviewItem } from "../types";

type SettingsPanelProps = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  files: File[];
  previews: PreviewItem[];
  isRendering: boolean;
  progress: ProgressState;
  prefix: string;
  setPrefix: React.Dispatch<React.SetStateAction<string>>;
  landscapePrefix: string;
  setLandscapePrefix: React.Dispatch<React.SetStateAction<string>>;
  portraitPrefix: string;
  setPortraitPrefix: React.Dispatch<React.SetStateAction<string>>;
  landscapeTag: string;
  setLandscapeTag: React.Dispatch<React.SetStateAction<string>>;
  portraitTag: string;
  setPortraitTag: React.Dispatch<React.SetStateAction<string>>;
  startNumber: number;
  setStartNumber: React.Dispatch<React.SetStateAction<number>>;
  digits: number;
  setDigits: React.Dispatch<React.SetStateAction<number>>;
  fontFamily: string;
  setFontFamily: React.Dispatch<React.SetStateAction<string>>;
  bold: boolean;
  setBold: React.Dispatch<React.SetStateAction<boolean>>;
  textColor: string;
  setTextColor: React.Dispatch<React.SetStateAction<string>>;
  useBg: boolean;
  setUseBg: React.Dispatch<React.SetStateAction<boolean>>;
  bgColor: string;
  setBgColor: React.Dispatch<React.SetStateAction<string>>;
  bgAlpha: number;
  setBgAlpha: React.Dispatch<React.SetStateAction<number>>;
  padding: number;
  setPadding: React.Dispatch<React.SetStateAction<number>>;
  useShadow: boolean;
  setUseShadow: React.Dispatch<React.SetStateAction<boolean>>;
  shadowAlpha: number;
  setShadowAlpha: React.Dispatch<React.SetStateAction<number>>;
  jpegQuality: number;
  setJpegQuality: React.Dispatch<React.SetStateAction<number>>;
  onPickFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  resetAll: () => void;
  renderAll: () => void;
  downloadZip: () => void;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export default function SettingsPanel({
  inputRef,
  files,
  previews,
  isRendering,
  progress,
  prefix,
  setPrefix,
  landscapePrefix,
  setLandscapePrefix,
  portraitPrefix,
  setPortraitPrefix,
  landscapeTag,
  setLandscapeTag,
  portraitTag,
  setPortraitTag,
  startNumber,
  setStartNumber,
  digits,
  setDigits,
  fontFamily,
  setFontFamily,
  bold,
  setBold,
  textColor,
  setTextColor,
  useBg,
  setUseBg,
  bgColor,
  setBgColor,
  bgAlpha,
  setBgAlpha,
  padding,
  setPadding,
  useShadow,
  setUseShadow,
  shadowAlpha,
  setShadowAlpha,
  jpegQuality,
  setJpegQuality,
  onPickFiles,
  resetAll,
  renderAll,
  downloadZip,
}: SettingsPanelProps) {
  return (
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
              onClick={renderAll}
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
            helperText="画像左上の話数ラベル用（例：EP.）"
            fullWidth
          />

          <Stack direction="row" spacing={1}>
            <TextField
              label="横画像ファイル名Prefix"
              value={landscapePrefix}
              onChange={(e) => setLandscapePrefix(e.target.value)}
              helperText="例：No7_"
              fullWidth
            />
            <TextField
              label="縦画像ファイル名Prefix"
              value={portraitPrefix}
              onChange={(e) => setPortraitPrefix(e.target.value)}
              helperText="例：No8_"
              fullWidth
            />
          </Stack>

          <Stack direction="row" spacing={1}>
            <TextField
              label="横画像タグ"
              value={landscapeTag}
              onChange={(e) => setLandscapeTag(e.target.value)}
              helperText="例：Horizontal"
              fullWidth
            />
            <TextField
              label="縦画像タグ"
              value={portraitTag}
              onChange={(e) => setPortraitTag(e.target.value)}
              helperText="例：Vertical"
              fullWidth
            />
          </Stack>

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

          <TextField
            label="フォントファミリー"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            fullWidth
          />

          <FormControlLabel
            control={<Checkbox checked={bold} onChange={(e) => setBold(e.target.checked)} />}
            label="太字"
          />

          <Divider />

          <FormControlLabel
            control={<Checkbox checked={useBg} onChange={(e) => setUseBg(e.target.checked)} />}
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
            control={<Checkbox checked={useShadow} onChange={(e) => setUseShadow(e.target.checked)} />}
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

          <TextField
            label="JPEG品質"
            type="number"
            value={jpegQuality}
            onChange={(e) => setJpegQuality(clamp(Number(e.target.value || 0.92), 0.1, 1))}
            inputProps={{ min: 0.1, max: 1, step: 0.01 }}
            fullWidth
          />

          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={downloadZip}
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
  );
}
