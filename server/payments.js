// Payments: Pro subscriptions (collect N5,000) and creator payouts (send royalties to a bank).
//
// Providers share one interface:
//   charge({ reference, amount, walletAccountNo, narration })  -> { status: 'SUCCESS'|'PENDING'|'FAILED', providerRef }
//   status(reference)                                          -> { status }
//   nameEnquiry({ accountNo, bankCode })                       -> { accountName }
//   transfer({ reference, amount, bankCode, accountNo, accountName, narration }) -> { status, providerRef }
//
// 'accessbank' follows Access Bank's Wallet-as-a-Service (WaaS) API used by the Africa Fintech Foundry:
//   POST /waas/Client/authenticate                 (Authorization key + Ocp-Apim-Subscription-Key, body { merchantId })
//   POST /waas/Transaction/debitWallet             (collect from the customer's Access wallet)
//   GET  /waas/Transaction/nameEnquiry             (verify a creator's bank account)
//   POST /waas/Transaction/wallet2OtherBank        (pay creators from Animora's wallet)
//   POST /waas/Transaction/transactionStatusCheck  (?tran_reference=msgId)
// 'sandbox' simulates the same flow locally so the demo works with no credentials.

import { randomBytes } from 'node:crypto';
import { config } from './config.js';

export const BANKS = [
  { code: '044', name: 'Access Bank' }, { code: '058', name: 'GTBank' }, { code: '057', name: 'Zenith Bank' },
  { code: '011', name: 'First Bank' }, { code: '033', name: 'UBA' }, { code: '070', name: 'Fidelity Bank' },
  { code: '214', name: 'FCMB' }, { code: '032', name: 'Union Bank' }, { code: '232', name: 'Sterling Bank' },
  { code: '035', name: 'Wema Bank' }, { code: '221', name: 'Stanbic IBTC' }, { code: '050', name: 'Ecobank' },
  { code: '076', name: 'Polaris Bank' }, { code: '082', name: 'Keystone Bank' }, { code: '50211', name: 'Kuda' },
  { code: '999992', name: 'OPay' }, { code: '50515', name: 'Moniepoint' }, { code: '999991', name: 'PalmPay' },
];

export const newReference = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

// ---------------------------------------------------------------------------
// Sandbox: deterministic rules so you can demo success and failure
//   wallet / account numbers ending in 0 -> FAILED (insufficient funds / invalid account)
//   anything else (10 digits)           -> SUCCESS
// ---------------------------------------------------------------------------
const sandboxLedger = new Map();
const SANDBOX_NAMES = ['ADEBAYO OLUWASEUN', 'CHIOMA OKAFOR', 'IBRAHIM MUSA', 'FUNMILAYO ADEYEMI', 'EMEKA NWOSU'];

const sandbox = {
  name: 'sandbox',
  async charge({ reference, amount, walletAccountNo }) {
    await new Promise((r) => setTimeout(r, 600));
    if (!/^\d{10}$/.test(walletAccountNo || '')) return { status: 'FAILED', message: 'Enter a 10-digit wallet account number.' };
    const status = walletAccountNo.endsWith('0') ? 'FAILED' : 'SUCCESS';
    sandboxLedger.set(reference, { status, amount });
    return { status, providerRef: `SBX-${reference}`, message: status === 'FAILED' ? 'Insufficient funds in wallet (sandbox).' : 'Payment successful (sandbox).' };
  },
  async status(reference) {
    return { status: sandboxLedger.get(reference)?.status || 'FAILED' };
  },
  async nameEnquiry({ accountNo }) {
    if (!/^\d{10}$/.test(accountNo || '') || accountNo.endsWith('0')) throw new Error('Invalid account number (sandbox: numbers ending in 0 fail).');
    return { accountName: SANDBOX_NAMES[Number(accountNo.slice(-1)) % SANDBOX_NAMES.length] };
  },
  async transfer({ reference, amount }) {
    await new Promise((r) => setTimeout(r, 600));
    sandboxLedger.set(reference, { status: 'SUCCESS', amount });
    return { status: 'SUCCESS', providerRef: `SBX-${reference}` };
  },
};

// ---------------------------------------------------------------------------
// Access Bank WaaS
// ---------------------------------------------------------------------------
let tokenCache = { token: null, exp: 0 };

async function abFetch(path, { method = 'POST', body, query } = {}, retry = true) {
  const ab = config.accessBank;
  if (!ab.baseUrl || !ab.authorizationKey || !ab.subscriptionKey || !ab.merchantId) {
    throw new Error('Access Bank is not configured. Set ACCESSBANK_BASE_URL, ACCESSBANK_AUTHORIZATION_KEY, ACCESSBANK_SUBSCRIPTION_KEY and ACCESSBANK_MERCHANT_ID.');
  }
  if (!tokenCache.token || Date.now() > tokenCache.exp) {
    const res = await fetch(`${ab.baseUrl}/waas/Client/authenticate`, {
      method: 'POST',
      headers: { Authorization: ab.authorizationKey, 'Ocp-Apim-Subscription-Key': ab.subscriptionKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId: ab.merchantId }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.data?.accessToken) throw new Error(`Access Bank auth failed (${res.status}): ${j.message || 'no token'}`);
    // Tokens live ~120s; refresh 15s early.
    tokenCache = { token: j.data.accessToken, exp: Date.now() + Math.max(30, (j.data.expiresIn || 120) - 15) * 1000 };
  }
  const qs = query ? `?${new URLSearchParams(query)}` : '';
  const res = await fetch(`${ab.baseUrl}${path}${qs}`, {
    method,
    headers: { Authorization: `Bearer ${tokenCache.token}`, 'Ocp-Apim-Subscription-Key': ab.subscriptionKey, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry) { tokenCache = { token: null, exp: 0 }; return abFetch(path, { method, body, query }, false); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.succeeded === false) throw new Error(`Access Bank ${path} failed (${res.status}): ${j.message || JSON.stringify(j.errors || {})}`);
  return j;
}

const normStatus = (s) => (/success/i.test(s) ? 'SUCCESS' : /pend|process/i.test(s) ? 'PENDING' : 'FAILED');

const accessbank = {
  name: 'accessbank',
  async charge({ reference, amount, walletAccountNo, narration }) {
    const j = await abFetch('/waas/Transaction/debitWallet', {
      body: { debitAccountNo: walletAccountNo, amount, msgId: reference, narration: narration || 'Animora Pro subscription' },
    });
    return { status: normStatus(j.data?.status), providerRef: j.data?.transactionRef || reference, message: j.message };
  },
  async status(reference) {
    const j = await abFetch('/waas/Transaction/transactionStatusCheck', { query: { tran_reference: reference } });
    return { status: normStatus(j.data?.status) };
  },
  async nameEnquiry({ accountNo, bankCode }) {
    const j = await abFetch('/waas/Transaction/nameEnquiry', { method: 'GET', query: { accountNo, bankCode } });
    return { accountName: j.data?.accountName };
  },
  async transfer({ reference, amount, bankCode, accountNo, narration }) {
    const ab = config.accessBank;
    const j = await abFetch('/waas/Transaction/wallet2OtherBank', {
      body: {
        debitAccountNo: ab.sourceWallet, debitAccountName: ab.sourceWalletName,
        creditBankCode: bankCode, creditAccountNo: accountNo, amount, msgId: reference,
        narration: narration || 'Animora creator royalties',
      },
    });
    return { status: normStatus(j.data?.status), providerRef: j.data?.transactionRef || reference };
  },
};

export const provider = () => (config.paymentProvider === 'accessbank' ? accessbank : sandbox);
