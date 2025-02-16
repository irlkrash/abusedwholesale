import { Product } from "@shared/schema";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductCarousel } from "./product-carousel";

interface ProductCardProps {
  product: Product;
  onAddToCart: () => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <ProductCarousel images={product.images} />
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
    </Card>
  );
}