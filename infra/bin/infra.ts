#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsOrderFlowStack, type DbCredentials } from '../lib/aws-order-flow-stack';

const app = new cdk.App();

const dbHost = app.node.tryGetContext('dbHost') as string | undefined;
const dbPort = app.node.tryGetContext('dbPort') as number | undefined;
const dbName = app.node.tryGetContext('dbName') as string | undefined;
const dbUser = app.node.tryGetContext('dbUser') as string | undefined;
const dbPassword = app.node.tryGetContext('dbPassword') as string | undefined;
const dbSsl = app.node.tryGetContext('dbSsl') as boolean | undefined;

const dbCredentials: DbCredentials | undefined =
  dbHost && dbName && dbUser && dbPassword
    ? { host: dbHost, port: dbPort ?? 5432, database: dbName, user: dbUser, password: dbPassword, ssl: dbSsl }
    : undefined;

new AwsOrderFlowStack(app, 'AwsOrderFlowStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  dbCredentials,
});
