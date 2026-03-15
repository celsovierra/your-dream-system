import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { access_token, amount, description, payer_email, payer_name, payer_cpf } = await req.json();

    if (!access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access Token do Mercado Pago não informado. Configure em Configurações.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valor inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create PIX payment via Mercado Pago API
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: description || 'Cobrança',
        payment_method_id: 'pix',
        payer: {
          email: payer_email || 'cliente@email.com',
          first_name: payer_name || 'Cliente',
          identification: payer_cpf ? { type: 'CPF', number: payer_cpf } : undefined,
        },
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Mercado Pago error:', JSON.stringify(mpData));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: mpData.message || `Erro Mercado Pago: ${mpResponse.status}`,
          details: mpData.cause || mpData
        }),
        { status: mpResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract PIX data
    const pixData = mpData.point_of_interaction?.transaction_data;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          payment_id: mpData.id,
          status: mpData.status,
          qr_code: pixData?.qr_code || null,
          qr_code_base64: pixData?.qr_code_base64 || null,
          ticket_url: pixData?.ticket_url || null,
          amount: mpData.transaction_amount,
          description: mpData.description,
          created_at: mpData.date_created,
          expiration: mpData.date_of_expiration,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno ao processar pagamento' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
