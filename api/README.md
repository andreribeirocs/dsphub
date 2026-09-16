<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Environment Variables

The following environment variables are required:

### Database

- `DATABASE_URL` - PostgreSQL database connection string

### Authentication

- `JWT_SECRET` - Secret key for JWT token generation

### Messaging (WhatsApp / SMS)

No messaging provider is connected yet. All sending goes through `src/messaging`
(`MessagingProvider` interface, bound in `messaging.module.ts`). While the default
log-only provider is active, nothing is sent and the API reports that messaging is not configured.

- `RECRUITMENT_INVITE_TEMPLATE` - WhatsApp template name used for candidate registration invites (optional, default `registration_link`)

### Email Service (SMTP)

- `SMTP_HOST` - SMTP server host (e.g., `smtp.gmail.com`, `smtp.sendgrid.net`)
- `SMTP_PORT` - SMTP server port (e.g., `587` for TLS, `465` for SSL)
- `SMTP_SECURE` - Use SSL (e.g., `false` for TLS/STARTTLS, `true` for SSL)
- `SMTP_USER` - SMTP authentication username (usually your email)
- `SMTP_PASSWORD` - SMTP authentication password (app-specific password recommended)
- `SMTP_FROM_NAME` - Sender name for emails (e.g., `Driver Hub`)
- `SMTP_FROM_EMAIL` - Sender email address (e.g., `noreply@driverhub.com`)

### Invoice System

- `INVOICE_AUTO_GENERATE` - Enable automatic weekly invoice generation (e.g., `true` or `false`)
- `INVOICE_GENERATION_DAY` - Day of week for auto-generation (currently fixed to Sunday in code)
- `INVOICE_GENERATION_TIME` - Time for auto-generation (currently fixed to midnight in code)

### General

- `NODE_ENV` - Environment (`development`, `production`)

## Invoice System Setup

The invoice system automatically generates weekly invoices for all active drivers every Sunday at midnight (configurable). Invoices cover the week from Sunday to Saturday. To use the invoice system:

1. **Configure Email (SMTP)**:
   - Set all SMTP environment variables
   - For Gmail: Use an app-specific password (see [Google App Passwords](https://support.google.com/accounts/answer/185833))
   - For SendGrid: Use your SendGrid API key as the password
   - For AWS SES: Configure with your SES SMTP credentials

2. **Enable Automatic Generation** (optional):

   ```env
   INVOICE_AUTO_GENERATE=true
   ```

3. **Manual Invoice Generation**:
   - Use the API endpoint `POST /invoices/generate-weekly` with `weekStartDate`
   - Or use the frontend UI to generate invoices for any week

4. **Invoice Workflow**:
   1. Generate invoices (automatically or manually)
   2. Review invoices in the UI (status: DRAFT)
   3. Edit if needed (amounts, notes, line items)
   4. Approve invoices (generates PDF, status: APPROVED)
   5. Send invoices via email in bulk (status: SENT)

5. **PDF Storage**:
   - PDFs are stored in `uploads/invoices/{year}/week-{weekNumber}/`
   - Ensure the server has write permissions to the `uploads` directory

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
