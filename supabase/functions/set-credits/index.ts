import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SetCreditsRequest {
  product: 'scaleserp' | 'rainforest' | 'valueserp' | 'asindata';
  customerApiKey: string;
  operation: 'reset_to_zero' | 'increase_by' | 'decrease_by' | 'set' | 'set_topup' | 'topup_by';
  creditAdjustment?: number;
  authKey?: string; // Optional override auth key from request
}

const productDomains: Record<string, string> = {
  scaleserp: 'api.scaleserp.com',
  rainforest: 'api.rainforestapi.com',
  valueserp: 'api.valueserp.com',
  asindata: 'api.asindataapi.com',
  serpwow: 'api.serpwow.com',
  bluecartapi: 'api.bluecartapi.com',
  redcircleapi: 'api.redcircleapi.com',
  bigboxapi: 'api.bigboxapi.com',
  backyardapi: 'api.backyardapi.com',
  countdownapi: 'api.countdownapi.com',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SetCreditsRequest = await req.json();
    const { product, customerApiKey, operation, creditAdjustment, authKey: requestAuthKey } = body;

    // Use provided authKey or fallback to environment variable
    const authKey = requestAuthKey || Deno.env.get('CREDITS_AUTH_KEY');
    if (!authKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AUTH_KEY not configured and not provided in request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!product || !customerApiKey || !operation) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: product, customerApiKey, operation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate product
    const domain = productDomains[product];
    if (!domain) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid product: ${product}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate operations that require credit_adjustment
    const operationsRequiringAmount = ['increase_by', 'decrease_by', 'set', 'set_topup', 'topup_by'];
    if (operationsRequiringAmount.includes(operation) && (creditAdjustment === undefined || creditAdjustment === null)) {
      return new Response(
        JSON.stringify({ success: false, error: `Operation "${operation}" requires creditAdjustment` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate top-up operations are only for ValueSerp and ASIN DATA
    const topUpOperations = ['set_topup', 'topup_by'];
    const topUpProducts = ['valueserp', 'asindata'];
    if (topUpOperations.includes(operation) && !topUpProducts.includes(product)) {
      return new Response(
        JSON.stringify({ success: false, error: `Top-up operations are only available for ValueSerp and ASIN DATA` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the API URL
    let url = `https://${domain}/setcredits?auth_key=${authKey}&api_key=${customerApiKey}&operation=${operation}`;
    
    if (operationsRequiringAmount.includes(operation) && creditAdjustment !== undefined) {
      url += `&credit_adjustment=${creditAdjustment}`;
    }

    console.log(`Making request to: ${domain} with operation: ${operation}`);

    // Make the API request
    const response = await fetch(url);
    const responseText = await response.text();
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `API Error: ${response.status}`, details: responseData }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in set-credits function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
