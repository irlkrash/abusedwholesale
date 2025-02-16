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
import { Product } from "@shared/schema";
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

  const handleSubmitOrder = async () => {
    try {
      await apiRequest("POST", "/api/orders", {
        customerName,
        customerEmail,
        items: items.map(item => ({ 
          productId: item.id,
          name: item.name
        })),
      });
      
      toast({
        title: "Order submitted successfully!",
        description: "We'll contact you soon about your wholesale order.",
      });
      
      onClearCart();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Failed to submit order",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Your Cart</SheetTitle>
          <SheetDescription>
            Review your selected items before submitting your wholesale order.
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
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
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
            onClick={handleSubmitOrder}
            disabled={!customerName || !customerEmail || items.length === 0}
          >
            Submit Order
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
