import { useState } from 'react';
import { Package } from 'lucide-react';
import { ProductsList } from '@/components/ProductsList';
import { LiveOrderStatus } from '@/components/LiveOrderStatus';
import { ManagerDashboard } from '@/components/ManagerDashboard';

function App() {
  const [activeOrder, setActiveOrder] = useState<{ orderId: string; executionArn: string } | null>(null);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center gap-2">
          <Package className="h-8 w-8 text-slate-900" />
          <h1 className="text-xl font-bold">AWS Order Flow</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          <section>
            <ProductsList onOrderPlaced={(orderId: string, executionArn: string) => setActiveOrder({ orderId, executionArn })} />
          </section>

          <section>
            <LiveOrderStatus
              executionArn={activeOrder?.executionArn ?? null}
              orderId={activeOrder?.orderId ?? null}
            />
          </section>

          <section>
            <ManagerDashboard />
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
