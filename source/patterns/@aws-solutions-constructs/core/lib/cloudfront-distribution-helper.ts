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

import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import * as api from '@aws-cdk/aws-apigateway';
import * as mediastore from '@aws-cdk/aws-mediastore';
import {
  DefaultCloudFrontWebDistributionForS3Props,
  DefaultCloudFrontWebDistributionForApiGatewayProps,
  DefaultCloudFrontDisributionForMediaStoreProps
} from './cloudfront-distribution-defaults';
import { overrideProps, addCfnSuppressRules } from './utils';
import { createLoggingBucket } from './s3-bucket-helper';

// Override Cfn_Nag rule: Cloudfront TLS-1.2 rule (https://github.com/stelligent/cfn_nag/issues/384)
function updateSecurityPolicy(cfDistribution: cloudfront.Distribution) {
  addCfnSuppressRules(cfDistribution, [
    {
      id: 'W70',
      reason: `Since the distribution uses the CloudFront domain name, CloudFront automatically sets the security policy to TLSv1 regardless of the value of MinimumProtocolVersion`
    }
  ]);

  return cfDistribution;
}

// Cloudfront function to insert the HTTP Security Headers into the response coming from the origin servers
// and before it is sent to the client
function defaultCloudfrontFunction(scope: cdk.Construct): cloudfront.Function {
  // generate a stable unique id for the cloudfront function and use it
  // both for the function name and the logical id of the function so if
  // it is changed the function will be recreated.
  // see https://github.com/aws/aws-cdk/issues/15523
  const functionId = `SetHttpSecurityHeaders${scope.node.addr}`;

  return new cloudfront.Function(scope, "SetHttpSecurityHeaders", {
    functionName: functionId,
    code: cloudfront.FunctionCode.fromInline("function handler(event) { var response = event.response; \
      var headers = response.headers; \
      headers['strict-transport-security'] = { value: 'max-age=63072000; includeSubdomains; preload'}; \
      headers['content-security-policy'] = { value: \"default-src 'none'; img-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'\"}; \
      headers['x-content-type-options'] = { value: 'nosniff'}; \
      headers['x-frame-options'] = {value: 'DENY'}; \
      headers['x-xss-protection'] = {value: '1; mode=block'}; \
      return response; \
    }")
  });
}

export function CloudFrontDistributionForApiGateway(scope: cdk.Construct,
  apiEndPoint: api.RestApi,
  cloudFrontDistributionProps?: cloudfront.DistributionProps | any,
  httpSecurityHeaders?: boolean): [cloudfront.Distribution,
    cloudfront.Function?, s3.Bucket?] {

  const _httpSecurityHeaders = (httpSecurityHeaders !== undefined && httpSecurityHeaders === false) ? false : true;

  let defaultprops: cloudfront.DistributionProps;
  let cloudfrontFunction;
  let loggingBucket;

  if (_httpSecurityHeaders) {
    cloudfrontFunction = defaultCloudfrontFunction(scope);
  }

  if (cloudFrontDistributionProps && cloudFrontDistributionProps.enableLogging && cloudFrontDistributionProps.logBucket) {
    defaultprops = DefaultCloudFrontWebDistributionForApiGatewayProps(apiEndPoint,
      cloudFrontDistributionProps.logBucket, _httpSecurityHeaders,
      cloudfrontFunction);
  } else {
    loggingBucket = createLoggingBucket(scope, 'CloudfrontLoggingBucket');
    defaultprops = DefaultCloudFrontWebDistributionForApiGatewayProps(apiEndPoint,
      loggingBucket, _httpSecurityHeaders,
      cloudfrontFunction);
  }

  const cfprops = cloudFrontDistributionProps ? overrideProps(defaultprops, cloudFrontDistributionProps, false) : defaultprops;
  // Create the Cloudfront Distribution
  const cfDistribution: cloudfront.Distribution = new cloudfront.Distribution(scope, 'CloudFrontDistribution', cfprops);
  updateSecurityPolicy(cfDistribution);

  return [cfDistribution, cloudfrontFunction, loggingBucket];
}

