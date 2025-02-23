import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CartItem } from "@shared/schema";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CartOverlayProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  onRemoveItem: (productId: number) => void;
  onClearCart: () => void;
}

export function CartOverlay({
  isOpen,
  onOpenChange,
  items,
  onRemoveItem,
  onClearCart,
}: CartOverlayProps) {
  const { toast } = useToast();
  const [customerName, setCustomerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate total price based on item.price
  const totalPrice = items.reduce((sum, item) => {
    return sum + Math.round(Number(item.price || 0));
  }, 0);

  const handleSubmitCart = async () => {
    if (!customerName || items.length === 0) {
      toast({
        title: "Invalid submission",
        description: "Please enter your name and add items to cart",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Simplify the cart items to only include necessary fields
      const cartItems = items.map(item => ({
        productId: item.productId,
        price: Math.round(Number(item.price || 0))  // Ensure price is a number
      }));

      const payload = {
        customerName: customerName.trim(),
        items: cartItems
      };

      const response = await apiRequest("POST", "/api/carts", payload);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit cart');
      }

      toast({
        title: "Cart submitted successfully!",
        description: "We'll review your cart items and contact you soon.",
      });

      onClearCart();
      onOpenChange(false);
      setCustomerName("");

    } catch (error) {
      console.error('Cart submission error:', error);
      toast({
        title: "Failed to submit cart",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Your Cart</SheetTitle>
          <SheetDescription>
            Total Price: ${totalPrice}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[50vh] my-4">
          {items.map((item) => {
            const formattedPrice = Math.round(Number(item.price || 0));

            return (
              <div
                key={item.productId}
                className="flex items-center justify-between py-4 border-b"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={item.images[0]}
                    alt="Product thumbnail"
                    className="w-16 h-16 object-cover rounded"
                  />
                  <span className="text-lg font-semibold">${formattedPrice}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveItem(item.productId)}
                >
                  Remove
                </Button>
              </div>
            );
          })}
        </ScrollArea>

        <div className="space-y-4 mt-4">
          <Input
            placeholder="Your Name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
        </div>

        <SheetFooter className="mt-4">
          <div className="flex gap-2 justify-end w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitCart}
              disabled={!customerName || items.length === 0 || isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Cart"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}