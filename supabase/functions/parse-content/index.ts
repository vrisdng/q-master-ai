import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { sourceType, text, url } = await req.json();
    
    console.log('Parse request received:', { sourceType, hasText: !!text, url });

    let extractedText = '';
    let topics: string[] = [];

    if (sourceType === 'text') {
      extractedText = text.trim();
    } else if (sourceType === 'url') {
      // Fetch and extract text from URL
      try {
        const response = await fetch(url);
        const html = await response.text();
        
        // Simple HTML text extraction (in production, use proper parser)
        extractedText = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      } catch (error) {
        console.error('URL fetch error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch URL content' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (sourceType === 'pdf') {
      // For PDF, text should be extracted client-side or via specialized service
      extractedText = text;
    }

    // Normalize whitespace
    extractedText = extractedText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length >= 3)
      .join('\n');

    // Simple topic extraction using word frequency
    const words = extractedText
      .toLowerCase()
      .match(/\b[a-z]{4,}\b/g) || [];
    
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    // Get top 6-10 most frequent words as topics
    topics = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);

    const approxTokens = Math.ceil(extractedText.split(/\s+/).length * 1.3);

    console.log('Parse completed:', { 
      textLength: extractedText.length, 
      topicsCount: topics.length,
      approxTokens 
    });

    return new Response(
      JSON.stringify({ 
        text: extractedText, 
        topics: topics.join(', '),
        approxTokens 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Parse error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
