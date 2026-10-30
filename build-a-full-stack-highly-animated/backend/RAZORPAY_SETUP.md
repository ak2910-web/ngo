# Razorpay donations — staging setup

The donation page uses Razorpay Checkout in **Test Mode**. The backend creates every order, verifies the Checkout signature, checks the payment against Razorpay's API, and stores donation records in MongoDB. The Razorpay secret is never sent to the browser.

## Render backend environment

Set these on the backend Render service:

- `RAZORPAY_KEY_ID`: Test Mode Key ID (safe to expose as the public checkout key, but keep it configured server-side).
- `RAZORPAY_KEY_SECRET`: Test Mode Key Secret. Secret; never put it in frontend files, GitHub, or browser code.
- `RAZORPAY_WEBHOOK_SECRET`: Optional until a webhook is configured. Use a new webhook signing secret created in Razorpay Dashboard; this is distinct from the API Key Secret.

Keep `FRONTEND_ORIGIN` set to the exact deployed frontend origin, e.g. `https://earthkind-ngo.onrender.com`, without a trailing slash.

## Configure the webhook

In Razorpay Dashboard, while in Test Mode, create a webhook pointing to:

`https://ngo-pi3s.onrender.com/api/payments/razorpay/webhook`

Set a strong webhook secret, save it as `RAZORPAY_WEBHOOK_SECRET` in Render, and subscribe to:

- `payment.captured`
- `payment.failed`

The webhook endpoint verifies the HMAC signature over the raw request body. Do not use the API Key Secret as the webhook secret.

## Donation flow

1. The browser submits amount, donor name, and email to `POST /api/payments/razorpay/orders`.
2. The server validates the input and creates a Razorpay INR order using server-side credentials.
3. The browser opens Razorpay Checkout using the public Key ID and returned order.
4. The browser submits Checkout's order/payment/signature tuple to `POST /api/payments/razorpay/verify`.
5. The server verifies the HMAC signature, fetches the payment from Razorpay, checks order, amount, and currency, and only marks captured payments as paid.
6. Signed webhooks provide an independent update for captured/failed payments.

## Test checklist

- Use Razorpay Test Mode only.
- Check that the Render backend deploys successfully and its logs show the API listening.
- Open the frontend donation page; select a suggested amount and enter a test donor name/email.
- Confirm an order is created and Checkout opens.
- Complete a successful Razorpay test payment; verify the page shows confirmation.
- Confirm the corresponding `Donation` document is stored in MongoDB with `status: "paid"`, correct amount in paise, order ID, payment ID, and `paidAt`.
- Test a failed/cancelled payment and verify it is not marked paid.
- Send a test webhook from Razorpay Dashboard and confirm signature verification succeeds.
- Confirm an invalid signature is rejected.

A successful deployment or successful Checkout popup is not proof of a captured payment. Do not switch to Live Mode until live KYC/account activation, webhook configuration, capture settings, and end-to-end tests have been checked.
