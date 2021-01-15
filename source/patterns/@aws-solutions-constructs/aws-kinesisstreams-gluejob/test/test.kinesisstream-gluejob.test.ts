/**
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

import { ResourcePart, SynthUtils } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';
import { CfnJob } from '@aws-cdk/aws-glue';
import { Stack } from "@aws-cdk/core";
import * as defaults from '@aws-solutions-constructs/core';
import { SinkStoreType } from '@aws-solutions-constructs/core';
import { KinesisStreamGlueJob, KinesisStreamGlueJobProps } from '../lib';

// --------------------------------------------------------------
// Pattern minimal deployment
// --------------------------------------------------------------
test('Pattern minimal deployment', () => {
  // Initial setup
  const stack = new Stack();
  const props: KinesisStreamGlueJobProps = {
    glueJobProps: {
      command: {
        name: 'glueetl',
        pythonVersion: '3',
        scriptLocation: 's3://fakebucket/fakefolder/fakefolder/fakefile.py'
      }
    },
    fieldSchema: [{
      name: "id",
      type: "int",
      comment: "Identifier for the record"
    }, {
      name: "name",
      type: "string",
      comment: "The name of the record"
    }, {
      name: "type",
      type: "string",
      comment: "The type of the record"
    }, {
      name: "numericvalue",
      type: "int",
      comment: "Some value associated with the record"
    }],
  };
  new KinesisStreamGlueJob(stack, 'test-kinesisstreams-lambda', props);
  // Assertion 1
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();

  // check for role creation
  expect(stack).toHaveResourceLike('AWS::IAM::Role', {
    Properties: {
      AssumeRolePolicyDocument: {
        Statement: [{
          Action: "sts:AssumeRole",
          Effect: "Allow",
          Principal: {
            Service: "glue.amazonaws.com",
          },
        }],
        Version: "2012-10-17",
      },
      Description: "Service role that Glue custom ETL jobs will assume for exeuction",
    },
    Type: "AWS::IAM::Role"
  }, ResourcePart.CompleteDefinition);

  // check for Kinesis Stream
  expect(stack).toHaveResourceLike('AWS::Kinesis::Stream', {
    Properties: {
      RetentionPeriodHours: 24,
      ShardCount: 1,
      StreamEncryption: {
        EncryptionType: "KMS",
        KeyId: "alias/aws/kinesis",
      },
    },
    Type: "AWS::Kinesis::Stream"
  }, ResourcePart.CompleteDefinition);

  // check policy to allow read access to Kinesis Stream
  expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
    Type: "AWS::IAM::Policy",
    "Properties": {
      "PolicyDocument": {
        "Statement": [
          {
            "Action": "glue:GetJob",
            "Effect": "Allow",
            "Resource": {
              "Fn::Join": [
                "",
                [
                  "arn:",
                  {
                    "Ref": "AWS::Partition"
                  },
                  ":glue:",
                  {
                    "Ref": "AWS::Region"
                  },
                  ":",
                  {
                    "Ref": "AWS::AccountId"
                  },
                  ":job/",
                  {
                    "Ref": "testkinesisstreamslambdaKinesisETLJobF9454612"
                  }
                ]
              ]
            }
          },
          {
            "Action": "glue:GetSecurityConfiguration",
            "Effect": "Allow",
            "Resource": "*"
          },
          {
            "Action": "glue:GetTable",
            "Effect": "Allow",
            "Resource": [
              {
                "Fn::Join": [
                  "",
                  [
                    "arn:",
                    {
                      "Ref": "AWS::Partition"
                    },
                    ":glue:",
                    {
                      "Ref": "AWS::Region"
                    },
                    ":",
                    {
                      "Ref": "AWS::AccountId"
                    },
                    ":table/",
                    {
                      "Ref": "GlueDatabase"
                    },
                    "/",
                    {
                      "Ref": "GlueTable"
                    }
                  ]
                ]
              },
              {
                "Fn::Join": [
                  "",
                  [
                    "arn:",
                    {
                      "Ref": "AWS::Partition"
                    },
                    ":glue:",
                    {
                      "Ref": "AWS::Region"
                    },
                    ":",
                    {
                      "Ref": "AWS::AccountId"
                    },
                    ":database/",
                    {
                      "Ref": "GlueDatabase"
                    }
                  ]
                ]
              },
              {
                "Fn::Join": [
                  "",
                  [
                    "arn:",
                    {
                      "Ref": "AWS::Partition"
                    },
                    ":glue:",
                    {
                      "Ref": "AWS::Region"
                    },
                    ":",
                    {
                      "Ref": "AWS::AccountId"
                    },
                    ":catalog"
                  ]
                ]
              }
            ]
          },
          {
            "Action": "cloudwatch:PutMetricData",
            "Condition": {
              "StringEquals": {
                "cloudwatch:namespace": "Glue"
              },
              "Bool": {
                "aws:SecureTransport": "true"
              }
            },
            "Effect": "Allow",
            "Resource": "*"
          },
          {
            "Action": [
              "kinesis:DescribeStream",
              "kinesis:DescribeStreamSummary",
              "kinesis:GetRecords",
              "kinesis:GetShardIterator",
              "kinesis:ListShards",
              "kinesis:SubscribeToShard"
            ],
            "Effect": "Allow",
            "Resource": {
              "Fn::GetAtt": [
                "testkinesisstreamslambdaKinesisStream374D6D56",
                "Arn"
              ]
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "PolicyName": "GlueJobPolicyAEA4B94E",
      "Roles": [
        {
          "Ref": "testkinesisstreamslambdaJobRole42199B9C"
        }
      ]
    },
    "Metadata": {
      "cfn_nag": {
        "rules_to_suppress": [
          {
            "id": "W12",
            "reason": "Glue Security Configuration does not have an ARN, and the policy only allows reading the configuration.            CloudWatch metrics also do not have an ARN but adding a namespace condition to the policy to allow it to            publish metrics only for AWS Glue"
          }
        ]
      }
    }
  }, ResourcePart.CompleteDefinition);
});

// --------------------------------------------------------------
// Test if existing Glue Job is provided
// --------------------------------------------------------------
test('Test if existing Glue Job is provided', () => {
  // Initial setup
  const stack = new Stack();
  const _jobRole = defaults.createGlueJobRole(stack);
  const existingCfnJob = new CfnJob(stack, 'ExistingJob', {
    command: {
      name: 'glueetl',
      pythonVersion: '3',
      scriptLocation: 's3://fakebucket/fakepath/fakepath/fakefile.py'
    },
    role: _jobRole.roleArn,
    securityConfiguration: 'testSecConfig'
  });

  new KinesisStreamGlueJob(stack, 'test-kinesisstreams-lambda', {
    existingGlueJob: existingCfnJob,
    fieldSchema: [{
      name: "id",
      type: "int",
      comment: "Identifier for the record"
    }, {
      name: "name",
      type: "string",
      comment: "The name of the record"
    }, {
      name: "type",
      type: "string",
      comment: "The type of the record"
    }, {
      name: "numericvalue",
      type: "int",
      comment: "Some value associated with the record"
    }],
  });
  // Assertion 1
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();

  // check for Kinesis Stream
  expect(stack).toHaveResourceLike('AWS::Kinesis::Stream', {
    Properties: {
      RetentionPeriodHours: 24,
      ShardCount: 1,
      StreamEncryption: {
        EncryptionType: "KMS",
        KeyId: "alias/aws/kinesis",
      },
    },
    Type: "AWS::Kinesis::Stream"
  }, ResourcePart.CompleteDefinition);

  // check policy to allow read access to Kinesis Stream
  expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
    Type: "AWS::IAM::Policy",
    Properties: {
      PolicyDocument: {
        Statement: [
          {
            Action: "glue:GetJob",
            Effect: "Allow",
            Resource: {
              "Fn::Join": [
                "",
                [
                  "arn:",
                  {
                    Ref: "AWS::Partition"
                  },
                  ":glue:",
                  {
                    Ref: "AWS::Region"
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId"
                  },
                  ":job/",
                  {
                    Ref: "ExistingJob"
                  }
                ]
              ]
            }
          },
          {
            Action: "glue:GetSecurityConfiguration",
            Effect: "Allow",
            Resource: "*"
          },
          {
            Action: "glue:GetTable",
            Effect: "Allow",
            Resource: [
              {
                "Fn::Join": [
                  "",
                  [
                    "arn:",
                    {
                      Ref: "AWS::Partition"
                    },
                    ":glue:",
                    {
                      Ref: "AWS::Region"
                    },
                    ":",
                    {
                      Ref: "AWS::AccountId"
                    },
                    ":table/",
                    {
                      Ref: "GlueDatabase"
                    },
                    "/",
                    {
                      Ref: "GlueTable"
                    }
                  ]
                ]
              },
              {
                "Fn::Join": [
                  "",
                  [
                    "arn:",
                    {
                      Ref: "AWS::Partition"
                    },
                    ":glue:",
                    {
                      Ref: "AWS::Region"
                    },
                    ":",
                    {
                      Ref: "AWS::AccountId"
                    },
                    ":database/",
                    {
                      Ref: "GlueDatabase"
                    }
                  ]
                ]
              },
              {
                "Fn::Join": [
                  "",
                  [
                    "arn:",
                    {
                      Ref: "AWS::Partition"
                    },
                    ":glue:",
                    {
                      Ref: "AWS::Region"
                    },
                    ":",
                    {
                      Ref: "AWS::AccountId"
                    },
                    ":catalog"
                  ]
                ]
              }
            ]
          },
          {
            Action: "cloudwatch:PutMetricData",
            Effect: "Allow",
            Resource: "*"
          },
          {
            Action: [
              "kinesis:DescribeStream",
              "kinesis:DescribeStreamSummary",
              "kinesis:GetRecords",
              "kinesis:GetShardIterator",
              "kinesis:ListShards",
              "kinesis:SubscribeToShard"
            ],
            Effect: "Allow",
            Resource: {
              "Fn::GetAtt": [
                "testkinesisstreamslambdaKinesisStream374D6D56",
                "Arn"
              ]
            }
          }
        ],
        Version: "2012-10-17"
      },
      PolicyName: "GlueJobPolicyAEA4B94E",
      Roles: [
        {
          "Fn::Select": [
            1,
            {
              "Fn::Split": [
                "/",
                {
                  "Fn::Select": [
                    5,
                    {
                      "Fn::Split": [
                        ":",
                        {
                          "Fn::GetAtt": [
                            "JobRole014917C6",
                            "Arn"
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  }, ResourcePart.CompleteDefinition);
});

// --------------------------------------------------------------
// Test if existing S3 bucket location is provided
// --------------------------------------------------------------
test('When S3 bucket location for script exists', () => {
  // Initial setup
  const stack = new Stack();
  const _s3ObjectUrl: string = 's3://fakelocation/etl/fakefile.py';
  const props: KinesisStreamGlueJobProps = {
    glueJobProps: {
      command: {
        name: 'pythonshell',
        pythonVersion: '3',
        scriptLocation: _s3ObjectUrl
      }
    },
    fieldSchema: [{
      name: "id",
      type: "int",
      comment: "Identifier for the record"
    }, {
      name: "name",
      type: "string",
      comment: "The name of the record"
    }, {
      name: "type",
      type: "string",
      comment: "The type of the record"
    }, {
      name: "numericvalue",
      type: "int",
      comment: "Some value associated with the record"
    }],
    outputDataStore: {
      datastoreStype: SinkStoreType.S3
    }
  };
  new KinesisStreamGlueJob(stack, 'test-kinesisstreams-lambda', props);
  // Assertion 1
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

// --------------------------------------------------------------
// Test when the construct is supplied with an existing stream
// --------------------------------------------------------------
test('create glue job with existing kinesis stream', () => {
  const stack = new Stack();
  const _kinesisStream = defaults.buildKinesisStream(stack, {});
  new KinesisStreamGlueJob(stack, 'existingStreamJob', {
    glueJobProps: {
      command: {
        name: 'pythonshell',
        pythonVersion: '3',
        scriptLocation: 's3://fakes3bucket/fakepath/fakefile.py'
      }
    },
    existingStreamObj: _kinesisStream,
    fieldSchema: [{
      name: "id",
      type: "int",
      comment: "Identifier for the record"
    }, {
      name: "name",
      type: "string",
      comment: "The name of the record"
    }, {
      name: "type",
      type: "string",
      comment: "The type of the record"
    }, {
      name: "numericvalue",
      type: "int",
      comment: "Some value associated with the record"
    }],
    outputDataStore: {
      datastoreStype: SinkStoreType.S3
    }
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

// --------------------------------------------------------------
// Test if no script loocation is provided
// --------------------------------------------------------------
test('Do not pass s3ObjectUrlForScript or scriptLocationPath, error out', () => {
  const stack = new Stack();
  try {
    const _kinesisStream = defaults.buildKinesisStream(stack, {});
    new KinesisStreamGlueJob(stack, 'existingStreamJob', {
      glueJobProps: {
        command: {
          name: 'pythonshell',
          scriptLocation: 's3://fakebucket/fakepath/fakefile.py'
        }
      },
      existingStreamObj: _kinesisStream,
      fieldSchema: [{
        name: "id",
        type: "int",
        comment: "Identifier for the record"
      }, {
        name: "name",
        type: "string",
        comment: "The name of the record"
      }, {
        name: "type",
        type: "string",
        comment: "The type of the record"
      }, {
        name: "numericvalue",
        type: "int",
        comment: "Some value associated with the record"
      }],
      outputDataStore: {
        datastoreStype: SinkStoreType.S3
      }
    });
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
  }
});

// --------------------------------------------------------------
// Test when neither CfnTable nor Table schem structure is provided
// --------------------------------------------------------------
test('Do not pass fieldSchame or table (CfnTable), error out', () => {
  const stack = new Stack();

  try {
    const props: KinesisStreamGlueJobProps = {
      glueJobProps: {
        command: {
          name: 'glueetl',
          pythonVersion: '3',
          scriptPath: `s3://fakebucket/fakepath/fakefile.py`
        }
      },
      outputDataStore: {
        datastoreStype: SinkStoreType.S3
      }
    };
    new KinesisStreamGlueJob(stack, 'test-kinesisstreams-lambda', props);
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
  }
});

// --------------------------------------------------------------
// Provide a database and table
// --------------------------------------------------------------
test('When database and table are provided', () => {
  // Initial setup
  const stack = new Stack();
  const _database = defaults.createGlueDatabase(stack);
  const props: KinesisStreamGlueJobProps = {
    glueJobProps: {
      command: {
        name: 'glueetl',
        pythonVersion: '3',
        scriptLocation: 's3://fakebucket/fakefolder/fakefolder/fakefile.py'
      }
    },
    database: _database,
    table: defaults.createGlueTable(stack, _database, [{
      name: "id",
      type: "int",
      comment: "Identifier for the record"
    }, {
      name: "name",
      type: "string",
      comment: "The name of the record"
    }, {
      name: "type",
      type: "string",
      comment: "The type of the record"
    }, {
      name: "numericvalue",
      type: "int",
      comment: "Some value associated with the record"
    }], 'kinesis', { STREAM_NAME: 'testStream' })
  };
  new KinesisStreamGlueJob(stack, 'test-kinesisstreams-lambda', props);
  // Assertion 1
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});