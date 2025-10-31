const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { generateSignature } = require('./payfast/payfast');
const { buildSubscriptionParams } = require('./payfast/subscription');
const fetch = (typeof global.fetch === 'function') ? global.fetch : require('node-fetch');

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const MODE = (process.env.PAYFAST_MODE || 'sandbox').toLowerCase();
const PAYFAST_BASE = MODE === 'live' ? 'https://www.payfast.co.za' : 'https://sandbox.payfast.co.za';

const MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID;
const MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY;
const PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

// Tiny in-memory stores for demo purposes
const orders = {};
const subscriptions = {};

function buildPayFastForm(actionUrl, params) {
  const inputs = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v)}">`)
    .join('\n');

  return `<!doctype html>\n  <html>\n    <head><meta charset="utf-8"><title>Redirecting to PayFast...</title></head>\n    <body>\n      <p>Redirecting to PayFast — if you are not redirected, click the button below.</p>\n      <form id="payForm" action="${actionUrl}" method="post">\n        ${inputs}\n        <noscript><button type="submit">Pay with PayFast</button></noscript>\n      </form>\n      <script>document.getElementById('payForm').submit();</script>\n    </body>\n  </html>`;
}

/**
 * Create a one-off payment and redirect user to PayFast
 */
app.post('/create-payment', (req, res) => {
  const { amount, item_name, email } = req.body;
  if (!amount || !item_name) return res.status(400).send('amount and item_name required');

  const m_payment_id = `ecd-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  orders[m_payment_id] = { amount: Number(amount), item_name, email, status: 'pending' };

  const payfastParams = {
    merchant_id: MERCHANT_ID,
    merchant_key: MERCHANT_KEY,
    return_url: `${PUBLIC_BASE_URL}/pay-success.html`,
    cancel_url: `${PUBLIC_BASE_URL}/pay-cancel.html`,
    notify_url: `${PUBLIC_BASE_URL}/ipn`,
    m_payment_id,
    amount: Number(amount).toFixed(2),
    item_name,
    email_address: email || '',
  };

  const signature = generateSignature(payfastParams, PASSPHRASE);
  payfastParams.signature = signature;

  const actionUrl = `${PAYFAST_BASE}/eng/process`;
  res.send(buildPayFastForm(actionUrl, payfastParams));
});

/**
 * Create a subscription (initial payment)
 */
app.post('/create-subscription', (req, res) => {
  const { amount, item_name, email, user_id, interval } = req.body;
  if (!amount || !item_name || !interval) return res.status(400).send('amount, item_name and interval required');

  const m_payment_id = `sub-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  subscriptions[m_payment_id] = {
    user_id: user_id || null,
    amount: Number(amount),
    item_name,
    email,
    interval,
    status: 'pending',
  };

  const payfastParams = buildSubscriptionParams({
    merchantId: MERCHANT_ID,
    merchantKey: MERCHANT_KEY,
    returnUrl: `${PUBLIC_BASE_URL}/subscription-success.html`,
    cancelUrl: `${PUBLIC_BASE_URL}/subscription-cancel.html`,
    notifyUrl: `${PUBLIC_BASE_URL}/ipn`,
    m_payment_id,
    amount,
    item_name,
    email,
    intervalUnit: interval,
    intervalCount: 1,
    passphrase: PASSPHRASE,
  });

  const actionUrl = `${PAYFAST_BASE}/eng/process`;
  res.send(buildPayFastForm(actionUrl, payfastParams));
});

/**
 * IPN endpoint
 */
app.post('/ipn', async (req, res) => {
  // Respond quickly
  res.status(200).end();

  try {
    const pfData = req.body;
    const receivedSignature = pfData.signature || '';
    const localSig = generateSignature(pfData, PASSPHRASE);

    if (!receivedSignature || receivedSignature !== localSig) {
      console.warn('IPN signature mismatch', { receivedSignature, localSig });
      return;
    }

    const validateUrl = `${PAYFAST_BASE}/eng/query/validate`;
    const bodyStr = Object.keys(pfData)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(pfData[k])}`)
      .join('&');

    const validateResp = await fetch(validateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyStr,
    });
    const validateText = (await validateResp.text()).trim();
    if (validateText !== 'VALID') {
      console.warn('IPN server-to-server validation failed:', validateText);
      return;
    }

    const m_payment_id = pfData.m_payment_id;
    const payment_status = pfData.payment_status;
    const pf_amount = parseFloat(pfData.amount || '0');

    if (orders[m_payment_id]) {
      const order = orders[m_payment_id];
      if (pf_amount !== Number(order.amount)) {
        console.warn('IPN amount mismatch', { expected: order.amount, received: pf_amount });
        return;
      }
      if (payment_status === 'COMPLETE') {
        order.status = 'paid';
        console.log('Order paid:', m_payment_id);
      }
      return;
    }

    if (subscriptions[m_payment_id]) {
      const sub = subscriptions[m_payment_id];
      if (pf_amount !== Number(sub.amount)) {
        console.warn('IPN subscription amount mismatch', { expected: sub.amount, received: pf_amount });
        return;
      }
      if (payment_status === 'COMPLETE') {
        sub.status = 'active';
        console.log('Subscription payment complete:', m_payment_id);
      }
      return;
    }

    console.warn('IPN received for unknown m_payment_id', m_payment_id);
  } catch (err) {
    console.error('Error processing IPN:', err);
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});

app.listen(PORT, () => {
  console.log(`PayFast test server running on port ${PORT}`);
  console.log(`Mode: ${MODE} (PayFast base: ${PAYFAST_BASE})`);
});