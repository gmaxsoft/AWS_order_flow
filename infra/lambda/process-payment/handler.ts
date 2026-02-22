import { Logger } from '@aws-lambda-powertools/logger';
import type { Handler } from 'aws-lambda';

const logger = new Logger({ serviceName: 'process-payment' });

interface PaymentInput {
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
  inStock: boolean;
}

interface PaymentOutput extends PaymentInput {
  paymentSuccess: boolean;
  transactionId?: string;
}

export const handler: Handler<PaymentInput, PaymentOutput> = async (event) => {
  logger.info('Processing payment', { orderId: event.orderId, totalAmount: event.totalAmount });

  if (!event.inStock) {
    logger.warn('Cannot process payment - insufficient stock');
    return {
      ...event,
      paymentSuccess: false,
    };
  }

  // Randomly return success or failure
  const paymentSuccess = Math.random() >= 0.5;
  const transactionId = paymentSuccess ? `txn-${Date.now()}-${Math.random().toString(36).slice(2)}` : undefined;

  if (paymentSuccess) {
    logger.info('Payment successful', { transactionId });
  } else {
    logger.warn('Payment failed (random)');
  }

  return {
    ...event,
    paymentSuccess,
    transactionId,
  };
};
