const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, max_tokens = 1500 } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens,
    messages: [{ role: 'user', content: prompt }],
  });

  res.status(200).json({ content: message.content });
};
