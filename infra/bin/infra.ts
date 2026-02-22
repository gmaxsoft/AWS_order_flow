#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsOrderFlowStack } from '../lib/aws-order-flow-stack';

const app = new cdk.App();
new AwsOrderFlowStack(app, 'AwsOrderFlowStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