export function CloudFrontDistributionForS3(scope: cdk.Construct,
  sourceBucket: s3.IBucket,
  cloudFrontDistributionProps?: cloudfront.DistributionProps | any,
  httpSecurityHeaders?: boolean): [cloudfront.Distribution,
    cloudfront.Function?, s3.Bucket?] {

  let defaultprops: cloudfront.DistributionProps;
  let cloudfrontFunction;
  let loggingBucket;
  const _httpSecurityHeaders = (httpSecurityHeaders !== undefined && httpSecurityHeaders === false) ? false : true;

  if (_httpSecurityHeaders) {
    cloudfrontFunction = defaultCloudfrontFunction(scope);
  }

  if (cloudFrontDistributionProps && cloudFrontDistributionProps.enableLogging && cloudFrontDistributionProps.logBucket) {
    defaultprops = DefaultCloudFrontWebDistributionForS3Props(sourceBucket,
      cloudFrontDistributionProps.logBucket, _httpSecurityHeaders, cloudfrontFunction);
  } else {
    loggingBucket = createLoggingBucket(scope, 'CloudfrontLoggingBucket');
    defaultprops = DefaultCloudFrontWebDistributionForS3Props(sourceBucket, loggingBucket,
      _httpSecurityHeaders, cloudfrontFunction);
  }

  const cfprops = cloudFrontDistributionProps ? overrideProps(defaultprops, cloudFrontDistributionProps, false) : defaultprops;
  // Create the Cloudfront Distribution
  const cfDistribution: cloudfront.Distribution = new cloudfront.Distribution(scope, 'CloudFrontDistribution', cfprops);
  updateSecurityPolicy(cfDistribution);

  // Extract the CfnBucketPolicy from the sourceBucket
  const bucketPolicy = sourceBucket.policy as s3.BucketPolicy;
  // the lack of a bucketPolicy means the bucket was imported from outside the stack so the lack of cfn_nag suppression is not an issue
  if (bucketPolicy) {
    addCfnSuppressRules(bucketPolicy, [
      {
        id: 'F16',
        reason: `Public website bucket policy requires a wildcard principal`
      }
    ]);
  }
  return [cfDistribution, cloudfrontFunction, loggingBucket];
}

export function CloudFrontDistributionForMediaStore(scope: cdk.Construct,
  mediaStoreContainer: mediastore.CfnContainer,
  cloudFrontDistributionProps?: cloudfront.DistributionProps | any,
  httpSecurityHeaders?: boolean): [cloudfront.Distribution,
    s3.Bucket, cloudfront.OriginRequestPolicy, cloudfront.Function?] {

  let defaultprops: cloudfront.DistributionProps;
  let originRequestPolicy: cloudfront.OriginRequestPolicy;
  let loggingBucket: s3.Bucket;
  let cloudfrontFunction;
  const _httpSecurityHeaders = (httpSecurityHeaders !== undefined && httpSecurityHeaders === false) ? false : true;

  if (_httpSecurityHeaders) {
    cloudfrontFunction = defaultCloudfrontFunction(scope);
  }

  if (cloudFrontDistributionProps && cloudFrontDistributionProps.enableLogging && cloudFrontDistributionProps.logBucket) {
    loggingBucket = cloudFrontDistributionProps.logBucket as s3.Bucket;
  } else {
    loggingBucket = createLoggingBucket(scope, 'CloudfrontLoggingBucket');
  }

  if (cloudFrontDistributionProps
    && cloudFrontDistributionProps.defaultBehavior
    && cloudFrontDistributionProps.defaultBehavior.originRequestPolicy) {
    originRequestPolicy = cloudFrontDistributionProps.defaultBehavior.originRequestPolicy;
  } else {
    const originRequestPolicyProps: cloudfront.OriginRequestPolicyProps = {
      headerBehavior: {
        behavior: 'whitelist',
        headers: [
          'Access-Control-Allow-Origin',
          'Access-Control-Request-Method',
          'Access-Control-Request-Header',
          'Origin'
        ]
      },
      queryStringBehavior: {
        behavior: 'all'
      },
      cookieBehavior: {
        behavior: 'none'
      },
      comment: 'Policy for Constructs CloudFrontDistributionForMediaStore',
      originRequestPolicyName: `${cdk.Aws.STACK_NAME}-${cdk.Aws.REGION}-CloudFrontDistributionForMediaStore`
    };

    originRequestPolicy = new cloudfront.OriginRequestPolicy(scope, 'CloudfrontOriginRequestPolicy', originRequestPolicyProps);
  }

  defaultprops = DefaultCloudFrontDisributionForMediaStoreProps(
    mediaStoreContainer,
    loggingBucket,
    originRequestPolicy,
    _httpSecurityHeaders,
    cloudFrontDistributionProps?.customHeaders,
    cloudfrontFunction
  );

  let cfprops: cloudfront.DistributionProps;

  if (cloudFrontDistributionProps) {
    cfprops = overrideProps(defaultprops, cloudFrontDistributionProps, false);
  } else {
    cfprops = defaultprops;
  }

  // Create the CloudFront Distribution
  const cfDistribution: cloudfront.Distribution = new cloudfront.Distribution(scope, 'CloudFrontDistribution', cfprops);
  updateSecurityPolicy(cfDistribution);

  return [cfDistribution, loggingBucket, originRequestPolicy, cloudfrontFunction];
}

export function CloudFrontOriginAccessIdentity(scope: cdk.Construct, comment?: string) {
  return new cloudfront.OriginAccessIdentity(scope, 'CloudFrontOriginAccessIdentity', {
    comment: comment ? comment : `access-identity-${cdk.Aws.REGION}-${cdk.Aws.STACK_NAME}`
  });
}