import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import type { Handler } from 'aws-lambda';

const logger = new Logger({ serviceName: 'check-stock' });
const dynamo = new DynamoDBClient({});

const INVENTORY_TABLE = process.env.INVENTORY_TABLE_NAME!;

interface CheckStockInput {
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
}

interface CheckStockOutput extends CheckStockInput {
  inStock: boolean;
  insufficientProducts?: string[];
}

export const handler: Handler<CheckStockInput, CheckStockOutput> = async (event) => {
  logger.info('Checking stock', { orderId: event.orderId, items: event.items });

  const insufficientProducts: string[] = [];

  for (const item of event.items) {
    const result = await dynamo.send(
      new GetItemCommand({
        TableName: INVENTORY_TABLE,
        Key: {
          productId: { S: item.productId },
        },
      })
    );

    // Check 'quantity' in DynamoDB (fallback to 'stock' for backwards compatibility)
    const quantityAttr = result.Item?.quantity ?? result.Item?.stock;
    const availableQty = quantityAttr?.N ? parseInt(quantityAttr.N, 10) : 0;

    if (availableQty <= 0) {
      insufficientProducts.push(
        `productId ${item.productId}: quantity in DynamoDB is ${availableQty} (must be > 0)`
      );
    } else if (availableQty < item.quantity) {
      insufficientProducts.push(
        `productId ${item.productId}: requested ${item.quantity}, available ${availableQty}`
      );
    }
  }

  const inStock = insufficientProducts.length === 0;

  if (!inStock) {
    logger.warn('Insufficient stock', { insufficientProducts });
  }

  return {
    ...event,
    inStock,
    ...(insufficientProducts.length > 0 && { insufficientProducts }),
  };
};
