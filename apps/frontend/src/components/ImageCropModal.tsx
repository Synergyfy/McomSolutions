import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, ZoomIn, ZoomOut, Crop, ImageIcon } from 'lucide-react';

interface ImageCropModalProps {
  open: boolean;
  imageSrc: string;
  aspect: number;
  title?: string;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
  onSkip: () => void;
}

function getCroppedImg(imageSrc: string, pixelCrop: { x: number; y: number; width: number; height: number }): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    image.src = imageSrc;
  });
}

export default function ImageCropModal({
  open,
  imageSrc,
  aspect,
  title = 'Crop Image',
  onCancel,
  onApply,
  onSkip,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const onCropComplete = useCallback((_: any, croppedPixels: { x: number; y: number; width: number; height: number }) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    const dataUrl = await getCroppedImg(imageSrc, croppedAreaPixels);
    onApply(dataUrl);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 backdrop-blur-md bg-black/50"
          />
          <motion.div
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative z-10 flex flex-col overflow-hidden"
          >
            <div className="h-2 bg-gradient-to-r from-cyan-500 to-blue-500 shrink-0" />

            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h3 className="text-lg font-bold text-gray-900">{title}</h3>
              <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="relative w-full aspect-square mx-auto bg-gray-900 overflow-hidden" style={{ maxHeight: '340px' }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="rect"
                showGrid={true}
                style={{
                  containerStyle: { borderRadius: '12px' },
                  cropAreaStyle: { border: '2px solid rgba(255,255,255,0.8)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' },
                }}
              />
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <ZoomOut className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
                <ZoomIn className="w-4 h-4 text-gray-400 shrink-0" />
              </div>

              <p className="text-xs text-gray-400 text-center">Drag to reposition, pinch or use the slider to zoom</p>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={onSkip}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Use Original
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <Crop className="w-3.5 h-3.5" />
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
