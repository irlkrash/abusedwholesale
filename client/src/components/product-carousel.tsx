import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface ProductCarouselProps {
  images: string[];
}

export function ProductCarousel({ images }: ProductCarouselProps) {
  return (
    <Carousel className="relative">
      <CarouselContent>
        {images.map((image, index) => (
          <CarouselItem key={index}>
            <AspectRatio ratio={1}>
              <img 
                src={image} 
                alt={`Product view ${index + 1}`}
                className="object-cover w-full h-full rounded-t-lg"
              />
            </AspectRatio>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="absolute left-2 top-1/2" />
      <CarouselNext className="absolute right-2 top-1/2" />
    </Carousel>
  );
}