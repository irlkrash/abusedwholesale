import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ProductCarouselProps {
  images: string[];
  onImageClick?: (image: string) => void;
  priority?: boolean;
  loading?: "eager" | "lazy";
  className?: string;
}

export function ProductCarousel({ 
  images, 
  onImageClick, 
  priority = false,
  loading: loadingProp,
  className 
}: ProductCarouselProps) {
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  const handleImageLoad = (index: number) => {
    setLoadedImages(prev => new Set([...prev, index]));
  };

  return (
    <Carousel className={cn("relative w-full h-full", className)}>
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
                  loading={loadingProp || (index === 0 || priority ? "eager" : "lazy")}
                  width={600}
                  height={600}
                  className={cn(
                    "object-cover w-full h-full rounded-lg cursor-pointer transition-opacity duration-200",
                    !loadedImages.has(index) && "opacity-0",
                    "hover:opacity-90"
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
      <CarouselPrevious className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6" />
      <CarouselNext className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" />
    </Carousel>
  );
}