import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface ProductCarouselProps {
  images: string[];
  onImageClick?: (image: string) => void;
  priority?: boolean;
}

export function ProductCarousel({ images, onImageClick, priority = false }: ProductCarouselProps) {
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());

  // Preload next and previous images
  useEffect(() => {
    const preloadImage = (src: string) => {
      if (!preloadedImages.has(src)) {
        const img = new Image();
        img.src = src;
        img.onload = () => {
          setPreloadedImages(prev => new Set(Array.from(prev).concat([src])));
        };
      }
    };

    images.forEach((image, index) => {
      // Preload current image and next 2 images
      if (index < 3) {
        preloadImage(image);
      }
    });
  }, [images, preloadedImages]);

  const handleImageLoad = (index: number) => {
    setLoadedImages(prev => new Set(Array.from(prev).concat([index])));

    // Preload next image when current one loads
    if (index < images.length - 1) {
      const nextImage = images[index + 1];
      if (!preloadedImages.has(nextImage)) {
        const img = new Image();
        img.src = nextImage;
        img.onload = () => {
          setPreloadedImages(prev => new Set(Array.from(prev).concat([nextImage])));
        };
      }
    }
  };

  return (
    <Carousel className="relative">
      <CarouselContent>
        {images.map((image, index) => (
          <CarouselItem key={index}>
            <AspectRatio ratio={1}>
              <div className="relative w-full h-full">
                <div 
                  className={cn(
                    "absolute inset-0 bg-muted animate-pulse",
                    loadedImages.has(index) && "hidden"
                  )}
                />
                <img 
                  src={image} 
                  alt={`Product view ${index + 1}`}
                  loading={index === 0 || priority ? "eager" : "lazy"}
                  width={600}
                  height={600}
                  className={cn(
                    "object-cover w-full h-full rounded-t-lg cursor-pointer transition-opacity duration-200",
                    !loadedImages.has(index) && "opacity-0",
                    "hover:opacity-90 transition-opacity"
                  )}
                  onClick={() => onImageClick?.(image)}
                  onLoad={() => handleImageLoad(index)}
                  decoding="async"
                />
              </div>
            </AspectRatio>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="absolute left-2 top-1/2" />
      <CarouselNext className="absolute right-2 top-1/2" />
    </Carousel>
  );
}