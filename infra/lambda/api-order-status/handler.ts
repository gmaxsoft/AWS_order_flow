import { SFNClient, DescribeExecutionCommand } from '@aws-sdk/client-sfn';
import { Logger } from '@aws-lambda-powertools/logger';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

const logger = new Logger({ serviceName: 'api-order-status' });
const sfn = new SFNClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const executionArn = event.queryStringParameters?.executionArn;
  if (!executionArn) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Missing executionArn' }),
    };
  }

  logger.info('Checking execution status', { executionArn });

  try {
    const result = await sfn.send(
      new DescribeExecutionCommand({ executionArn })
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        status: result.status,
        startDate: result.startDate,
        stopDate: result.stopDate,
        output: result.output,
        error: result.error,
        cause: result.cause,
      }),
    };
  } catch (err) {
    logger.error('Failed to describe execution', { error: err });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to fetch execution status' }),
    };
  }
};
