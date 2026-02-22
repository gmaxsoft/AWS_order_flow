import { useState, useEffect } from 'react';
import { Package, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { fetchProducts, createOrder } from '@/lib/api';

interface Product {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

interface ProductsListProps {
  onOrderPlaced: (orderId: string, executionArn: string) => void;
}

export function ProductsList({ onOrderPlaced }: ProductsListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts()
      .then((data: { products?: Product[] }) => setProducts(data.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const handleOrder = async (product: Product) => {
    if (product.quantity <= 0) return;
    setOrdering(product.productId);
    try {
      const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { executionArn } = await createOrder({
        orderId,
        customerId: 'cust-dashboard',
        items: [{ productId: product.productId, quantity: 1, unitPrice: product.price }],
        totalAmount: product.price,
      });
      onOrderPlaced(orderId, executionArn);
    } catch (err) {
      console.error(err);
    } finally {
      setOrdering(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-slate-500">Loading products...</p>
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-slate-500">No products in inventory. Add items to DynamoDB.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Package className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Products</h2>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {products.map((product) => (
            <li
              key={product.productId}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-slate-500">
                  {product.productId} · ${product.price.toFixed(2)}
                </p>
                <Badge variant={product.quantity > 0 ? 'secondary' : 'destructive'} className="mt-2">
                  {product.quantity > 0 ? `${product.quantity} in stock` : 'Out of stock'}
                </Badge>
              </div>
              <Button
                size="sm"
                onClick={() => handleOrder(product)}
                disabled={product.quantity <= 0 || ordering === product.productId}
              >
                {ordering === product.productId ? (
                  'Ordering...'
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    Order Now
                  </>
                )}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
