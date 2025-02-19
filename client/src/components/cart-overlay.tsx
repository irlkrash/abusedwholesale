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
import { Product, CartItem } from "@shared/schema";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CartOverlayProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  items: Product[];
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
    try {
      setIsSubmitting(true);
      const cartItems = items.map(item => ({
        productId: item.id,
        name: item.name,
        description: item.description,
        images: item.images
      }));

      await apiRequest("POST", "/api/carts", {
        customerName,
        customerEmail,
        items: cartItems,
      });

      toast({
        title: "Cart submitted successfully!",
        description: "We'll review your cart items and contact you soon.",
      });

      onClearCart();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Failed to submit cart",
        description: "Please try again later.",
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
              key={item.id}
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
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveItem(item.id)}
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
          />
          <Input
            type="email"
            placeholder="Your Email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
          />
        </div>

        <SheetFooter className="mt-4">
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button 
            onClick={handleSubmitCart}
            disabled={!customerName || !customerEmail || items.length === 0 || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Cart"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}