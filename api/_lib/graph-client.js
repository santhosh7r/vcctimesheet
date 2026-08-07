const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

let tokenCache = { token: null, expiresAt: 0 };

export async function getGraphToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token request failed: ${err}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

export async function graphFetch(path, options = {}) {
  const token = await getGraphToken();
  const url = path.startsWith('https://') ? path : `https://graph.microsoft.com/v1.0${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph API error (${res.status}): ${err}`);
  }
  // Some Graph endpoints (e.g. sendMail) return 202 with no body
  if (res.status === 202 || res.headers.get('content-length') === '0') {
    return {};
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}
