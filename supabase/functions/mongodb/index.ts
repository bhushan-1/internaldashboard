import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check for Data API configuration (preferred method)
  const DATA_API_KEY = Deno.env.get('MONGODB_DATA_API_KEY');
  const DATA_API_URL = Deno.env.get('MONGODB_DATA_API_URL');

  if (!DATA_API_KEY || !DATA_API_URL) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'MongoDB Data API not configured. Please add MONGODB_DATA_API_KEY and MONGODB_DATA_API_URL secrets.',
        instructions: [
          '1. Go to MongoDB Atlas → Data API (left sidebar)',
          '2. Enable the Data API for your cluster',
          '3. Create an API Key and copy it',
          '4. Copy the Data API endpoint URL (e.g., https://data.mongodb-api.com/app/data-xxxxx/endpoint/data/v1)',
          '5. Add MONGODB_DATA_API_KEY and MONGODB_DATA_API_URL as secrets in Lovable'
        ]
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate URL format
  if (!DATA_API_URL.startsWith('https://')) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Invalid MONGODB_DATA_API_URL format. Got: "${DATA_API_URL}". Expected format: https://data.mongodb-api.com/app/data-xxxxx/endpoint/data/v1`,
        instructions: [
          '1. Go to MongoDB Atlas → Data API (left sidebar)',
          '2. Find "Data API Endpoint" section',
          '3. Copy the full URL (starts with https://)',
          '4. Update the MONGODB_DATA_API_URL secret in Lovable'
        ]
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { action, database, collection, filter, data, limit = 100 } = await req.json();

    const dbName = database || 'test';

    // Build the request based on action
    let endpoint: string;
    let body: Record<string, unknown>;

    switch (action) {
      case 'find':
        endpoint = `${DATA_API_URL}/action/find`;
        body = {
          dataSource: 'Cluster0', // Default cluster name, can be made configurable
          database: dbName,
          collection: collection,
          filter: filter || {},
          limit: limit
        };
        break;

      case 'findOne':
        endpoint = `${DATA_API_URL}/action/findOne`;
        body = {
          dataSource: 'Cluster0',
          database: dbName,
          collection: collection,
          filter: filter || {}
        };
        break;

      case 'insertOne':
        if (!data) {
          return new Response(
            JSON.stringify({ success: false, error: 'Data is required for insert' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        endpoint = `${DATA_API_URL}/action/insertOne`;
        body = {
          dataSource: 'Cluster0',
          database: dbName,
          collection: collection,
          document: data
        };
        break;

      case 'updateOne':
        if (!filter || !data) {
          return new Response(
            JSON.stringify({ success: false, error: 'Filter and data are required for update' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        endpoint = `${DATA_API_URL}/action/updateOne`;
        body = {
          dataSource: 'Cluster0',
          database: dbName,
          collection: collection,
          filter: filter,
          update: { $set: data }
        };
        break;

      case 'deleteOne':
        if (!filter) {
          return new Response(
            JSON.stringify({ success: false, error: 'Filter is required for delete' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        endpoint = `${DATA_API_URL}/action/deleteOne`;
        body = {
          dataSource: 'Cluster0',
          database: dbName,
          collection: collection,
          filter: filter
        };
        break;

      case 'count':
        // Data API doesn't have a direct count, use aggregate
        endpoint = `${DATA_API_URL}/action/aggregate`;
        body = {
          dataSource: 'Cluster0',
          database: dbName,
          collection: collection,
          pipeline: [
            { $match: filter || {} },
            { $count: 'count' }
          ]
        };
        break;

      case 'listCollections':
        // Data API doesn't support listCollections directly
        // Return an error with instructions
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'listCollections is not supported by the Data API. Please enter your collection name manually.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`MongoDB Data API request to ${endpoint}:`, JSON.stringify(body));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': DATA_API_KEY,
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    console.log('MongoDB Data API response:', JSON.stringify(result));

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: result.error || result.message || 'API request failed' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format result based on action
    let formattedResult;
    if (action === 'find') {
      formattedResult = result.documents || [];
    } else if (action === 'findOne') {
      formattedResult = result.document;
    } else if (action === 'count') {
      formattedResult = result.documents?.[0]?.count || 0;
    } else {
      formattedResult = result;
    }

    return new Response(
      JSON.stringify({ success: true, data: formattedResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('MongoDB error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
