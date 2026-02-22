import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Logger } from '@aws-lambda-powertools/logger';
import type { Handler } from 'aws-lambda';

const logger = new Logger({ serviceName: 'rollback' });
const eventBridge = new EventBridgeClient({});

const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME ?? 'default';

interface RollbackInput {
  orderId: string;
  error?: string;
  [key: string]: unknown;
}

export const handler: Handler<RollbackInput> = async (event) => {
  logger.warn('Sending Rollback event', { orderId: event.orderId, error: event.error });

  const reason =
    event.error ??
    (event.insufficientProducts ? 'Insufficient stock' : 'Payment or processing failed');

  await eventBridge.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: 'order-processor',
          DetailType: 'Rollback',
          Detail: JSON.stringify({
            orderId: event.orderId,
            reason,
            timestamp: new Date().toISOString(),
          }),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    })
  );

  logger.info('Rollback event sent', { orderId: event.orderId });
  return event;
};
