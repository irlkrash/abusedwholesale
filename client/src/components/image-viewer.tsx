import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ZoomIn, ZoomOut, RotateCw, X, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageViewerProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageViewer({ src, alt, isOpen, onOpenChange }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const resetView = () => {
    setScale(1);
    setRotation(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[50vw] max-h-[80vh] p-0 overflow-hidden">
        <div className="relative h-full flex flex-col">
          {/* Controls */}
          <div className="sticky top-4 right-4 flex justify-end gap-2 z-10 px-4">
            <Button
              variant="secondary"
              size="icon"
              onClick={handleZoomIn}
              className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={handleZoomOut}
              className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={handleRotate}
              className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
              title="Rotate"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={resetView}
              className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
              title="Reset View"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Image Container */}
          <div className="flex-1 overflow-auto">
            <div className="min-h-full w-full flex items-center justify-center bg-black/5 dark:bg-white/5 p-4">
              {!isImageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <img
                src={src}
                alt={alt}
                className="max-w-full object-contain transition-all duration-200 ease-out"
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  opacity: isImageLoaded ? 1 : 0,
                }}
                onLoad={() => setIsImageLoaded(true)}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}