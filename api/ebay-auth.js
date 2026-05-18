export default function handler(req, res) {
  const clientId = process.env.EBAY_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'EBAY_CLIENT_ID not configured' });
  }

  const redirectUri = 'https://your-vercel-url.vercel.app/api/ebay-callback';
  const scope = [
    'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope,
  });

  const url = `https://auth.ebay.com/oauth2/authorize?${params.toString()}`;
  return res.status(200).json({ url });
}
