import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MCQItem {
  stem: string;
  options: { label: string; text: string }[];
  answerKey: string;
  solution: string;
  sources: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { studySetId } = await req.json();
    
    console.log('Generate MCQs request for study set:', studySetId);

    // Fetch study set
    const { data: studySet, error: fetchError } = await supabase
      .from('study_sets')
      .select('*')
      .eq('id', studySetId)
      .single();

    if (fetchError || !studySet) {
      throw new Error('Study set not found');
    }

    const config = studySet.config as { mcqCount: number; difficulty: string; topics?: string[] };
    const text = studySet.text;

    // Step 1: Chunk the text (simplified - ~1000 words per chunk with overlap)
    const words = text.split(/\s+/);
    const chunkSize = 1000;
    const overlap = 200;
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      chunks.push(chunk);
    }

    console.log('Created chunks:', chunks.length);

    // Step 2: For each MCQ, call LLM with relevant chunks
    const mcqs: MCQItem[] = [];
    const questionsPerCall = Math.min(3, config.mcqCount); // Generate 3 at a time
    
    for (let i = 0; i < config.mcqCount; i += questionsPerCall) {
      const batchSize = Math.min(questionsPerCall, config.mcqCount - i);
      
      // Use first few chunks for context (simplified RAG)
      const context = chunks.slice(0, 3).join('\n\n');
      
      const systemPrompt = `You are an assessment designer. Generate precise, single-correct multiple-choice questions grounded strictly in the provided source text. Use British English. Never hallucinate. Each MCQ must have exactly 4 options (A, B, C, D) with exactly one correct answer.`;
      
      const userPrompt = `Generate ${batchSize} multiple-choice questions based on this text.

Difficulty: ${config.difficulty}
${config.topics && config.topics.length > 0 ? `Topics: ${config.topics.join(', ')}` : ''}

Source text:
${context}

For each question, return JSON with this exact structure:
{
  "stem": "Question text (max 35 words)",
  "options": [
    {"label": "A", "text": "Option A text"},
    {"label": "B", "text": "Option B text"},
    {"label": "C", "text": "Option C text"},
    {"label": "D", "text": "Option D text"}
  ],
  "answerKey": "A|B|C|D",
  "solution": "2-4 sentence explanation referencing the source",
  "sources": ["chunk reference"]
}

Return only a JSON array of questions. No additional text.`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error:', response.status, errorText);
        throw new Error(`AI generation failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      console.log('AI response:', content);

      // Parse JSON response
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsedMCQs = JSON.parse(jsonMatch[0]);
          mcqs.push(...parsedMCQs);
        } else {
          console.warn('Could not extract JSON array from response');
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
      }
    }

    console.log('Generated MCQs:', mcqs.length);

    // Step 3: Validate and store MCQs
    const validMCQs = mcqs.filter(mcq => {
      return mcq.stem && 
             mcq.options?.length === 4 && 
             mcq.answerKey &&
             ['A', 'B', 'C', 'D'].includes(mcq.answerKey) &&
             mcq.solution;
    });

    console.log('Valid MCQs:', validMCQs.length);

    // Insert into database
    const itemsToInsert = validMCQs.map(mcq => ({
      study_set_id: studySetId,
      type: 'mcq',
      stem: mcq.stem,
      options: mcq.options,
      answer_key: mcq.answerKey,
      solution: mcq.solution,
      difficulty: config.difficulty,
      sources: mcq.sources || [],
    }));

    const { error: insertError } = await supabase
      .from('items')
      .insert(itemsToInsert);

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log('MCQs saved successfully');

    return new Response(
      JSON.stringify({ 
        status: 'completed',
        counts: { mcq: validMCQs.length }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Generate MCQs error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
