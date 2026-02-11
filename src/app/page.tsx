"use client";
import { useState } from "react";
import { useRef } from "react";

export default function Home() {
  const [orderUrl, setOrderUrl] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [termsUrl, setTermsUrl] = useState("");
  const [messages, setMessages] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("fraud");
  const [orderUpload, setOrderUpload] = useState<string | null>(null);
  const [termsUpload, setTermsUpload] = useState<string | null>(null);
  const [trackingUpload, setTrackingUpload] = useState<string | null>(null);
  const orderInputRef = useRef<HTMLInputElement | null>(null);
  const termsInputRef = useRef<HTMLInputElement | null>(null);
  const trackingInputRef = useRef<HTMLInputElement | null>(null);


function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

 async function generate() {
  setBusy(true);
  setError(null);

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderUrl,
        trackingUrl,
        termsUrl,
        messages,
        disputeReason,
        uploads: {
          order: orderUpload,  
          terms: termsUpload,
          tracking: trackingUpload,
        },
      }),

    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed to generate PDF");
    }

    const blob = await res.blob();

    // Force a download instead of opening in a new tab
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disputedeck-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e: any) {
    setError(e?.message ?? "Something went wrong");
  } finally {
    setBusy(false);
  }
}


  return (
    <main className="min-h-screen bg-gray-50 max-w-2xl mx-auto p-6 space-y-5">
<header className="space-y-2">
  <h1 className="text-3xl font-bold text-gray-900">DisputeDeck</h1>
  <p className="text-gray-600">
    Generate structured, chargeback-ready evidence in minutes.
  </p>
</header>
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
  <h2 className="font-semibold text-blue-900 mb-2">
    Structured Evidence For Stripe & PayPal Disputes
  </h2>
  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
    <li>Automatically organises evidence by dispute type</li>
    <li>Combines screenshots + policy + communication into one PDF</li>
    <li>Formats content clearly for reviewer scanning</li>
  </ul>
</div>
<p className="text-gray-600 text-sm">
  1. Paste your order details  
  2. Upload screenshots (or auto-capture)  
  3. Download a dispute-ready evidence pack
</p>

      <div className="space-y-4">
        <label className="block">
          <div className="font-semibold">Order confirmation URL</div>
          <input
            className="w-full border p-2 rounded"
            value={orderUrl}
            onChange={(e) => setOrderUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>

        <label className="block">
          <div className="font-semibold">Tracking URL (optional)</div>
          <input
            className="w-full border p-2 rounded"
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>

        <label className="block">
          <div className="font-semibold">Refund / Terms URL</div>
          <input
            className="w-full border p-2 rounded"
            value={termsUrl}
            onChange={(e) => setTermsUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>

        <label className="block">
          <div className="font-semibold">Customer messages (paste)</div>
          <textarea
            className="w-full border p-2 rounded h-40"
            value={messages}
            onChange={(e) => setMessages(e.target.value)}
            placeholder="Paste the relevant emails/chat…"
          />
        </label>

        {error && (
          <div className="border border-red-300 bg-red-50 text-red-800 p-3 rounded">
            {error}
          </div>
        )}
        <label className="block">
        <div className="font-semibold">Dispute Reason</div>
        <select
          className="w-full border border-gray-300 p-2 rounded bg-white text-black focus:outline-none focus:ring-2 focus:ring-black"
          value={disputeReason}
          onChange={(e) => setDisputeReason(e.target.value)}
        >
          <option value="fraud">Fraud / No Authorisation</option>
          <option value="not_received">Product Not Received</option>
          <option value="not_as_described">Not as Described</option>
          <option value="subscription">Subscription / Cancelled</option>
          <option value="refund">Refund Not Issued</option>
        </select>
        </label>
<button
  type="button"
  onClick={() => {
    setOrderUpload(null);
    setTermsUpload(null);
    setTrackingUpload(null);
    if (orderInputRef.current) orderInputRef.current.value = "";
    if (termsInputRef.current) termsInputRef.current.value = "";
    if (trackingInputRef.current) trackingInputRef.current.value = "";
  }}
  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-4 py-2 rounded-lg mb-4 transition"
>
  Clear attachments
</button>

<label className="block">
  <div className="font-semibold">Upload Order Screenshot (optional)</div>
  <input
    ref={orderInputRef}
    type="file"
    accept="image/*"
    className="block w-full text-sm text-gray-700
  file:mr-4 file:py-2 file:px-4
  file:rounded-lg file:border-0
  file:text-sm file:font-semibold
  file:bg-blue-600 file:text-white
  hover:file:bg-blue-700
  file:cursor-pointer
  cursor-pointer"

   onChange={async (e) => {
     const file = e.target.files?.[0];
     if (!file) {
       setOrderUpload(null);
       return;
     }
     const dataUrl = await fileToDataUrl(file);
     setOrderUpload(dataUrl);
   }}

  />
  {orderUpload && <div className="text-sm text-gray-600">Order screenshot attached ✅</div>}
</label>

<label className="block">
  <div className="font-semibold">Upload Terms/Policy Screenshot (optional)</div>
  <input
    ref={termsInputRef}
    type="file"
    accept="image/*"
    className="block w-full text-sm text-gray-700
  file:mr-4 file:py-2 file:px-4
  file:rounded-lg file:border-0
  file:text-sm file:font-semibold
  file:bg-blue-600 file:text-white
  hover:file:bg-blue-700
  file:cursor-pointer
  cursor-pointer"

    onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) {
        setTermsUpload(null);
        return;
      }
      const dataUrl = await fileToDataUrl(file);
      setTermsUpload(dataUrl);
    }}
  />
  {termsUpload && <div className="text-sm text-gray-600">Terms screenshot attached ✅</div>}
</label>

<label className="block">
  <div className="font-semibold">Upload Tracking Screenshot (optional)</div>
  <input
    ref={trackingInputRef}
    type="file"
    accept="image/*"
    className="block w-full text-sm text-gray-700
  file:mr-4 file:py-2 file:px-4
  file:rounded-lg file:border-0
  file:text-sm file:font-semibold
  file:bg-blue-600 file:text-white
  hover:file:bg-blue-700
  file:cursor-pointer
  cursor-pointer"

    onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) {
        setTrackingUpload(null);
        return;
      }
      const dataUrl = await fileToDataUrl(file);
      setTrackingUpload(dataUrl);
    }}
  />
  {trackingUpload && <div className="text-sm text-gray-600">Tracking screenshot attached ✅</div>}
</label>


        <button
          onClick={generate}
          disabled={busy}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-3 rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50"

        >
          {busy ? "Generating..." : "Generate Evidence Pack"}
        </button>
        <p className="text-xs text-gray-500 mt-3">
        Files are processed in-memory and not stored. Built for independent merchants.
        </p>

      </div>
    </main>
  );
}
