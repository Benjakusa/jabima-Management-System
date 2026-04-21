import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Environment variables - set these in Supabase Dashboard
const IS_PRODUCTION = Deno.env.get("MPESA_ENV") === "production";
const CONSUMER_KEY = Deno.env.get("MPESA_CONSUMER_KEY") || "WQgxiuwiAxhKTrGhn6QIKSxjnjqa3AROBqwTKpB0guYjUbEG";
const CONSUMER_SECRET = Deno.env.get("MPESA_CONSUMER_SECRET") || "GpmOG0jqS8CgWl5UY3mWtNNWHJO8UGBcuA3jy9gF8ySX2Q1YouubJt9ph2ABX7FX";
const SHORT_CODE = Deno.env.get("MPESA_SHORT_CODE") || "174379";
const PASSKEY = Deno.env.get("MPESA_PASSKEY") || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72e1f246cc843";

// API URLs - Production vs Sandbox
const BASE_URL = IS_PRODUCTION 
  ? "https://api.safaricom.co.ke" 
  : "https://sandbox.safaricom.co.ke";

function base64Encode(str: string): string {
  return btoa(str);
}

async function getAccessToken(): Promise<string> {
  const auth = base64Encode(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);
  
  const response = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });
  
  const data = await response.json();
  console.log("Access Token Response:", JSON.stringify(data));
  
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
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

function getSTKPassword(timestamp: string): string {
  const data = `${SHORT_CODE}${PASSKEY}${timestamp}`;
  return base64Encode(data);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, amount, accountReference, transactionDesc } = await req.json();

    if (!phone || !amount) {
      return new Response(
        JSON.stringify({ error: "Phone and amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number (remove +254 or 0 prefix)
    let formattedPhone = phone.replace(/^\+254/, "").replace(/^0/, "");
    if (!formattedPhone.startsWith("254")) {
      formattedPhone = "254" + formattedPhone;
    }

    const accessToken = await getAccessToken();
    const timestamp = getTimestamp();
    const password = getSTKPassword(timestamp);

    const stkPushRequest = {
      BusinessShortCode: SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerBuyGoodsOnline",
      Amount: Math.ceil(parseFloat(amount)),
      PartyA: formattedPhone,
      PartyB: SHORT_CODE,
      PhoneNumber: formattedPhone,
      CallBackURL: Deno.env.get("MPESA_CALLBACK_URL") || "https://zuyiebfkrjbwwrbdcoxd.supabase.co/functions/v1/mpesa-callback",
      AccountReference: accountReference || "JABIMA",
      TransactionDesc: transactionDesc || "Payment for coffin/service",
    };

    const response = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkPushRequest),
    });

    const data = await response.json();

    console.log("STK Push Response:", JSON.stringify(data));

    if (data.ResponseCode === "0") {
      return new Response(
        JSON.stringify({
          success: true,
          message: "STK Push sent successfully",
          checkoutRequestID: data.CheckoutRequestID,
          customerMessage: data.CustomerMessage,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: data.errorMessage || "STK Push failed", details: data }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("M-Pesa Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error", stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
