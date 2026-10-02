
// Serverless function: reads a business card image (or front + back) and returns structured fields.
// Runs on Vercel. The Anthropic API key is read from the environment, never sent to the browser.
// Images are read to extract text, then discarded. Nothing is stored.

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

    // Accept either a new-style `images` array (one or two cards: front, back)
    // or the legacy single `image` + `mediaType` fields for backward compatibility.
    let images = [];
    if (Array.isArray(body.images)) {
      images = body.images
        .filter(function (im) { return im && im.data; })
        .map(function (im) { return { data: im.data, mediaType: im.mediaType || 'image/jpeg' }; });
    } else if (body.image) {
      images = [{ data: body.image, mediaType: body.mediaType || 'image/jpeg' }];
    }

    if (!images.length) {
      res.status(400).json({ error: 'No image provided' });
      return;
    }

    const prompt = [
      'You are reading a business card. You may be given one image (front) or two images (front and back) of the SAME card.',
      'Read all images together and extract one combined set of contact details.',
      'Respond with ONLY a JSON object, no other text, using exactly these keys:',
      '{"firstName":"","lastName":"","fullName":"","title":"","company":"","phone":"","email":"","website":"","mainCategory":"","subCategory":"","tagline":"","services":"","city":"","state":"","county":"","rawText":""}',
      'Rules:',
      '- Use an empty string "" for anything not found.',
      '- "mainCategory" MUST be chosen from this fixed list (pick the single best fit):',
      '    Marketing & Advertising, Real Estate, Legal, Financial & Insurance, Health & Wellness,',
      '    Home Services, Construction & Trades, Technology & IT, Professional Services, Food & Hospitality,',
      '    Retail, Automotive, Education, Nonprofit & Community, Personal Services,',
      '    Manufacturing & Distribution, Other',
      '- "subCategory": a short, specific label under the main category',
      '    (e.g. main "Marketing & Advertising", sub "Promotional Products"). Always provide a best guess.',
      '- "tagline": any slogan or phrase on the card, else "".',
      '- "services": a concise comma-separated list of services/offerings found on the card, else "".',
      '- "city", "state": from any address on the card, else "".',
      '- "county": infer from city + state (these are mostly Northern New Jersey). Best guess, else "".',
      '- "rawText": all text visible across the image(s), as a single string. Used for keyword search.',
      '- "phone": keep digits, spaces, parentheses, dashes and a leading + only.',
      'Respond with ONLY the JSON object.'
    ].join('\n');

    // Model ID. Swap this string to use a newer model.  ANCHOR: MODEL_ID
    const MODEL = 'claude-haiku-4-5-20251001';

    const content = images.map(function (im) {
      return { type: 'image', source: { type: 'base64', media_type: im.mediaType, data: im.data } };
    });
    content.push({ type: 'text', text: prompt });

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        messages: [{ role: 'user', content: content }]
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

    // Guarantee every expected key exists (empty string if the model omitted it).
    const keys = ['firstName', 'lastName', 'fullName', 'title', 'company', 'phone', 'email',
      'website', 'mainCategory', 'subCategory', 'tagline', 'services', 'city', 'state', 'county', 'rawText'];
    const out = {};
    keys.forEach(function (k) { out[k] = typeof fields[k] === 'string' ? fields[k] : (fields[k] == null ? '' : String(fields[k])); });

    res.status(200).json(out);
  } catch (err) {
    res.status(500).json({ error: 'Unexpected error', detail: String(err) });
  }
};
