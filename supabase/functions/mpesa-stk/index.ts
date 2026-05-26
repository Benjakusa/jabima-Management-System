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

  console.log(`Getting access token from ${baseUrl}/oauth/v1/generate`);
  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${auth}`,
    },
  });

  const text = await response.text();
  console.log(`Auth response status: ${response.status}, body: ${text}`);
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
    const CONSUMER_KEY = Deno.env.get("MPESA_CONSUMER_KEY") || "fbR3RgKFX3GhVBOmyU3YAqR6vEgH4xCjt1gHSCD5YGo0SEIU";
    const CONSUMER_SECRET = Deno.env.get("MPESA_CONSUMER_SECRET") || "PIbYE2ZQAM2XfQeRsSxxbccIgYKDB6HzdlgkMCczYTLAZo1LW47KkFFdAucWMUxb";
    const SHORT_CODE = Deno.env.get("MPESA_SHORT_CODE") || "5715072";
    // For CustomerBuyGoodsOnline: BusinessShortCode = Store Number, PartyB = Till Number
    const STORE_NUMBER = Deno.env.get("MPESA_STORE_NUMBER") || "5715074";
    const TILL_NUMBER = Deno.env.get("MPESA_TILL_NUMBER") || "3243763";
    const PASSKEY = Deno.env.get("MPESA_PASSKEY") || "140319868dea856bcf4c822389fa08141f4882d313718bc795cadebd69d15ba1";
    const MPESA_CALLBACK_URL = Deno.env.get("MPESA_CALLBACK_URL") || "https://zuyiebfkrjbwwrbdcoxd.supabase.co/functions/v1/payment-callback";
    const BASE_URL = Deno.env.get("MPESA_BASE_URL") || "https://api.safaricom.co.ke";

    if (!CONSUMER_KEY || !CONSUMER_SECRET || !SHORT_CODE || !PASSKEY) {
      return new Response(
        JSON.stringify({ error: "M-Pesa credentials not configured. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORT_CODE, and MPESA_PASSKEY in Supabase Edge Function secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const {
      phone,
      amount,
      accountReference = "JABIMA",
      transactionDesc = "Payment",
      transactionType = "CustomerPayBillOnline",
      businessShortCode: businessShortCodeOverride,
      partyB: partyBOverride
    } = body;

    if (!phone || !amount) {
      return new Response(
        JSON.stringify({ error: "phone and amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedPhone = normalizePhone(String(phone));
    const amountInt = Math.ceil(parseFloat(String(amount)));

    console.log(`Processing STK Push for ${normalizedPhone}, amount: ${amountInt}, type: ${transactionType}`);

    const accessToken = await getAccessToken(CONSUMER_KEY, CONSUMER_SECRET, BASE_URL);
    const timestamp = getTimestamp();

    // For Buy Goods (CustomerBuyGoodsOnline):
    //   BusinessShortCode = SHORT_CODE (the Lipa Na M-Pesa shortcode the passkey is tied to)
    //   PartyB = Till Number (the specific till where money is collected)
    //   Password = base64(SHORT_CODE + Passkey + Timestamp)
    // For Paybill (CustomerPayBillOnline):
    //   BusinessShortCode = SHORT_CODE, PartyB = SHORT_CODE
    const isBuyGoods = transactionType === 'CustomerBuyGoodsOnline';
    const effectiveBusinessShortCode = businessShortCodeOverride || SHORT_CODE;
    const effectivePartyB = partyBOverride || (isBuyGoods ? TILL_NUMBER : SHORT_CODE);

    const password = getSTKPassword(effectiveBusinessShortCode, PASSKEY, timestamp);

    const stkPayload = {
      BusinessShortCode: effectiveBusinessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: transactionType,
      Amount: amountInt,
      PartyA: normalizedPhone,
      PartyB: effectivePartyB,
      PhoneNumber: normalizedPhone,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    };

    console.log(`STK Config — BusinessShortCode: ${effectiveBusinessShortCode}, PartyB: ${effectivePartyB}, Type: ${transactionType}`);

    console.log("STK Payload sent to Safaricom:", JSON.stringify(stkPayload));

    const stkResponse = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkPayload),
    });

    const stkText = await stkResponse.text();
    console.log("Safaricom raw response:", stkText);

    if (!stkResponse.ok) {
      console.error(`Safaricom Error: ${stkResponse.status}`, stkText);
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
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("mpesa-stk error:", errMsg);
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        message: errMsg,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});