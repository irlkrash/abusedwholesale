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
        <div className="p-6">
          <h3 className="text-lg font-semibold">{product.name}</h3>
          <p className="text-sm text-muted-foreground mt-2">{product.description}</p>
        </div>
      </CardContent>
      <CardFooter className="p-6 pt-0">
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
