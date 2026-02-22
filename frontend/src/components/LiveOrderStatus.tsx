import { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { fetchOrderStatus } from '@/lib/api';

interface LiveOrderStatusProps {
  executionArn: string | null;
  orderId: string | null;
}

type ExecutionStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED' | null;

export function LiveOrderStatus({ executionArn, orderId }: LiveOrderStatusProps) {
  const [status, setStatus] = useState<ExecutionStatus>(null);
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!executionArn) {
      setStatus(null);
      setOutput(null);
      setError(null);
      return;
    }

    const poll = async () => {
      try {
        const data = await fetchOrderStatus(executionArn);
        setStatus(data.status);
        setOutput(data.output);
        setError(data.error ?? data.cause ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch status');
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [executionArn]);

  if (!executionArn) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Activity className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Live Order Status</h2>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-sm">
            Place an order to see live status updates.
          </p>
        </CardContent>
      </Card>
    );
  }

  const StatusIcon = () => {
    if (status === 'RUNNING') return <Loader2 className="h-5 w-5 animate-spin" />;
    if (status === 'SUCCEEDED') return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (status === 'FAILED' || status === 'TIMED_OUT' || status === 'ABORTED')
      return <XCircle className="h-5 w-5 text-red-600" />;
    return <Activity className="h-5 w-5" />;
  };

  const statusVariant =
    status === 'SUCCEEDED' ? 'success' : status === 'FAILED' || status === 'TIMED_OUT' ? 'destructive' : 'secondary';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Live Order Status</h2>
        </div>
        <Badge variant={statusVariant}>{status ?? 'Checking...'}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <StatusIcon />
          <span className="text-sm font-medium">
            {orderId ?? 'Order'} – {status ?? 'Polling...'}
          </span>
        </div>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {output != null && status === 'SUCCEEDED' && (
          <pre className="rounded bg-slate-100 p-3 text-xs overflow-auto max-h-32">
            {String(JSON.stringify(typeof output === 'string' ? JSON.parse(output) : output, null, 2))}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
