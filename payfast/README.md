# PayFast Custom Integration Example (ECDcoding)

This sample demonstrates a simple PayFast custom integration using Node.js + Express.

Features:
- Create a payment request (redirect the user to PayFast)
- Generate PayFast signature (MD5)
- IPN (notify_url) endpoint that:
  - verifies signature locally
  - performs server-to-server validation with PayFast (/eng/query/validate)
  - checks amount and payment status to finalize order

Important configuration:
- PAYFAST_MODE: "sandbox" or "live"
- PAYFAST_MERCHANT_ID: merchant id from PayFast dashboard (sandbox test details below)
- PAYFAST_MERCHANT_KEY: merchant key
- PAYFAST_PASSPHRASE: optional, only if you set a passphrase in PayFast

Sandbox test credentials (PayFast-provided test account):
- merchant_id: 10000100
- merchant_key: 46f0cd694581a
- Passphrase: (blank by default)

PayFast URLs:
- Sandbox process URL: https://sandbox.payfast.co.za/eng/process
- Live process URL: https://www.payfast.co.za/eng/process
- Sandbox validation URL: https://sandbox.payfast.co.za/eng/query/validate
- Live validation URL: https://www.payfast.co.za/eng/query/validate

How to run:
1. Copy files into your project.
2. Install dependencies:
   npm install express dotenv
   (If using Node <18 you may need node-fetch; otherwise global fetch is available)
3. Create an .env from .env.example and set PAYFAST_* variables and PUBLIC_BASE_URL
4. Start server: node server.js
5. Visit http://localhost:3000/payment.html, fill an amount and click "Pay with PayFast".

IPN notes:
- The notify_url must be publicly reachable by PayFast. When testing locally, use ngrok or a publicly reachable host.
- Always verify:
  1. Signature matches (local)
  2. POST back to PayFast validation endpoint — expect "VALID"
  3. transaction status is COMPLETE (or accepted statuses), and amounts match expected
  4. Optionally check PayFast IP whitelist

Security:
- Your server must run over HTTPS in production.
- Store merchant credentials in environment variables (never in source).
- Validate amounts and order IDs on IPN before granting access or activating accounts.

## Testing

This section explains two quick ways to make your local PayFast server publicly reachable so PayFast can POST IPNs to /ipn: using ngrok (recommended for local machines) and using Codespaces forwarded ports (convenient when testing inside GitHub Codespaces).

### Option A — ngrok (recommended for local testing)

1. Install ngrok (https://ngrok.com/) and run it against the port your server uses (default 3000):

   ngrok http 3000

2. Copy the HTTPS forwarding URL that ngrok prints (example: https://abcd1234.ngrok.io).
3. In your local project create a `.env` file (do not commit it) and set PUBLIC_BASE_URL to the ngrok URL, then restart your server so dotenv reads the new value.
   - Example notify_url will be: https://abcd1234.ngrok.io/ipn
4. Start the server and create a sandbox payment. Watch your server logs for the IPN POST from PayFast.

Notes:
- If you change ngrok sessions the URL will change — update PUBLIC_BASE_URL and restart the server each time.
- Use the sandbox credentials above for testing.

### Option B — GitHub Codespaces forwarded port

1. In your Codespace start the server (in the terminal):

   npm install
   node server.js

2. Open the Ports view in the Codespace UI (left sidebar).
3. Locate port 3000 and click the globe icon → choose "Make public" (if it isn't already public).
4. Click the "Open in Browser" (globe) action for the forwarded port and copy the public URL that the Codespace provides (example: https://3000-your-codespace-id.githubpreview.dev).
5. Update your local `.env` in the Codespace or the Codespaces secret PUBLIC_BASE_URL to this URL and restart the server.
6. Use that public URL as the base for return_url/cancel_url/notify_url when creating payments. Example notify_url: https://<codespace-url>/ipn

Notes:
- Codespaces public URLs may change when the Codespace restarts — update PUBLIC_BASE_URL accordingly.

### Sample .env for sandbox testing

```env
NODE_ENV=development
PORT=3000

# PayFast settings
PAYFAST_MODE=sandbox
PAYFAST_MERCHANT_ID=10000100
PAYFAST_MERCHANT_KEY=46f0cd694581a
PAYFAST_PASSPHRASE=

# Publicly reachable base URL for this server used for return/cancel/notify
# Example: https://abcd1234.ngrok.io or Codespaces forwarded URL
PUBLIC_BASE_URL=http://localhost:3000
```

Tips
- Ensure `.env` is listed in `.gitignore` so you don't accidentally commit secrets.
- When testing IPNs use the sandbox PayFast account and verify signatures and server-to-server validation in your logs.
- If IPNs don't arrive, check that the notify_url included in the payment form exactly matches your PUBLIC_BASE_URL + /ipn and is reachable from the public internet.

---