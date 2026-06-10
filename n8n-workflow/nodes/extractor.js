const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

async function extractFromPDF(pdfBase64, filename) {
  // Initialize Claude client
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  // Read the extraction prompt from config
  const promptPath = path.join(__dirname, '../../config/extraction_prompt.txt');
  const extractionPrompt = fs.readFileSync(promptPath, 'utf-8');

  try {
    // Send PDF directly to Claude API as a document
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64
              }
            },
            {
              type: 'text',
              text: extractionPrompt
            }
          ]
        }
      ]
    });

    // Get the text response
    const rawText = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Clean and parse JSON
    const cleanJson = rawText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const extractedFacts = JSON.parse(cleanJson);

    return {
      success: true,
      filename: filename,
      extracted_facts: extractedFacts
    };

  } catch (error) {
    return {
      success: false,
      filename: filename,
      error: error.message,
      extracted_facts: null
    };
  }
}

// n8n Code node entry point
// In n8n, input data comes from $input.all()
const items = $input.all();
const results = [];

for (const item of items) {
  const pdfBase64 = item.json.pdf_base64;
  const filename = item.json.filename || 'unknown.pdf';

  if (!pdfBase64) {
    results.push({
      json: {
        success: false,
        filename: filename,
        error: 'No PDF data received',
        extracted_facts: null
      }
    });
    continue;
  }

  const result = await extractFromPDF(pdfBase64, filename);
  results.push({ json: result });
}

return results;