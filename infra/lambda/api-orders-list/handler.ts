import { Logger } from '@aws-lambda-powertools/logger';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { Client } from 'pg';

const logger = new Logger({ serviceName: 'api-orders-list' });

const DB_HOST = process.env.DB_HOST;
const DB_PORT = parseInt(process.env.DB_PORT ?? '5432', 10);
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;

export const handler: APIGatewayProxyHandlerV2 = async () => {
  if (!DB_HOST || !DB_NAME || !DB_USER || !DB_PASSWORD) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Database not configured', orders: [] }),
    };
  }

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

    const result = await client.query(
      `SELECT o.id, o.customer_id, o.total_amount, o.status, o.created_at
       FROM orders o
       ORDER BY o.created_at DESC
       LIMIT 10`
    );

    const orders = await Promise.all(
      result.rows.map(async (row) => {
        const itemsResult = await client.query(
          'SELECT product_id as "productId", quantity, unit_price as "unitPrice" FROM order_items WHERE order_id = $1',
          [row.id]
        );
        return {
          id: row.id,
          customerId: row.customer_id,
          totalAmount: parseFloat(String(row.total_amount)),
          status: row.status,
          createdAt: row.created_at,
          items: itemsResult.rows,
        };
      })
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ orders }),
    };
  } catch (err) {
    logger.error('Failed to fetch orders', { error: err });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to fetch orders', orders: [] }),
    };
  } finally {
    await client.end();
  }
};
