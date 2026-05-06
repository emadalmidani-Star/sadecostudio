import { useCallback, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface Props {
  file: File | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  onSkip: () => void;
}

async function getCroppedBlob(src: string, area: Area, fileType: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const canvas = document.createElement("canvas");
  const size = 1200;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), fileType || "image/jpeg", 0.92));
}

export default function ImageCropDialog({ file, onCancel, onConfirm, onSkip }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPx, setAreaPx] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const url = file ? URL.createObjectURL(file) : null;

  const onComplete = useCallback((_: Area, px: Area) => setAreaPx(px), []);

  async function confirm() {
    if (!url || !areaPx || !file) return;
    setBusy(true);
    const blob = await getCroppedBlob(url, areaPx, file.type);
    setBusy(false);
    onConfirm(blob);
  }

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop image — {file?.name}</DialogTitle>
        </DialogHeader>
        <div className="relative w-full h-[400px] bg-muted rounded overflow-hidden">
          {url && (
            <Cropper
              image={url}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onComplete}
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <Slider min={1} max={4} step={0.1} value={[zoom]} onValueChange={([v]) => setZoom(v)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="outline" onClick={onSkip}>Skip crop</Button>
          <Button onClick={confirm} disabled={busy}>{busy ? "Cropping…" : "Crop & Upload"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
