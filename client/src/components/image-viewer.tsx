import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ZoomIn, ZoomOut, RotateCw, X, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface ImageViewerProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Position {
  x: number;
  y: number;
}

export function ImageViewer({ src, alt, isOpen, onOpenChange }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<Position | null>(null);

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
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    }
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && dragStart.current) {
      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;
      setPosition({ x: newX, y: newY });
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] md:w-[70vw] lg:w-[50vw] h-[90vh] p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Image Viewer</DialogTitle>
        </DialogHeader>

        {/* Controls */}
        <div className="absolute top-0 right-0 flex justify-end gap-1 md:gap-2 z-10 p-2 md:p-4 bg-background/80 backdrop-blur-sm">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomIn}
            className="h-8 w-8 md:h-10 md:w-10"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
            <VisuallyHidden>Zoom In</VisuallyHidden>
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomOut}
            className="h-8 w-8 md:h-10 md:w-10"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
            <VisuallyHidden>Zoom Out</VisuallyHidden>
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleRotate}
            className="h-8 w-8 md:h-10 md:w-10"
            title="Rotate"
          >
            <RotateCw className="h-4 w-4" />
            <VisuallyHidden>Rotate</VisuallyHidden>
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={resetView}
            className="h-8 w-8 md:h-10 md:w-10"
            title="Reset View"
          >
            <Maximize2 className="h-4 w-4" />
            <VisuallyHidden>Reset View</VisuallyHidden>
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 md:h-10 md:w-10"
            title="Close"
          >
            <X className="h-4 w-4" />
            <VisuallyHidden>Close</VisuallyHidden>
          </Button>
        </div>

        {/* Image Container */}
        <div 
          className="h-[calc(90vh-4rem)] w-full flex items-center justify-center bg-black/5 dark:bg-white/5 mt-16"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {!isImageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <img
            src={src}
            alt={alt}
            className="max-w-[90%] max-h-[calc(90vh-8rem)] object-contain transition-transform duration-200 ease-out select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
              opacity: isImageLoaded ? 1 : 0,
              cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
            }}
            onLoad={() => setIsImageLoaded(true)}
            onMouseDown={handleMouseDown}
            draggable={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}