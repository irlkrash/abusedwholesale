import { useState } from "react";
import { Product } from "@shared/schema";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductCarousel } from "./product-carousel";
import { ImageViewer } from "./image-viewer";

interface ProductCardProps {
  product: Product;
  onAddToCart: () => void;
  priority?: boolean;
}

export function ProductCard({ product, onAddToCart, priority = false }: ProductCardProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <CardContent className="p-0">
        <ProductCarousel 
          images={product.images} 
          onImageClick={(image) => setSelectedImage(image)}
          priority={priority}
        />
      </CardContent>
      <CardFooter className="p-6">
        <Button 
          onClick={onAddToCart}
          disabled={!product.isAvailable}
          className="w-full"
        >
          {product.isAvailable ? "Add to Cart" : "Currently Unavailable"}
        </Button>
      </CardFooter>

      {selectedImage && (
        <ImageViewer
          src={selectedImage}
          alt={product.name}
          isOpen={!!selectedImage}
          onOpenChange={(open) => !open && setSelectedImage(null)}
        />
      )}
    </Card>
  );
}