import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function base64Encode(str: string): string {
  return btoa(str);
}

async function getAccessToken(consumerKey: string, consumerSecret: string, baseUrl: string): Promise<string> {
  const auth = base64Encode(`${consumerKey}:${consumerSecret}`);

  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Auth fail: ${response.status} - ${text}`);
  }

  const data = JSON.parse(text);
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${text}`);
  }
  return data.access_token;
}

function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function getSTKPassword(shortCode: string, passKey: string, timestamp: string): string {
  const data = `${shortCode}${passKey}${timestamp}`;
  return base64Encode(data);
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "254" + cleaned.slice(1);
  }
  if (cleaned.startsWith("254") && cleaned.length === 12) {
    return cleaned;
  }
  if (cleaned.startsWith("7") && cleaned.length === 9) {
    return "254" + cleaned;
  }
  return cleaned;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const CONSUMER_KEY = "WQgxiuwiAxhKTrGhn6QIKSxjnjqa3AROBqwTKpB0guYjUbEG";
    const CONSUMER_SECRET = "GpmOG0jqS8CgWl5UY3mWtNNWHJO8UGBcuA3jy9gF8ySX2Q1YouubJt9ph2ABX7FX";
    const SHORT_CODE = "174379";
    const PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
    const MPESA_CALLBACK_URL = "https://zuyiebfkrjbwwrbdcoxd.supabase.co/functions/v1/mpesa-callback";

    const BASE_URL = "https://sandbox.safaricom.co.ke";

    const body = await req.json();
    const { phone, amount, accountReference = "JABIMA", transactionDesc = "Payment" } = body;

    if (!phone || !amount) {
      return new Response(
        JSON.stringify({ error: "phone and amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedPhone = normalizePhone(String(phone));
    const amountInt = Math.ceil(parseFloat(String(amount)));

    const accessToken = await getAccessToken(CONSUMER_KEY, CONSUMER_SECRET, BASE_URL);
    const timestamp = getTimestamp();
    const password = getSTKPassword(SHORT_CODE, PASSKEY, timestamp);

    const stkPayload = {
      BusinessShortCode: SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amountInt,
      PartyA: normalizedPhone,
      PartyB: SHORT_CODE,
      PhoneNumber: normalizedPhone,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    };

    const stkResponse = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkPayload),
    });

    console.log("STK Payload sent:", JSON.stringify(stkPayload));

    const stkText = await stkResponse.text();
    if (!stkResponse.ok) {
      return new Response(
        JSON.stringify({ error: `STK Push Failed: ${stkResponse.status}`, details: stkText }),
        { status: stkResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Store the transaction request so callback can match it
    try {
      const stkData = JSON.parse(stkText);
      const checkoutRequestID = stkData.CheckoutRequestID;
      if (checkoutRequestID) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase.from("mpesa_transactions").upsert({
          checkout_request_id: checkoutRequestID,
          merchant_request_id: stkData.MerchantRequestID,
          phone: normalizedPhone,
          amount: amountInt,
          account_reference: accountReference,
          transaction_desc: transactionDesc,
          status: "pending",
        }, { onConflict: "checkout_request_id" });
        console.log(`STK request stored: ${checkoutRequestID}`);
      }
    } catch (dbErr) {
      // Non-critical: don't fail the STK push if DB store fails
      console.error("Failed to store STK request:", dbErr);
    }

    return new Response(stkText, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("mpesa-stk error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        message: err instanceof Error ? err.message : String(err)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});