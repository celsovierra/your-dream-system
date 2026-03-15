import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { access_token, amount, description, payer_name, payer_cpf, payer_email, sandbox } = await req.json();

    if (!access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'API Key do Asaas não informada. Configure em Configurações.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valor inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payer_cpf) {
      return new Response(
        JSON.stringify({ success: false, error: 'CPF do pagador é obrigatório para o Asaas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';

    // Step 1: Create or find customer
    const customerRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'access_token': access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: payer_name || 'Cliente',
        cpfCnpj: payer_cpf,
        email: payer_email || undefined,
      }),
    });

    const customerData = await customerRes.json();

    if (!customerRes.ok && customerData.errors?.[0]?.code !== 'invalid_cpfCnpj') {
      // If customer already exists, try to find by CPF
      if (customerData.errors?.[0]?.code === 'duplicated') {
        // Search existing customer
        const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${payer_cpf}`, {
          headers: { 'access_token': access_token },
        });
        const searchData = await searchRes.json();
        if (searchData.data?.length > 0) {
          customerData.id = searchData.data[0].id;
        } else {
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao buscar cliente no Asaas' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.error('Asaas customer error:', JSON.stringify(customerData));
        return new Response(
          JSON.stringify({ success: false, error: customerData.errors?.[0]?.description || 'Erro ao criar cliente no Asaas' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const customerId = customerData.id;

    // Step 2: Create PIX payment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'access_token': access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: amount,
        dueDate: dueDate.toISOString().split('T')[0],
        description: description || 'Cobrança',
      }),
    });

    const paymentData = await paymentRes.json();

    if (!paymentRes.ok) {
      console.error('Asaas payment error:', JSON.stringify(paymentData));
      return new Response(
        JSON.stringify({ success: false, error: paymentData.errors?.[0]?.description || 'Erro ao criar cobrança no Asaas' }),
        { status: paymentRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Get PIX QR Code
    const pixRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, {
      headers: { 'access_token': access_token },
    });

    const pixData = await pixRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          payment_id: paymentData.id,
          status: paymentData.status,
          qr_code: pixData.payload || null,
          qr_code_base64: pixData.encodedImage || null,
          ticket_url: paymentData.invoiceUrl || null,
          amount: paymentData.value,
          description: paymentData.description,
          created_at: paymentData.dateCreated,
          expiration: paymentData.dueDate,
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
