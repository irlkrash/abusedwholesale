import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
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
  const [customerEmail, setCustomerEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitCart = async () => {
    if (!customerName || !customerEmail || items.length === 0) {
      toast({
        title: "Invalid submission",
        description: "Please fill in all required fields and add items to cart",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare cart items with required fields
      const cartItems = items.map(item => ({
        productId: item.productId,
        name: item.name || 'Unknown Product',
        description: item.description || 'No description available',
        images: item.images || [],
        fullImages: item.fullImages || [],
        isAvailable: true,
        createdAt: new Date().toISOString()
      }));

      const payload = {
        customerName,
        customerEmail,
        items: cartItems
      };

      console.log('Submitting cart with payload:', payload);

      const response = await apiRequest("POST", "/api/carts", payload);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Cart submission failed:', errorText);
        throw new Error(errorText || 'Failed to submit cart');
      }

      const result = await response.json();
      console.log('Cart submission successful:', result);

      toast({
        title: "Cart submitted successfully!",
        description: "We'll review your cart items and contact you soon.",
      });

      onClearCart();
      onOpenChange(false);
      setCustomerName("");
      setCustomerEmail("");
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
            Review your selected items before submitting.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[50vh] my-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex items-center justify-between py-4 border-b"
            >
              <div className="flex items-center gap-4">
                <img
                  src={item.images[0]}
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded"
                />
                <div>
                  <h4 className="font-medium">{item.name}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveItem(item.productId)}
              >
                Remove
              </Button>
            </div>
          ))}
        </ScrollArea>

        <div className="space-y-4 mt-4">
          <Input
            placeholder="Your Name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
          <Input
            type="email"
            placeholder="Your Email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
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
              disabled={!customerName || !customerEmail || items.length === 0 || isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Cart"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}