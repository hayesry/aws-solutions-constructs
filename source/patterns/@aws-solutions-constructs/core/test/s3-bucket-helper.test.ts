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

import { SynthUtils, expect as expectCDK, haveResource, ResourcePart } from '@aws-cdk/assert';
import { Duration, RemovalPolicy, Stack } from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as s3n from '@aws-cdk/aws-s3-notifications';
import * as sqs from '@aws-cdk/aws-sqs';
import * as defaults from '../index';
import '@aws-cdk/assert/jest';
import { Bucket, StorageClass } from '@aws-cdk/aws-s3';

test('s3 bucket with default params', () => {
  const stack = new Stack();
  defaults.buildS3Bucket(stack, {});
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('s3 bucket with default params and bucket names', () => {
  const stack = new Stack();
  const s3BucketProps: s3.BucketProps = {
    bucketName: 'my-bucket'
  };
  defaults.buildS3Bucket(stack, {
    bucketProps: s3BucketProps
  });
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('check exception for Missing existingBucketObj from props for deploy = false', () => {
  const stack = new Stack();

  try {
    defaults.buildS3Bucket(stack, {});
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
  }
});

test('s3 bucket with bucketId', () => {
  const stack = new Stack();

  defaults.buildS3Bucket(stack, {}, 'my');

  expectCDK(stack).to(haveResource("AWS::S3::Bucket", {
    LoggingConfiguration: {
      DestinationBucketName: {
        Ref: "myS3LoggingBucketDE461344"
      }
    },
  }));
});

test('s3 bucket with bucketProps', () => {
  const stack = new Stack();

  defaults.buildS3Bucket(stack, {
    bucketProps: {
      bucketName: 'mybucket'
    }
  });

  expectCDK(stack).to(haveResource("AWS::S3::Bucket", {
    BucketName: "mybucket"
  }));
});

test('s3 bucket with life cycle policy', () => {
  const stack = new Stack();

  defaults.buildS3Bucket(stack, {
    bucketProps: {
      lifecycleRules: [{
        expiration: Duration.days(365),
        transitions: [{
          storageClass: StorageClass.INFREQUENT_ACCESS,
          transitionAfter: Duration.days(30)
        }, {
          storageClass: StorageClass.GLACIER,
          transitionAfter: Duration.days(90)
        }]
      }]
    }
  });

  expectCDK(stack).to(haveResource("AWS::S3::Bucket", {
    LifecycleConfiguration: {
      Rules: [
        {
          ExpirationInDays: 365,
          Status: "Enabled",
          Transitions: [
            {
              StorageClass: "STANDARD_IA",
              TransitionInDays: 30
            },
            {
              StorageClass: "GLACIER",
              TransitionInDays: 90
            }
          ]
        }
      ]
    }
  }));
});

test('s3 bucket with access logging configured', () => {
  const stack = new Stack();
  const mybucket = new Bucket(stack, 'mybucket', {
    serverAccessLogsBucket: new Bucket(stack, 'myaccesslogbucket', {})
  });

  defaults.buildS3Bucket(stack, {
    bucketProps: {
      serverAccessLogsBucket: mybucket
    }
  });

  expectCDK(stack).to(haveResource("AWS::S3::Bucket", {
    LoggingConfiguration: {
      DestinationBucketName: {
        Ref: "mybucket160F8132"
      }
    },
  }));
});

test('Check S3 Bucket policy', () => {
  const stack = new Stack();
  defaults.buildS3Bucket(stack, {});

  expectCDK(stack).to(
    haveResource("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: [
          {
            Sid: "HttpsOnly",
            Action: "*",
            Condition: {
              Bool: {
                "aws:SecureTransport": "false",
              },
            },
            Effect: "Deny",
            Principal: {
              AWS: "*"
            },
            Resource: [
              {
                "Fn::Join": [
                  "",
                  [
                    {
                      "Fn::GetAtt": ["S3Bucket07682993", "Arn"],
                    },
                    "/*",
                  ],
                ],
              },
              {
                "Fn::GetAtt": [
                  "S3Bucket07682993",
                  "Arn"
                ]
              }
            ]
          }
        ],
        Version: "2012-10-17",
      },
    })
  );
});

test('s3 bucket with LoggingBucket and versioning turned off', () => {
  const stack = new Stack();
  const mybucket = new Bucket(stack, 'mybucket', {
    serverAccessLogsBucket: new Bucket(stack, 'myaccesslogbucket', {})
  });

  defaults.buildS3Bucket(stack, {
    bucketProps: {
      serverAccessLogsBucket: mybucket,
      serverAccessLogsPrefix: 'access-logs',
      versioned: false
    }
  });

  expectCDK(stack).to(haveResource("AWS::S3::Bucket", {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [
        {
          ServerSideEncryptionByDefault: {
            SSEAlgorithm: "AES256"
          }
        }
      ]
    },
    LoggingConfiguration: {
      DestinationBucketName: {
        Ref: "mybucket160F8132"
      },
      LogFilePrefix: "access-logs"
    },
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true
    }
  }));
});

