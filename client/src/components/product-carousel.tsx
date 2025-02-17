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
}

export function ProductCarousel({ images, onImageClick }: ProductCarouselProps) {
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  const handleImageLoad = (index: number) => {
    setLoadedImages(prev => new Set([...prev, index]));
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
                  loading={index === 0 ? "eager" : "lazy"}
                  width={400}
                  height={400}
                  className={cn(
                    "object-cover w-full h-full rounded-t-lg cursor-pointer transition-opacity duration-200",
                    !loadedImages.has(index) && "opacity-0"
                  )}
                  onClick={() => onImageClick?.(image)}
                  onLoad={() => handleImageLoad(index)}
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