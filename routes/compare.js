import express from "express";
import * as cheerio from "cheerio";

const router = express.Router();

const SCRAPERAPI_KEY = "9beee395438251e0b089bfc3c2a749d7"

if (!SCRAPERAPI_KEY) {
  console.warn("⚠️ SCRAPERAPI_KEY not set — set process.env.SCRAPERAPI_KEY");
}

async function fetchViaScraperApi(targetUrl) {
  const encoded = encodeURIComponent(targetUrl);
  // render=true => ScraperAPI will render JS (useful for JS-heavy sites)
  const apiUrl = `https://api.scraperapi.com?api_key=${encodeURIComponent(SCRAPERAPI_KEY)}&render=true&url=${encoded}`;
  console.log("🔎 Fetching via ScraperAPI:", apiUrl);
  const res = await fetch(apiUrl, { timeout: 120000 });
  if (!res.ok) {
    const txt = await res.text().catch(()=>"");
    throw new Error(`ScraperAPI returned ${res.status} ${res.statusText}. Body length: ${txt.length}`);
  }
  const html = await res.text();
  return html;
}

async function scrapeAmazon(query) {
  // keep your previous implementation or fetch via ScraperAPI similarly
  try {
    const url = `https://www.amazon.eg/s?k=${encodeURIComponent(query)}`;
    const html = await fetchViaScraperApi(url);

    const $ = cheerio.load(html);
    const card = $("div.s-main-slot div[data-component-type='s-search-result']").first();

    const title = card.find("h2 span").text().trim() || null;
    // price assembling attempt
    const priceWhole = card.find(".a-price .a-price-whole").first().text().trim() || null;
    const priceFraction = card.find(".a-price .a-price-fraction").first().text().trim() || "";
    const priceSymbol = card.find(".a-price .a-price-symbol").first().text().trim() || "";
    const price = priceWhole ? `${priceSymbol}${priceWhole}${priceFraction ? "."+priceFraction : ""}` : null;

    return { site: "amazon", title, price };
  } catch (err) {
    return { site: "amazon", error: err.message || String(err) };
  }
}

async function scrapeJumia(query) {
  try {
    const url = `https://www.jumia.com.eg/catalog/?q=${encodeURIComponent(query)}`;
    const html = await fetchViaScraperApi(url);
    const $ = cheerio.load(html);

    const card = $("article.prd").first();
    const title = card.find("h3.name").text().trim() || null;
    const price = card.find(".prc").text().trim() || null;

    return { site: "jumia", title, price };
  } catch (err) {
    return { site: "jumia", error: err.message || String(err) };
  }
}

async function scrapeNoon(query) {
  try {
    if (!SCRAPERAPI_KEY) {
      return { site: "noon", error: "SCRAPERAPI_KEY not configured on server" };
    }

    const targetUrl = `https://www.noon.com/egypt-en/search/?q=${encodeURIComponent(query)}`;
    const html = await fetchViaScraperApi(targetUrl);
    console.log("✅ ScraperAPI returned HTML length:", html.length);

    const $ = cheerio.load(html);

    // Try multiple selectors (same list we used before)
    const selectors = [
      "div.ProductDetailsSection_wrapper__yLBrw",
      "div.productContainer",
      "div.productGrid",
      "div.gridView",
      "li.product",
      "div[data-qa='plp-product-box']",
      ".productCard",
      ".productListItem"
    ];

    let foundEl = null;
    let usedSelector = null;
    for (const sel of selectors) {
      const el = $(sel).first();
      if (el && el.length) {
        foundEl = el;
        usedSelector = sel;
        break;
      }
    }

    if (!foundEl) {
      // fallback: try to extract page title / h1
      const fallbackTitle = $("title").text().trim() || $("h1").first().text().trim() || null;
      return {
        site: "noon",
        title: fallbackTitle,
        price: null,
        note: "No product card selector found — markup may differ or ScraperAPI returned challenge page.",
      };
    }

    // Within the found element attempt to extract title & price using a few patterns
    const titleCandidates = [
      "h2", ".productTitle", ".name", ".product-name", ".title"
    ];
    let title = null;
    for (const tSel of titleCandidates) {
      const text = foundEl.find(tSel).first().text().trim();
      if (text) { title = text; break; }
    }

    const priceCandidates = [
      "[data-qa='plp-product-box-price']", ".price", ".product-price", ".prc"
    ];
    let price = null;
    for (const pSel of priceCandidates) {
      const pText = foundEl.find(pSel).first().text().trim();
      if (pText) { price = pText; break; }
    }

    return { site: "noon", title, price, usedSelector };
  } catch (err) {
    return { site: "noon", error: err.message || String(err) };
  }
}

router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) return res.status(400).json({ error: "query required" });

    // run in parallel
    const [amazon, jumia, noon] = await Promise.all([
      scrapeAmazon(query),
      scrapeJumia(query),
      scrapeNoon(query),
    ]);

    return res.json({ scraped: [amazon, jumia, noon] });
  } catch (err) {
    console.error("Router error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

export default router;
