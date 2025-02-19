/**
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

/// !cdk-integ *
import { App, Stack, RemovalPolicy } from "@aws-cdk/core";
import { S3ToStepfunctions, S3ToStepfunctionsProps } from "../lib";
import * as stepfunctions from '@aws-cdk/aws-stepfunctions';
import * as s3 from '@aws-cdk/aws-s3';
import { CreateScrapBucket } from '@aws-solutions-constructs/core';
import { generateIntegStackName } from '@aws-solutions-constructs/core';

const app = new App();
const stack = new Stack(app, generateIntegStackName(__filename));

const existingBucket = CreateScrapBucket(stack, {});

const mybucket: s3.IBucket = s3.Bucket.fromBucketName(stack, 'mybucket', existingBucket.bucketName);
const startState = new stepfunctions.Pass(stack, 'StartState');

const props: S3ToStepfunctionsProps = {
  existingBucketObj: mybucket,
  stateMachineProps: {
    definition: startState
  },
  logGroupProps: {
    removalPolicy: RemovalPolicy.DESTROY
  },
};

new S3ToStepfunctions(stack, 'test-s3-stepfunctions-pre-existing-bucket-construct', props);
app.synth();
