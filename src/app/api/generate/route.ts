import { NextResponse } from "next/server";
import { chromium } from "playwright";
import mime from "mime";

export const runtime = "nodejs"; // important

function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isProbablyUrl(s: string) {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function screenshotToDataUri(page: any, url: string) {
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(1200);

  // Try clicking common consent buttons
  const consentLabels = ["Accept", "Accept all", "Allow all", "I agree", "Agree", "OK", "Got it"];
  for (const label of consentLabels) {
    try {
      const btn = page.getByRole("button", { name: label });
      if (await btn.count()) {
        await btn.first().click({ timeout: 1200 });
        await page.waitForTimeout(600);
        break;
      }
    } catch {}
  }

  // Fallback: hide common cookie overlays
  try {
    await page.addStyleTag({
      content: `
        #onetrust-banner-sdk, .onetrust-pc-dark-filter, .onetrust-consent-sdk,
        .cookie-banner, .cookie-consent, .cc-window, .cc-banner,
        [aria-label*="cookie" i], [id*="cookie" i], [class*="cookie" i]
        { display:none !important; visibility:hidden !important; opacity:0 !important; }
      `,
    });
  } catch {}

  await page.waitForTimeout(300);

  const buf: Buffer = await page.screenshot({ fullPage: true });
  return `data:image/png;base64,${buf.toString("base64")}`;
}
export async function POST(req: Request) {
  try {
    const { orderUrl, trackingUrl, termsUrl, messages, disputeReason, uploads } = await req.json();
    const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const context = await browser.newContext({
  locale: "en-GB",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
});

 const page = await context.newPage();


    // OPTIONAL screenshots (only if URL looks valid)
    let orderShot: string | null = null;
    let termsShot: string | null = null;
    let trackingShot: string | null = null;

    orderShot = uploads?.order || null;
    termsShot = uploads?.terms || null;
    trackingShot = uploads?.tracking || null;

console.log("uploads:", {
  order: !!uploads?.order,
  terms: !!uploads?.terms,
  tracking: !!uploads?.tracking,
  orderLen: uploads?.order?.length,
  trackingLen: uploads?.tracking?.length,
});


    const shotErrors: string[] = [];

    async function tryShot(label: string, url: string) {
  try {
    const dataUri = await screenshotToDataUri(page, url);

    // Validate it’s a real image data URI (prevents src="null" / broken icon)
    if (!dataUri || !dataUri.startsWith("data:image/") || dataUri.length < 2000) {
      shotErrors.push(`${label}: Screenshot returned empty/invalid data`);
      return null;
    }

    return dataUri;
  } catch (e: any) {
    shotErrors.push(`${label}: ${e?.message || "Failed to capture"}`);
    return null;
  }
}

console.log("termsShot valid?", !!termsShot, "len:", termsShot?.length);

    if (!orderShot && isProbablyUrl(orderUrl)) orderShot = await tryShot("Order URL", orderUrl);
    if (!termsShot && isProbablyUrl(termsUrl)) termsShot = await tryShot("Terms URL", termsUrl);
console.log("shots:", {
  order: !!orderShot,
  terms: !!termsShot,
  tracking: !!trackingShot,
  errors: shotErrors,
});

    if (!trackingShot && isProbablyUrl(trackingUrl)) trackingShot = await tryShot("Tracking URL", trackingUrl);


    const nowIso = new Date().toISOString();

function buildMerchantStatement(reason: string) {
  switch (reason) {
    case "fraud":
      return `The transaction was completed successfully using the customer's payment credentials. 
The billing details matched those on file with the issuing bank, and no alerts were triggered at checkout.
The order was delivered to the address provided, and no unauthorised activity was reported prior to the chargeback.`;

    case "not_received":
      return `The order was fulfilled and dispatched as described at checkout. 
Tracking confirms delivery to the address provided by the customer.
No delivery issue was reported prior to the chargeback being filed.`;

    case "not_as_described":
      return `The product delivered matches the description presented at checkout.
The customer did not request a resolution prior to initiating the chargeback.
The refund policy agreed to at checkout outlines the appropriate dispute process.`;

    case "subscription":
      return `The customer subscribed and was billed according to the clearly displayed subscription terms.
No cancellation request was received prior to the billing date.
The subscription remained active at the time of billing.`;

    case "refund":
      return `No valid refund request was received in accordance with the published refund policy prior to the chargeback.
Refund eligibility and timelines were clearly displayed and agreed to during checkout.`;

    default:
      return `The transaction was completed and fulfilled according to the agreed terms at checkout.`;
  }
}
     const merchantStatement = buildMerchantStatement(disputeReason);

    // Simple but structured PDF (we’ll swap to your fancy template next)
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
  @page { size: A4; margin: 16mm; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; }
  h1 { margin: 0 0 4mm 0; }
  h2 { margin: 0 0 3mm 0; font-size: 12.5pt; }
  .muted { color: #555; font-size: 10pt; }
  .box { border: 1px solid #ddd; padding: 10px; margin: 8px 0; border-radius: 10px; }
  .mono { font-family: monospace; word-break: break-all; }
  pre { white-space: pre-wrap; word-break: break-word; }

  .page-break { page-break-before: always; break-before: page; }
  .avoid-break { page-break-inside: avoid; break-inside: avoid; }

  /* A “page” wrapper for a single screenshot */
  .evidence-page { height: 100%; }

  .figure {
    border: 1px solid #ddd;
    border-radius: 10px;
    overflow: hidden;
    margin-top: 6px;
  }

 .figure img {
   width: 100%;
   height: auto;
   max-height: 250mm;   /* fits on a page */
   object-fit: contain;
   display: block;
   background: #fff;
}


  .caption {
    padding: 8px 10px;
    border-top: 1px solid #ddd;
    font-size: 10pt;
    color: #333;
  }
</style>

</head>
<body>
  <h1>DisputeDeck Evidence Pack</h1>
  <div class="muted">Generated: <span class="mono">${nowIso}</span></div>

  <div class="box">
    <strong>Order URL</strong>
    <div class="mono">${escapeHtml(orderUrl || "")}</div>
  </div>

  <div class="box">
    <strong>Tracking URL</strong>
    <div class="mono">${escapeHtml(trackingUrl || "")}</div>
  </div>

  <div class="box">
    <strong>Terms URL</strong>
    <div class="mono">${escapeHtml(termsUrl || "")}</div>
  </div>

  ${shotErrors.length ? `
  <div class="box">
    <strong>Screenshot notes</strong>
    <div class="muted">Some pages may block automated capture or require login.</div>
    <ul>${shotErrors.map(e => `<li>${escapeHtml(e)}</li>`).join("")}</ul>
  </div>` : ""}

  <div class="page-break"></div>
  <h2>Customer Messages</h2>
  <div class="box">
    <pre>${escapeHtml(messages || "")}</pre>
  </div>

  <div class="page-break"></div>
  <h2>Captured Evidence Screenshots</h2>
  <div class="muted">Each screenshot is placed on its own page and scaled to fit.</div>

${orderShot ? `
  <div class="page-break"></div>
  <div class="evidence-page avoid-break">
    <h2>Order Confirmation</h2>
    <div class="muted small">Source: <span class="mono">${escapeHtml(orderUrl || "")}</span></div>
<div class="muted" style="margin-bottom:6px;">
  Full-page capture at time of evidence generation.
</div>

    <div class="figure">
      <img src="${orderShot}" alt="Order screenshot" />
      <div class="caption">Order page capture (scaled to fit page)</div>
    </div>
  </div>
` : `
  <div class="page-break"></div>
  <div class="evidence-page avoid-break">
    <h2>Order Confirmation</h2>
    <div class="muted small">Source: <span class="mono">${escapeHtml(orderUrl || "")}</span></div>
    <div class="box muted">No screenshot captured (missing upload/URL, blocked, or requires login).</div>
  </div>
`}


${termsShot ? `
  <div class="page-break"></div>
  <div class="evidence-page avoid-break">
    <h2>Terms / Refund Policy</h2>
    <div class="muted small">Source: <span class="mono">${escapeHtml(termsUrl || "")}</span></div>
<div class="muted" style="margin-bottom:6px;">
  Full-page capture at time of evidence generation.
</div>

    <div class="figure">
      <img src="${termsShot}" alt="Terms screenshot" />
      <div class="caption">Terms/policy capture (scaled to fit page)</div>
    </div>
  </div>
` : `
  <div class="page-break"></div>
  <div class="evidence-page avoid-break">
    <h2>Terms / Refund Policy</h2>
    <div class="muted small">Source: <span class="mono">${escapeHtml(termsUrl || "")}</span></div>
    <div class="box muted">No screenshot captured (missing URL, blocked, or requires login).</div>
  </div>
`}


${trackingShot ? `
  <div class="page-break"></div>
  <div class="evidence-page avoid-break">
    <h2>Tracking / Delivery</h2>
    <div class="muted small">Source: <span class="mono">${escapeHtml(trackingUrl || "")}</span></div>
<div class="muted" style="margin-bottom:6px;">
  Full-page capture at time of evidence generation.
</div>

    <div class="figure">
      <img src="${trackingShot}" alt="Tracking screenshot" />
      <div class="caption">Tracking capture (scaled to fit page)</div>
    </div>
  </div>
` : `
  <div class="page-break"></div>
  <div class="evidence-page avoid-break">
    <h2>Tracking / Delivery</h2>
    <div class="muted small">Source: <span class="mono">${escapeHtml(trackingUrl || "")}</span></div>
    <div class="box muted">No screenshot captured (missing upload/URL, blocked, or requires login).</div>
  </div>
`}

	<div class="page-break"></div>
<h2>Merchant Statement</h2>
<div class="box">
  ${escapeHtml(merchantStatement)}
</div>

</body>
</html>`;

// Use a fresh page for PDF rendering (more reliable than reusing the capture page)
const pdfPage = await context.newPage();

await pdfPage.setContent(html, { waitUntil: "load" });

// Debug: confirm termsShot exists (optional)
console.log("termsShot length:", termsShot?.length);

// Wait for images to load/resolve
await pdfPage.evaluate(async () => {
  const imgs = Array.from(document.images);
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          })
    )
  );
});

await pdfPage.waitForTimeout(200);

const pdf = await pdfPage.pdf({
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
});

await pdfPage.close();
await page.close();
await context.close();
await browser.close();

return new NextResponse(Buffer.from(pdf), {
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="disputedeck-evidence-pack.pdf"',
  },
});

  } catch (err: any) {
    return new NextResponse(err?.stack || err?.message || "Unknown error", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
