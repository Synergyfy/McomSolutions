# Payment Rules

Stack: Stripe + PayPal (both integrated)

## General Principles
- **Never trust the client** — all payment amounts and eligibility checks happen server-side.
- **Idempotency** — every payment operation is idempotent. Retry with the same idempotency key won't charge twice.
- **Audit trail** — every payment event is logged: initiated, succeeded, failed, refunded.
- **Currency** — all amounts stored in minor units (kobo/cents) as integers. Display formatting happens on the frontend.
- **Time zone** — all payment dates stored in UTC.

## Stripe Integration

### Checkout Session
```ts
async createCheckoutSession(userId: string, priceId: string) {
  const session = await stripe.checkout.sessions.create({
    customer: await this.getOrCreateStripeCustomer(userId),
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${this.frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${this.frontendUrl}/payment/cancel`,
    metadata: { userId },
  })
  return { url: session.url, sessionId: session.id }
}
```

### Webhook Handling
```ts
@Post('stripe/webhook')
@ApiExcludeEndpoint() // Not exposed in Swagger
async handleStripeWebhook(@Req() req: Request) {
  const sig = req.headers['stripe-signature'] as string
  const event = stripe.webhooks.constructEvent(
    req.body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET,
  )

  switch (event.type) {
    case 'checkout.session.completed':
      await this.handleCheckoutCompleted(event.data.object)
      break
    case 'invoice.payment_succeeded':
      await this.handleInvoicePaymentSucceeded(event.data.object)
      break
    case 'invoice.payment_failed':
      await this.handleInvoicePaymentFailed(event.data.object)
      break
    case 'customer.subscription.updated':
      await this.handleSubscriptionUpdated(event.data.object)
      break
    case 'customer.subscription.deleted':
      await this.handleSubscriptionDeleted(event.data.object)
      break
  }
}
```

## PayPal Integration

### Order Creation
```ts
async createPayPalOrder(userId: string, planId: string) {
  const plan = await this.pricingService.getPlan(planId)
  const request = new orders.OrdersCreateRequest()
  request.prefer('return=representation')
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: { currency_code: 'USD', value: plan.price.toString() },
      description: plan.name,
      custom_id: userId,
    }],
  })
  const { result } = await this.paypalClient.execute(request)
  return { id: result.id, status: result.status }
}
```

### Webhook Handling
```ts
@Post('paypal/webhook')
@ApiExcludeEndpoint()
async handlePayPalWebhook(@Req() req: Request) {
  const verified = await this.verifyPayPalWebhook(req)
  if (!verified) throw new UnauthorizedException('Invalid webhook signature')

  const event = req.body
  switch (event.event_type) {
    case 'CHECKOUT.ORDER.APPROVED':
      // Capture the order
      break
    case 'PAYMENT.CAPTURE.COMPLETED':
      await this.handlePaymentCompleted(event.resource)
      break
    case 'PAYMENT.CAPTURE.REFUNDED':
      await this.handlePaymentRefunded(event.resource)
      break
  }
}
```

## Database Schema

```prisma
model Payment {
  id            String   @id @default(cuid())
  userId        String   @map("user_id")
  provider      String   // 'stripe' | 'paypal'
  providerId    String   @map("provider_id")     // Stripe session ID / PayPal order ID
  amount        Int      // in cents/kobo
  currency      String   @default("NGN")
  status        String   // 'pending' | 'completed' | 'failed' | 'refunded'
  metadata      Json?    // raw provider response
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@index([provider, status])
  @@index([providerId])
  @@map("payments")
}

model Subscription {
  id            String    @id @default(cuid())
  userId        String    @map("user_id")
  tier          String    // membership: BRONZE, SILVER, GOLD, PLATINUM
  status        String    // 'active' | 'inactive' | 'expired' | 'cancelled'
  provider      String    // 'stripe' | 'paypal'
  providerSubId String?   @map("provider_sub_id")  // Stripe subscription ID / PayPal plan ID
  currentPeriodStart DateTime @map("current_period_start")
  currentPeriodEnd   DateTime @map("current_period_end")
  cancelAtPeriodEnd  Boolean  @default(false) @map("cancel_at_period_end")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  @@index([userId, status])
  @@index([provider, providerSubId])
  @@map("subscriptions")
}
```

## Idempotency Key Pattern

```ts
async chargeWithIdempotency(userId: string, amount: number, idempotencyKey: string) {
  // Check if already processed
  const existing = await prisma.payment.findUnique({ where: { idempotencyKey } })
  if (existing) return existing

  // Process payment
  const payment = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    metadata: { userId, idempotencyKey },
  }, { idempotencyKey })

  return prisma.payment.create({
    data: { userId, amount, provider: 'stripe', providerId: payment.id, status: 'pending', idempotencyKey },
  })
}
```

## Error Handling

| Scenario | Action |
|----------|--------|
| Payment declined | Log, notify user via email, update subscription status to `past_due` |
| Webhook signature invalid | Reject with 401, log as security event |
| Webhook processing fails | Return 200 anyway (Stripe/PayPal will retry), log for manual review |
| Duplicate webhook event | Check `providerId` uniqueness in DB before processing |
| Refund initiated | Update payment status, adjust user's subscription if needed |
| Subscription cancellation | Set `cancelAtPeriodEnd = true`, don't revoke access until period ends |

## Webhook Security
- Webhook endpoints are `@ApiExcludeEndpoint()` — not visible in Swagger.
- Always verify webhook signatures using provider SDKs.
- Webhook handlers are idempotent — replay-safe.
- Run webhook processing in the background (Bull queue) if processing is heavy.

## Testing Payments
- Use Stripe test mode / PayPal sandbox in development.
- Test cards: `4242 4242 4242 4242` (Visa success), `4000 0000 0000 0002` (decline).
- Store test webhook secrets in `.env` not `.env.example`.
- Write tests that mock Stripe/PayPal clients — never use real API keys in tests.
