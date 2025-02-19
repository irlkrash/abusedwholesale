import { useState } from "react";
import { Product } from "@shared/schema";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductCarousel } from "./product-carousel";
import { ImageViewer } from "./image-viewer";
import { Badge } from "@/components/ui/badge";

interface ProductCardProps {
  product: Product;
  onAddToCart: () => void;
  priority?: boolean;
}

export function ProductCard({ product, onAddToCart, priority = false }: ProductCardProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <CardContent className="p-0">
        <div className="relative">
          <ProductCarousel 
            images={product.images} 
            onImageClick={(image, index) => {
              setSelectedImage(image);
              setSelectedFullImage(product.fullImages?.[index] || image);
            }}
            priority={priority}
            loading="lazy"
          />
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground">{product.description}</p>
          {product.categories?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {product.categories.map((category) => (
                <Badge
                  key={category.id}
                  variant="secondary"
                  className="text-xs"
                >
                  {category.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
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
          fullSrc={selectedFullImage || selectedImage}
          alt={product.name}
          isOpen={!!selectedImage}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedImage(null);
              setSelectedFullImage(null);
            }
          }}
        />
      )}
    </Card>
  );
}