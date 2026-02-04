import React from "react";
import { Box, Card, CardContent, CardHeader, Grid, Stack, Typography } from "@mui/material";
import type { PreviewItem } from "../types";

type PreviewPanelProps = {
  previews: PreviewItem[];
};

type PreviewCardProps = {
  item: PreviewItem;
};

function PreviewCard({ item }: PreviewCardProps) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 1, bgcolor: "background.default" }}>
        <Typography variant="caption" sx={{ display: "block" }} noWrap title={item.name}>
          {item.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {item.sizeLabel}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap title={item.label}>
          {item.label || "—"}
        </Typography>
      </Box>

      <Box sx={{ aspectRatio: `${item.width} / ${item.height}`, bgcolor: "black" }}>
        {item.error ? (
          <Box sx={{ p: 2 }}>
            <Typography color="error" variant="body2">
              {item.error}
            </Typography>
          </Box>
        ) : (
          <img
            src={item.stampedUrl}
            alt={item.name}
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
  );
}

export default function PreviewPanel({ previews }: PreviewPanelProps) {
  return (
    <Card>
      <CardHeader title={`プレビュー (${previews.length})`} subheader="スタンプ済み画像" />
      <CardContent>
        {!previews.length ? (
          <Typography color="text.secondary">
            画像を選択すると自動で生成・プレビュー表示されます。
          </Typography>
        ) : (
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                1920x1080
              </Typography>
              <Grid container spacing={2}>
                {previews
                  .filter((p) => p.width === 1920 && p.height === 1080)
                  .map((p) => (
                    <Grid size={{ xs: 12, md: 6 }} key={p.id}>
                      <PreviewCard item={p} />
                    </Grid>
                  ))}
              </Grid>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                500x750
              </Typography>
              <Grid container spacing={2}>
                {previews
                  .filter((p) => p.width === 500 && p.height === 750)
                  .map((p) => (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} key={p.id}>
                      <PreviewCard item={p} />
                    </Grid>
                  ))}
              </Grid>
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
