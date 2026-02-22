import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import type { Handler } from 'aws-lambda';
import { Client } from 'pg';

const logger = new Logger({ serviceName: 'save-to-postgres' });
const dynamo = new DynamoDBClient({});

const INVENTORY_TABLE = process.env.INVENTORY_TABLE_NAME!;
const DB_HOST = process.env.DB_HOST;
const DB_PORT = parseInt(process.env.DB_PORT ?? '5432', 10);
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;

interface SaveOrderInput {
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
  transactionId?: string;
  paymentSuccess: boolean;
}

export const handler: Handler<SaveOrderInput> = async (event) => {
  if (!event.paymentSuccess) {
    logger.warn('Skipping save - payment was not successful');
    return event;
  }

  const hasDbCreds = DB_HOST && DB_NAME && DB_USER && DB_PASSWORD;

  if (hasDbCreds) {
    logger.info('Saving order to PostgreSQL and updating DynamoDB', { orderId: event.orderId });

    const client = new Client({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
    });

    try {
      await client.connect();

      await client.query(
      `INSERT INTO orders (id, customer_id, total_amount, status, created_at)
       VALUES ($1, $2, $3, 'confirmed', NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'confirmed', updated_at = NOW()`,
      [event.orderId, event.customerId, event.totalAmount]
    );

    for (const item of event.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [event.orderId, item.productId, item.quantity, item.unitPrice]
      );
    }

      logger.info('Order saved to PostgreSQL', { orderId: event.orderId });
    } finally {
      await client.end();
    }
  } else {
    logger.warn('DB credentials not configured - skipping PostgreSQL, updating DynamoDB only');
  }

  // Update DynamoDB inventory (decrement quantity)
  for (const item of event.items) {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: INVENTORY_TABLE,
        Key: { productId: { S: item.productId } },
        UpdateExpression: 'SET quantity = if_not_exists(quantity, :zero) - :qty',
        ExpressionAttributeValues: {
          ':qty': { N: String(item.quantity) },
          ':zero': { N: '0' },
        },
      })
    );
  }

  logger.info('DynamoDB inventory updated', { orderId: event.orderId });
  return event;
};
