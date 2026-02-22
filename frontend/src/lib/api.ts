const API_BASE = import.meta.env.VITE_API_URL ?? '';

export async function fetchProducts() {
  const res = await fetch(`${API_BASE}/products`);
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

export async function createOrder(order: {
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
}) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });
  if (!res.ok) throw new Error('Failed to create order');
  return res.json();
}

export async function fetchOrderStatus(executionArn: string) {
  const res = await fetch(
    `${API_BASE}/orders/status?executionArn=${encodeURIComponent(executionArn)}`
  );
  if (!res.ok) throw new Error('Failed to fetch order status');
  return res.json();
}

export async function fetchOrders() {
  const res = await fetch(`${API_BASE}/orders/list`);
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
}
