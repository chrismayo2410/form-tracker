export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const redirectUri = 'https://form-tracker-chi.vercel.app/api/ebay-callback';
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const data = await tokenRes.json();

    if (!data.access_token) {
      return res.status(400).send('Token exchange failed: ' + (data.error_description || JSON.stringify(data)));
    }

    const params = new URLSearchParams({
      ebayAccessToken: data.access_token,
      ebayRefreshToken: data.refresh_token || '',
    });

    return res.redirect(302, `/reselling?${params.toString()}`);
  } catch (e) {
    return res.status(500).send('Token exchange error: ' + e.message);
  }
}
