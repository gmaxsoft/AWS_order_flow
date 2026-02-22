import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import * as path from 'path';

export interface DbCredentials {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

export interface AwsOrderFlowStackProps extends cdk.StackProps {
  /** PostgreSQL credentials (use env vars in Lambda). Pass via: cdk deploy -c dbHost=... -c dbName=... -c dbUser=... -c dbPassword=... */
  dbCredentials?: DbCredentials;
}

export class AwsOrderFlowStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: AwsOrderFlowStackProps) {
    super(scope, id, props);

    // DynamoDB Inventory table
    const inventoryTable = new dynamodb.Table(this, 'Inventory', {
      tableName: 'Inventory',
      partitionKey: { name: 'productId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Custom Event Bus for Rollback events
    const eventBus = new events.EventBus(this, 'OrderProcessorEventBus', {
      eventBusName: 'order-processor-events',
    });

    const dbCreds = props?.dbCredentials;

    // Lambda: Check Stock
    const checkStockFn = new lambdaNodejs.NodejsFunction(this, 'CheckStock', {
      entry: path.join(__dirname, '../lambda/check-stock/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        INVENTORY_TABLE_NAME: inventoryTable.tableName,
      },
    });
    inventoryTable.grantReadData(checkStockFn);

    // Lambda: Process Payment
    const processPaymentFn = new lambdaNodejs.NodejsFunction(this, 'ProcessPayment', {
      entry: path.join(__dirname, '../lambda/process-payment/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
    });

    // Lambda: Save to PostgreSQL & Update DynamoDB
    const saveToPostgresFn = new lambdaNodejs.NodejsFunction(this, 'SaveToPostgres', {
      entry: path.join(__dirname, '../lambda/save-to-postgres/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        INVENTORY_TABLE_NAME: inventoryTable.tableName,
        DB_HOST: dbCreds?.host ?? '',
        DB_PORT: String(dbCreds?.port ?? 5432),
        DB_NAME: dbCreds?.database ?? '',
        DB_USER: dbCreds?.user ?? '',
        DB_PASSWORD: dbCreds?.password ?? '',
        DB_SSL: dbCreds?.ssl ? 'true' : 'false',
      },
      timeout: cdk.Duration.seconds(30),
    });
    inventoryTable.grantReadWriteData(saveToPostgresFn);

    // Lambda: Rollback
    const rollbackFn = new lambdaNodejs.NodejsFunction(this, 'Rollback', {
      entry: path.join(__dirname, '../lambda/rollback/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        EVENT_BUS_NAME: eventBus.eventBusName,
      },
    });
    eventBus.grantPutEventsTo(rollbackFn);

    // Step Function: OrderProcessor (Express Workflow)
    const checkStockTask = new sfnTasks.LambdaInvoke(this, 'CheckStockTask', {
      lambdaFunction: checkStockFn,
      outputPath: '$.Payload',
    });

    const processPaymentTask = new sfnTasks.LambdaInvoke(this, 'ProcessPaymentTask', {
      lambdaFunction: processPaymentFn,
      outputPath: '$.Payload',
    });

    const saveToPostgresTask = new sfnTasks.LambdaInvoke(this, 'SaveToPostgresTask', {
      lambdaFunction: saveToPostgresFn,
      outputPath: '$.Payload',
    });

    const rollbackTask = new sfnTasks.LambdaInvoke(this, 'RollbackTask', {
      lambdaFunction: rollbackFn,
      outputPath: '$.Payload',
    });

    const paymentSucceeded = new sfn.Choice(this, 'PaymentSucceeded')
      .when(sfn.Condition.booleanEquals('$.paymentSuccess', true), saveToPostgresTask)
      .otherwise(rollbackTask);

    const stockOk = new sfn.Choice(this, 'StockAvailable')
      .when(sfn.Condition.booleanEquals('$.inStock', false), rollbackTask)
      .otherwise(processPaymentTask.next(paymentSucceeded));

    const definition = checkStockTask.next(stockOk);

    const stateMachine = new sfn.StateMachine(this, 'OrderProcessor', {
      stateMachineName: 'OrderProcessor',
      stateMachineType: sfn.StateMachineType.EXPRESS,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
    });

    // API Gateway HTTP API to trigger Step Function
    const httpApi = new apigatewayv2.HttpApi(this, 'OrderApi', {
      apiName: 'order-processor-api',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigatewayv2.CorsHttpMethod.POST, apigatewayv2.CorsHttpMethod.OPTIONS],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const apiHandlerFn = new lambdaNodejs.NodejsFunction(this, 'OrderApiHandler', {
      entry: path.join(__dirname, '../lambda/api-handler/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        STATE_MACHINE_ARN: stateMachine.stateMachineArn,
      },
    });
    stateMachine.grantStartExecution(apiHandlerFn);

    const apiIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'OrderApiIntegration',
      apiHandlerFn
    );

    httpApi.addRoutes({
      path: '/orders',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: apiIntegration,
    });

    // Lambda: List Products (GET /products)
    const productsFn = new lambdaNodejs.NodejsFunction(this, 'ApiProducts', {
      entry: path.join(__dirname, '../lambda/api-products/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: { INVENTORY_TABLE_NAME: inventoryTable.tableName },
    });
    inventoryTable.grantReadData(productsFn);

    const productsIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'ProductsIntegration',
      productsFn
    );
    httpApi.addRoutes({
      path: '/products',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: productsIntegration,
    });

    // Lambda: Order Status (GET /orders/status?executionArn=...)
    const orderStatusFn = new lambdaNodejs.NodejsFunction(this, 'ApiOrderStatus', {
      entry: path.join(__dirname, '../lambda/api-order-status/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
    });
    stateMachine.grantRead(orderStatusFn);

    const orderStatusIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'OrderStatusIntegration',
      orderStatusFn
    );
    httpApi.addRoutes({
      path: '/orders/status',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: orderStatusIntegration,
    });

    // Lambda: List Orders (GET /orders/list)
    const ordersListFn = new lambdaNodejs.NodejsFunction(this, 'ApiOrdersList', {
      entry: path.join(__dirname, '../lambda/api-orders-list/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        DB_HOST: dbCreds?.host ?? '',
        DB_PORT: String(dbCreds?.port ?? 5432),
        DB_NAME: dbCreds?.database ?? '',
        DB_USER: dbCreds?.user ?? '',
        DB_PASSWORD: dbCreds?.password ?? '',
        DB_SSL: dbCreds?.ssl ? 'true' : 'false',
      },
      timeout: cdk.Duration.seconds(30),
    });

    const ordersListIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'OrdersListIntegration',
      ordersListFn
    );
    httpApi.addRoutes({
      path: '/orders/list',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: ordersListIntegration,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
      description: 'Order API endpoint',
      exportName: 'OrderApiUrl',
    });
    new cdk.CfnOutput(this, 'InventoryTableName', {
      value: inventoryTable.tableName,
      description: 'DynamoDB Inventory table',
    });
  }
}
