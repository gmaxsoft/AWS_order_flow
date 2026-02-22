import { useState, useEffect } from 'react';
import { LayoutDashboard, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { fetchOrders } from '@/lib/api';

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

interface Order {
  id: string;
  customerId: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

export function ManagerDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = () => {
    setLoading(true);
    fetchOrders()
      .then((data: { orders?: Order[] }) => setOrders(data.orders ?? []))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch');
        setOrders([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Manager Dashboard</h2>
        </div>
        <Button variant="outline" size="sm" onClick={loadOrders} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading && orders.length === 0 ? (
          <p className="text-slate-500 text-sm">Loading orders...</p>
        ) : error ? (
          <p className="text-sm text-amber-600">
            {error} – Ensure PostgreSQL is configured and tables exist.
          </p>
        ) : orders.length === 0 ? (
          <p className="text-slate-500 text-sm">No orders yet.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Last 10 orders</p>
            <ul className="space-y-3">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{order.id}</span>
                    <Badge
                      variant={
                        order.status === 'confirmed' ? 'success' : order.status === 'cancelled' ? 'destructive' : 'secondary'
                      }
                    >
                      {order.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    Customer: {order.customerId} · ${order.totalAmount.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                  {order.items?.length > 0 && (
                    <ul className="text-xs text-slate-500 mt-1">
                      {order.items.map((item, i) => (
                        <li key={i}>
                          {item.productId} × {item.quantity} @ ${item.unitPrice}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
