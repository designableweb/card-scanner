
// Serverless function: reads a business card image and returns structured fields.
// Runs on Vercel. The Anthropic API key is read from the environment, never sent to the browser.
 
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
 
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server not configured: missing ANTHROPIC_API_KEY' });
    return;
  }
 
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const imageBase64 = body.image;
    const mediaType = body.mediaType || 'image/jpeg';
 
    if (!imageBase64) {
      res.status(400).json({ error: 'No image provided' });
      return;
    }
 
    const prompt = [
      'You are reading a business card. Extract the contact details and respond with ONLY a JSON object,',
      'no other text, using exactly these keys:',
      '{"firstName":"","lastName":"","fullName":"","title":"","company":"","phone":"","email":"","website":"","industry":""}',
      'Rules:',
      '- Use an empty string "" for anything not present on the card.',
      '- "industry" is your best one or two word guess of the industry based on title and company',
      '  (for example "Real Estate", "Law", "Insurance", "Marketing", "Construction"). Always guess.',
      '- "phone": keep digits, spaces, parentheses, dashes and a leading + only.'
    ].join('\n');
 
    // Model ID. Swap this string to use a newer model.  ANCHOR: MODEL_ID
    const MODEL = 'claude-haiku-4-5-20251001';
 
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });
 
    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      res.status(502).json({ error: 'OCR service error', detail: errText });
      return;
    }
 
    const data = await anthropicRes.json();
    let text = (data.content && data.content[0] && data.content[0].text) || '';
    text = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
 
    let fields;
    try {
      fields = JSON.parse(text);
    } catch (e) {
      res.status(502).json({ error: 'Could not parse card', raw: text });
      return;
    }
 
    res.status(200).json(fields);
  } catch (err) {
    res.status(500).json({ error: 'Unexpected error', detail: String(err) });
  }
};
 