test('s3 bucket versioning turned off', () => {
  const stack = new Stack();

  defaults.buildS3Bucket(stack, {
    bucketProps: {
      serverAccessLogsPrefix: 'access-logs',
      versioned: false
    }
  });

  expectCDK(stack).to(haveResource("AWS::S3::Bucket", {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [
        {
          ServerSideEncryptionByDefault: {
            SSEAlgorithm: "AES256"
          }
        }
      ]
    },
    LoggingConfiguration: {
      DestinationBucketName: {
        Ref: "S3LoggingBucket800A2B27"
      },
      LogFilePrefix: "access-logs"
    },
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true
    }
  }));
});

test('s3 bucket and logging bucket withe delete removal policy', () => {
  const stack = new Stack();

  defaults.buildS3Bucket(stack, {
    bucketProps: {
      removalPolicy: RemovalPolicy.DESTROY,
    }
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('s3 bucket versioning turned on', () => {
  const stack = new Stack();

  defaults.buildS3Bucket(stack, {
    bucketProps: {
      serverAccessLogsPrefix: 'access-logs',
    }
  });

  expectCDK(stack).to(haveResource("AWS::S3::Bucket", {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [
        {
          ServerSideEncryptionByDefault: {
            SSEAlgorithm: "AES256"
          }
        }
      ]
    },
    LifecycleConfiguration: {
      Rules: [
        {
          NoncurrentVersionTransitions: [
            {
              StorageClass: "GLACIER",
              TransitionInDays: 90
            }
          ],
          Status: "Enabled"
        }
      ]
    },
    LoggingConfiguration: {
      DestinationBucketName: {
        Ref: "S3LoggingBucket800A2B27"
      },
      LogFilePrefix: "access-logs"
    },
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true
    },
    VersioningConfiguration: {
      Status: "Enabled"
    }
  }));
});

test('Suppress cfn-nag warning for s3 bucket notification', () => {
  const stack = new Stack();
  let queue: sqs.Queue;
  let bucket: s3.Bucket;
  [bucket] = defaults.buildS3Bucket(stack, {});
  [queue] = defaults.buildQueue(stack, "S3BucketNotificationQueue", {});
  bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SqsDestination(queue));
  defaults.addCfnNagS3BucketNotificationRulesToSuppress(stack, "BucketNotificationsHandler050a0587b7544547bf325f094a3db834");

  expectCDK(stack).to(haveResource("AWS::Lambda::Function", {
    Metadata: {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: "W58",
            reason: "Lambda functions has the required permission to write CloudWatch Logs. It uses custom policy instead of arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole with tighter permissions."
          },
          {
            id: 'W89',
            reason: `This is not a rule for the general case, just for specific use cases/industries`
          },
          {
            id: 'W92',
            reason: `Impossible for us to define the correct concurrency for clients`
          }
        ]
      }
    }
  }, ResourcePart.CompleteDefinition));

  expectCDK(stack).to(haveResource("AWS::IAM::Policy", {
    Metadata: {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: "W12",
            reason: "Bucket resource is '*' due to circular dependency with bucket and role creation at the same time"
          }
        ]
      }
    }
  }, ResourcePart.CompleteDefinition));
});
