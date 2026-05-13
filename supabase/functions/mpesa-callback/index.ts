import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface StkCallback {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: number;
  ResultDesc?: string;
  CallbackMetadata?: {
    Item?: Array<{
      Name: string;
      Value?: string | number;
    }>;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("M-Pesa Callback:", JSON.stringify(body, null, 2));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const stkCallback: StkCallback | undefined = body.Body?.stkCallback;

    if (!stkCallback) {
      console.log("No stkCallback in body, ignoring");
      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const checkoutRequestID = stkCallback.CheckoutRequestID;
    const merchantRequestID = stkCallback.MerchantRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    let mpesaReceiptNumber = "";
    let phone = "";
    let amount = 0;
    let transactionDate = "";

    if (resultCode === 0 && stkCallback.CallbackMetadata?.Item) {
      for (const item of stkCallback.CallbackMetadata.Item) {
        const value = item.Value?.toString() || "";
        switch (item.Name) {
          case "MpesaReceiptNumber":
            mpesaReceiptNumber = value;
            break;
          case "PhoneNumber":
            phone = value;
            break;
          case "Amount":
            amount = parseInt(value) || 0;
            break;
          case "TransactionDate":
            transactionDate = value;
            break;
        }
      }
    }

    const status = resultCode === 0 ? "completed" : "failed";

    const { data: existing } = await supabase
      .from("mpesa_transactions")
      .select("id, sale_id, status")
      .eq("checkout_request_id", checkoutRequestID)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("mpesa_transactions")
        .update({
          merchant_request_id: merchantRequestID,
          result_code: resultCode,
          result_desc: resultDesc,
          mpesa_receipt_number: mpesaReceiptNumber,
          phone: phone || existing.phone,
          amount: amount || existing.amount,
          transaction_date: transactionDate,
          status,
          raw_callback: body,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      const { data: newTxn } = await supabase
        .from("mpesa_transactions")
        .insert({
          checkout_request_id: checkoutRequestID,
          merchant_request_id: merchantRequestID,
          phone,
          amount: amount || null,
          result_code: resultCode,
          result_desc: resultDesc,
          mpesa_receipt_number: mpesaReceiptNumber,
          transaction_date: transactionDate,
          status,
          raw_callback: body,
        })
        .select("id")
        .single();

      if (resultCode === 0 && newTxn) {
        console.log(`M-Pesa transaction completed: ${mpesaReceiptNumber}, amount: ${amount}`);
      }
    }

    if (resultCode === 0 && existing?.sale_id) {
      const saleAmount = amount || 0;
      if (saleAmount > 0) {
        const { data: payments } = await supabase
          .from("payment_transactions")
          .select("id, amount")
          .eq("sale_id", existing.sale_id)
          .eq("reference_number", mpesaReceiptNumber)
          .maybeSingle();

        if (!payments) {
          await supabase.from("payment_transactions").insert({
            sale_id: existing.sale_id,
            amount: saleAmount,
            payment_method: "mpesa",
            reference_number: mpesaReceiptNumber,
            notes: `Auto-recorded from M-Pesa callback (${checkoutRequestID})`,
          });

          const { data: allPayments } = await supabase
            .from("payment_transactions")
            .select("amount")
            .eq("sale_id", existing.sale_id);

          const totalPaid = (allPayments || []).reduce((s: number, p: any) => s + p.amount, 0);

          const { data: sale } = await supabase
            .from("sales")
            .select("selling_price")
            .eq("id", existing.sale_id)
            .single();

          if (sale) {
            const newStatus = totalPaid >= sale.selling_price ? "paid" : "partial";
            await supabase
              .from("sales")
              .update({ amount_paid: totalPaid, payment_status: newStatus })
              .eq("id", existing.sale_id);
          }
        }
      }
    }

    console.log(`M-Pesa callback processed: ${checkoutRequestID}, result=${resultCode}, status=${status}`);

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("M-Pesa Callback Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
