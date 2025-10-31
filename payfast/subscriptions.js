const { generateSignature } = require('./payfast');

function buildSubscriptionParams({ merchantId, merchantKey, returnUrl, cancelUrl, notifyUrl, m_payment_id, amount, item_name, email, intervalUnit, intervalCount, passphrase }) {
  const params = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    m_payment_id,
    amount: Number(amount).toFixed(2),
    item_name,
    email_address: email || '',
    subscription_type: '1',
    recurring_amount: Number(amount).toFixed(2),
    recurring_frequency: intervalUnit,
    recurring_cycles: '',
  };

  params.signature = generateSignature(params, passphrase || '');
  return params;
}

module.exports = { buildSubscriptionParams };
