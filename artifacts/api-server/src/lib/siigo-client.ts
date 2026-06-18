// Siigo API client for BizCore.
// Docs: https://developers.siigo.com/docs/siigoapi
//
// Auth: POST https://api.siigo.com/auth → Bearer token (24h)
// All requests require Partner-Id header identifying this integration.

const BASE_URL = "https://api.siigo.com";
const PARTNER_ID = "BizCore";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SiigoInvoice {
  id: number;
  number: string;
  name: string;           // customer name on the invoice
  date: string;           // "YYYY-MM-DD"
  customer: { identification: string; branch_office: number } | null;
  items: SiigoInvoiceItem[];
  payments: SiigoPayment[];
  subtotal: number;
  taxes: SiigoTax[];
  total: number;
  balance: number;
  observations: string;
  stamp: { legalStatus: string; cufe: string; QRCode?: string } | null;
  metadata: { created: string; last_updated: string };
}

export interface SiigoInvoiceItem {
  code: string;
  description: string;
  quantity: number;
  price: number;        // unit price (in currency minor units or COP pesos)
  discount: number;     // percentage 0-100
  total: number;
}

export interface SiigoPayment {
  id: number;
  name: string;         // e.g. "Efectivo", "Tarjeta", "Transferencia"
  value: number;
  due_date: string;
}

export interface SiigoTax {
  id: number;
  name: string;
  percent: string;
  total: number;
}

export interface SiigoPage {
  results: SiigoInvoice[];
  pagination: {
    total_results: number;
    total_pages: number;
    page: number;
    page_size: number;
  };
}

// ─── In-memory token cache (per username) ────────────────────────────────────

interface CachedToken { token: string; expiresAt: number }
const tokenCache = new Map<string, CachedToken>();

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function getSiigoToken(username: string, accessKey: string): Promise<string> {
  const cacheKey = `${username}:${accessKey.slice(0, 8)}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const res = await fetch(`${BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Partner-Id": PARTNER_ID },
    body: JSON.stringify({ username, access_key: accessKey }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Siigo auth failed (${res.status}): ${body}`);
  }

  const data = await res.json() as { access_token: string; token_type: string; expires_in?: number };
  const token = data.access_token;
  // Cache for 23h (Siigo tokens last 24h — leave 1h buffer)
  tokenCache.set(cacheKey, { token, expiresAt: Date.now() + 23 * 60 * 60 * 1000 });
  return token;
}

// ─── Invoice fetching ─────────────────────────────────────────────────────────

export async function getSiigoInvoicePage(
  token: string,
  dateStart: string,
  dateEnd: string,
  page: number,
  pageSize = 100,
): Promise<SiigoPage> {
  const url = new URL(`${BASE_URL}/invoices`);
  url.searchParams.set("date_start", dateStart);
  url.searchParams.set("date_end", dateEnd);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));

  const res = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Partner-Id": PARTNER_ID,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Siigo invoices fetch failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<SiigoPage>;
}

// Fetch all pages for a date range (auto-paginate)
export async function getAllSiigoInvoices(
  token: string,
  dateStart: string,
  dateEnd: string,
): Promise<SiigoInvoice[]> {
  const first = await getSiigoInvoicePage(token, dateStart, dateEnd, 1);
  const all: SiigoInvoice[] = [...first.results];

  for (let page = 2; page <= first.pagination.total_pages; page++) {
    const next = await getSiigoInvoicePage(token, dateStart, dateEnd, page);
    all.push(...next.results);
  }

  return all;
}

// ─── Payment method mapping ───────────────────────────────────────────────────

const SIIGO_METHOD_MAP: Record<string, string> = {
  efectivo: "cash",
  cash: "cash",
  "tarjeta de credito": "card",
  "tarjeta de débito": "card",
  "tarjeta debito": "card",
  tarjeta: "card",
  card: "card",
  transferencia: "transfer",
  transfer: "transfer",
  "transferencia bancaria": "transfer",
  nequi: "nequi",
  daviplata: "daviplata",
};

export function mapSiigoPaymentMethod(name: string): string {
  return SIIGO_METHOD_MAP[name.toLowerCase().trim()] ?? "other";
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function toSiigoDate(d: Date): string {
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}
