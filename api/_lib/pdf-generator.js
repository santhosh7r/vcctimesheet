// PDF generation utility
// Uses a lightweight approach for serverless: render HTML and convert
// For production, consider puppeteer-core + @sparticuz/chromium or a PDF API service

export async function generatePdfFromHtml(html) {
  // Option 1: Use an external PDF API service (recommended for serverless)
  // This avoids the heavy chromium dependency
  const pdfApiUrl = process.env.PDF_API_URL;

  if (pdfApiUrl) {
    const res = await fetch(pdfApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
    });
    if (!res.ok) throw new Error('PDF generation failed');
    return Buffer.from(await res.arrayBuffer());
  }

  // Option 2: Fallback — return HTML as-is (for dev/testing)
  // In production, set PDF_API_URL or use a service like html-pdf-api
  console.warn('PDF_API_URL not set. Returning HTML content as placeholder.');
  return Buffer.from(html, 'utf-8');
}

export function renderTemplate(htmlTemplate, variables) {
  let rendered = htmlTemplate;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '');
  }
  return rendered;
}
