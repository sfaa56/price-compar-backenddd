import fetch from "node-fetch";

async function scrapeNoonBQL(query) {
  const token = "2TDqjXr6LNRyv7T901f4181a5f862298dce25b51cc4a52b6e";
  const url = `https://www.noon.com/egypt-en/search/?q=${encodeURIComponent(query)}`;
  const endpoint = `https://production-sfo.browserless.io/chromium/bql?token=${token}`;

  const gql = {
    query: `
      mutation Scrape($url: String!) {
        goto(url: $url, waitUntil: load) { status }

        title: text(selector: "h2")
        price: text(selector: "div[data-qa='plp-product-box-price']")
      }
    `,
    variables: { url }
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(gql)
  });

  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error(`Browserless returned non-JSON: ${text.slice(0, 800)}`); }

  if (json.errors) throw new Error("BrowserQL errors: " + JSON.stringify(json.errors, null, 2));

  // direct string now
  return {
    site: "noon",
    title: json.data?.title,
    price: json.data?.price
  };
}

// تجربة
scrapeNoonBQL("iphone")
  .then(r => console.log("✅ Result:", r))
  .catch(e => console.error("❌ Error:", e.message));
