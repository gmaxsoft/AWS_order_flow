import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

const logger = new Logger({ serviceName: 'api-products' });
const dynamo = new DynamoDBClient({});

const INVENTORY_TABLE = process.env.INVENTORY_TABLE_NAME!;

export const handler: APIGatewayProxyHandlerV2 = async () => {
  logger.info('Fetching products from Inventory');

  const result = await dynamo.send(
    new ScanCommand({
      TableName: INVENTORY_TABLE,
    })
  );

  const products = (result.Items ?? []).map((item) => {
    const qty = item.quantity ?? item.stock;
    return {
      productId: item.productId?.S ?? '',
      name: item.name?.S ?? item.productId?.S ?? 'Unknown',
      quantity: qty?.N ? parseInt(qty.N, 10) : 0,
      price: item.price?.N ? parseFloat(item.price.N) : 0,
    };
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ products }),
  };
};
