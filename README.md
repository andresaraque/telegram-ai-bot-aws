# Serverless Telegram Bot: Event-Driven Architecture on AWS with CDK

A high-performance, scalable, and cost-effective Telegram Bot built with **AWS CDK** and **TypeScript**. This project leverages an **Event-Driven Architecture (EDA)** to handle high traffic and complex workflows without hitting Telegram's webhook timeouts.

[![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/)
[![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/en)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Telegram](https://img.shields.io/badge/-telegram-fff?style=for-the-badge&logo=telegram&logoColor=26A5E4)](https://telegram.org/)


## 🏗️ Architecture Overview

Unlike traditional bots that process logic within the request-response cycle, this bot uses an **asynchronous pattern**:

1.  **Telegram Webhook**: Sends a POST request to **Amazon API Gateway**.
2.  **Webhook Controller (Lambda)**: A lightweight ARM_64 function that validates the request, insert data to **DynamoDB**, and immediately returns a `200 OK`.
3.  **DynamoDB (Streams)**: trigger lambda message stream processor.
4.  **Message stream processor lambda**: invoke AI lambda.
5.  **Ai Lambda** Get history, call Bedrock model and generate a response.

## ⚡ Key Features

- **Extreme Performance**: Powered by Node.js 22 and Graviton2 (ARM_64) processors.
- **Zero-Timeout Design**: Decoupling ingestion from processing ensures the webhook never hangs.
- **Fully Automated**: Infrastructure as Code (IaC) via AWS CDK.
- **Production Ready**: Includes LogGroups, Secret management, and optimized bundling (Minified, ESM).

## Getting Started

### Prerequisites
* AWS Account & CLI configured.
* Node.js 22.x.
* A Telegram Bot Token (from [@BotFather](https://t.me/botfather)).

### Installation
```bash
git clone [https://github.com/andresaraque/telegram-bot.git](https://github.com/andresaraque/telegram-bot.git)
cd telegram-bot
npm install

## The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
