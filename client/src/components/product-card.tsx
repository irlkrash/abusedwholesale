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
  showDetails?: boolean;
}

export function ProductCard({ product, onAddToCart, priority = false, showDetails = false }: ProductCardProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);

  // Calculate the effective price (custom price or lowest category price)
  const effectivePrice = product.customPrice ?? 
    (product.categories?.length 
      ? Math.min(...product.categories.map(cat => Number(cat.defaultPrice)))
      : 0);

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
          {showDetails && (
            <>
              <h3 className="font-semibold text-lg">{product.name}</h3>
              <p className="text-muted-foreground text-sm mt-1">{product.description}</p>
            </>
          )}
          <div className="mt-2">
            <span className="text-lg font-bold">${effectivePrice}</span>
          </div>
          {product.categories && product.categories.length > 0 && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-1">
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