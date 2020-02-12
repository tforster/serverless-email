# Serverless Email Suite

A suite of components that implement a simple serverless UI along with serverless email sending, receiving and forwarding.

## Table of Contents

- [Serverless Email Suite](#serverless-email-suite)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
    - [Configure S3 for Email Storage](#configure-s3-for-email-storage)
    - [Configure SES for Email Receipt and Saving to S3](#configure-ses-for-email-receipt-and-saving-to-s3)
    - [Deploy (optional) Email Forwarding Lambda](#deploy-optional-email-forwarding-lambda)
  - [For Module Developers](#for-module-developers)
  - [Built With](#built-with)
  - [Change Log](#change-log)

## Installation

This first release of the suite includes basic instructions for setting up AWS SES and S3 to receive email, as well an optional email forwarding Lambda. Future versions will including a PWA email client, email foldering and the ability to compose and send messages.

It is only necessary to clone this repository if you are planning to use the email forwarding Lambda function.

`git clone etc`

To configure AWS for receiving email you will need to create an S3 bucket to function as your email store, and SES to save received messages to the bucket.

### Configure S3 for Email Storage

1. Create a bucket in your preferred region. I suggest `mail.{your-domain}.{tld}` as it is self-explanatory and likely available since S3 bucket names must be globally unique.
2. Accept all the S3 bucket creation defaults (works as of 2020-02-11)
3. Add the following bucket policy after editing the {BUCKET-NAME} and {AWSACCOUNTID} parameters accordingly.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSESPuts",
      "Effect": "Allow",
      "Principal": {
        "Service": "ses.amazonaws.com"
      },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::{BUCKET-NAME}/*",
      "Condition": {
        "StringEquals": {
          "aws:Referer": "{AWSACCOUNTID}"
        }
      }
    }
  ]
}
```

### Configure SES for Email Receipt and Saving to S3

AWS SES needs to be configured to listen on a domain for incoming SMTP messages.

1. Select your region in the AWS SES console. Note that SES is not available in all regions. For North America I suggest selecting us-east-1.
2. Verify that you own the domain in question by selecting and following the prompts from the Domains left nav item.
3. Once verified, create a new incoming rule set under Email Receiving in the left nav.
4. I suggest naming the rule inbox so that it matches with the S3 bucket
5. For recipients `*@{your-domain}.{tld}` will match all incoming messages.
6. Add a new S3 action. Select the S3 bucket from above and create an Object key prefix of inbox. This will force SES to save new emails in a folder called inbox, allowing us to support email folders in future release. Leave the Encrypt Message checkbox empty.
7. Save the rule.
8. Test SES-to-S3 by sending a test message from an existing email account to a valid recipient if you defined individual recipients, or simply `test@{your-domain}.{tld}` if you are using a wildcard catch-all. The S3 bucket should contain the new raw email data.

### Deploy (optional) Email Forwarding Lambda

The Email Forwarding Lambda found in src/services/forward is optional but useful if you wish to auto-forward all incoming email to another email address.

The Lambda uses the Serverless Framework to simplify configuration and deployment. Serverless and other dependencies can be installed with NPM.

1. From your terminal, cd into the src/services/forward directory
2. Run `npm i` to install all dependencies
3. Create a .env file to contain configuration to pass to Lambda. Note that .env files often contain sensitive data and as such are gitignored in this repository. The following .env snippet contains example data that should be edited. Note: Remove all the comments below before saving the .env file.

    ```bash
    S3_BUCKET=mail.tforster.com                   # Name from step 1 of S3 configuration
    S3_REGION=ca-central-1                        # Region where the S3 bucket was created
    S3_EMAIL_PREFIX=inbox                         # Optional Object key prefix from SES step 6
    FORWARD_TO_ADDRESS=troy.forster@gmail.com     # Email address to forward to
    VERIFIED_FROM_ADDRESS=troy.forster@gmail.com  # SES verified email address to send as
    SUBJECT_PREFIX=S3-forwarded:                  # Optional subject line prefix to add
    AWS_ACCOUNT_ID=012345678901                   # Your AWS Account Id
    ```

4. Deploy the function using the Serverless framework via `sls deploy`.
5. Navigate to the AWS SES console and edit the rule created in step 3 of SES Configuration and add a new action after the first (S3) action:
   1. Choose Lambda function for the action type
   2. Select the Lambda function created in step 5
   3. Ensure invocation type is set to Event
   4. Save Rule
6. Send a test message and confirm that it is forwarded to your account.

## For Module Developers

After cloning this repository be sure to run `npm i` to install the runtime as well as developer dependencies. This module was created with the help of the [Serverless Framework](https://http://serverless.com/) and you should be familiar with how it works. This source code assumes you will use the [serverless offline plugin](https://github.com/dherault/serverless-offline) to emulate AWS λ and API Gateway locally. An NPM script is provided to easily launch the plugin on port 3000. If you are using Visual Studio Code please consider adding the following profile to .vscode/launch.json. It will connect the VSCode debugger to the running offline plugin and allow you to step through the Lambda source.

```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach",
  "cwd": "${fileDirname}",
  "port": 9229,
  "skipFiles": [
    "<node_internals>/**"
  ]
},
```

## Built With

The following is a list of the technologies used to develop and manage this project.

| Tool                                                                                                              | Description                                                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [AWS-SDK](https://aws.amazon.com/sdk-for-node-js/)                                                                | Helps orchestrate S3 and Cloudfront management                                                       |
| [Coffee](https://en.wikipedia.org/wiki/Coffee)                                                                    | A good source of [C8H10N4O2](https://pubchem.ncbi.nlm.nih.gov/compound/caffeine)                     |
| [DatoCMS](https://www.datocms.com)                                                                                | A GraphQL native CaaS                                                                                |
| [Git 2.17.1](https://git-scm.com/)                                                                                | Source Code Management (SCM) client                                                                  |
| [Joy](https://github.com/tforster/joy)                                                                            | A semi-opinionated framework for managing some common devops tasks                                   |
| [NodeJS 12.3.0](https://nodejs.org/en/)                                                                           | Task running, automation and driving the API                                                         |
| [NPM 6.10.1](https://www.npmjs.com/package/npm)                                                                   | Node package management                                                                              |
| [Oh-My-Zsh](https://github.com/robbyrussell/oh-my-zsh)                                                            | ZSH shell enhancement                                                                                |
| [Serverless Framework](https://serverless.com)                                                                    |                                                                                                      |
| [Ubuntu 18.04 for WSL2](https://www.microsoft.com/en-ca/p/ubuntu/9nblggh4msv6?activetab=pivot:overviewtab)        | Canonical supported Ubuntu for Windows Subsystem for Linux                                           |
| [Visual Studio Code 1.41.1](https://code.visualstudio.com/)                                                       | Powerful and cross-platform code editor                                                              |
| [Windows 10 Pro Insider Preview](https://www.microsoft.com/en-us/software-download/windowsinsiderpreviewadvanced) | The stable version of the Insiders build typically brings new tools of significant use to developers |
| [WSL 2](https://docs.microsoft.com/en-us/windows/wsl/install-win10)                                               | Windows Subsystem for Linux supports native Linux distributions                                      |
| [ZSH](https://www.zsh.org/)                                                                                       | A better shell than Bash                                                                             |

## Change Log

v0.0.1 **Initial creation** (2020-02-12)
