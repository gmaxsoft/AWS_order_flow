import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { Logger } from '@aws-lambda-powertools/logger';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

const logger = new Logger({ serviceName: 'order-api-handler' });
const sfn = new SFNClient({});

const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  logger.info('Received order request', { requestId: event.requestContext?.requestId });

  let body: Record<string, unknown>;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { orderId, customerId, items, totalAmount } = body;
  if (!orderId || !customerId || !items || !totalAmount) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Missing required fields: orderId, customerId, items, totalAmount',
      }),
    };
  }

  try {
    const result = await sfn.send(
      new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN,
        input: JSON.stringify(body),
      })
    );

    logger.info('Step Function started', { executionArn: result.executionArn });

    return {
      statusCode: 202,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        executionArn: result.executionArn,
        message: 'Order processing started',
      }),
    };
  } catch (err) {
    logger.error('Failed to start execution', { error: err });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to process order' }),
    };
  }
};
