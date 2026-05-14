module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { itemName } = req.body || {};
  if (!itemName || !String(itemName).trim()) {
    return res.status(400).json({ error: 'itemName is required' });
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: 'eBay API credentials are not configured. Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in your environment.'
    });
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope'
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return res.status(502).json({
        error: `eBay authentication failed (${tokenRes.status}) — check your EBAY_CLIENT_ID and EBAY_CLIENT_SECRET. Detail: ${errText.slice(0, 200)}`
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(502).json({ error: 'eBay returned no access token. Verify your API credentials.' });
    }

    const params = new URLSearchParams({
      q: String(itemName).trim(),
      marketplace_id: 'EBAY_GB',
      limit: '5',
      filter: 'buyingOptions:{FIXED_PRICE}'
    });

    const searchRes = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_GB',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      return res.status(502).json({
        error: `eBay search failed (${searchRes.status}): ${errText.slice(0, 200)}`
      });
    }

    const searchData = await searchRes.json();
    const items = searchData.itemSummaries || [];

    if (items.length === 0) {
      return res.status(200).json({
        prices: [],
        average: null,
        message: `No listings found on eBay for "${itemName}". Try a broader or different search term.`
      });
    }

    const prices = items
      .map(item => ({
        title: item.title ? String(item.title).slice(0, 80) : 'Unknown item',
        price: parseFloat(item.price?.value || 0),
        currency: item.price?.currency || 'GBP'
      }))
      .filter(p => p.price > 0 && p.currency === 'GBP');

    if (prices.length === 0) {
      return res.status(200).json({
        prices: [],
        average: null,
        message: 'Listings found but no valid GBP prices returned. Try a different search term.'
      });
    }

    const average =
      Math.round((prices.reduce((sum, p) => sum + p.price, 0) / prices.length) * 100) / 100;

    return res.status(200).json({ prices, average });
  } catch (err) {
    return res.status(500).json({ error: `Unexpected error: ${err.message}` });
  }
};
