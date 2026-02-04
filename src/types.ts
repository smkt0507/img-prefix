export type PreviewItem = {
  id: string;
  name: string;
  originalUrl: string;
  stampedUrl: string;
  stampedBlob: Blob | null;
  label: string;
  sequenceNumber: number;
  width: number;
  height: number;
  sizeLabel: string;
  error?: string;
};

export type ProgressState = { done: number; total: number };
