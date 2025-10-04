import express from "express";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";

chromium.use(stealth());
const router = express.Router();

router.post("/", async (req, res) => {
  const { query } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: "query requird" });
  }

  const results = [];

  async function scrapeAmazon() {
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(`https://www.amazon.eg/s?k=${encodeURIComponent(query)}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForSelector("div.s-main-slot div[data-component-type='s-search-result']", { timeout: 15000 });
      const card = (await page.$$("div.s-main-slot div[data-component-type='s-search-result']"))[0];
      const title = await card.$eval("h2 span", el => el.innerText).catch(() => null);
      const price = await card.$eval(".a-price .a-price-whole", el => el.innerText).catch(() => null);
      await browser.close();
    console.log("hiiiii")
      return { site: "amazon", title, price };
    } catch (err) {
      return { site: "amazon", error: err.message };
    }
  }

  async function scrapeJumia() {
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(`https://www.jumia.com.eg/catalog/?q=${encodeURIComponent(query)}`, { timeout: 60000 });
      await page.waitForSelector("article.prd h3.name", { timeout: 15000 });
      const card = await page.locator("article.prd").first();
      const title = await card.locator("h3.name").innerText().catch(() => null);
      const price = await card.locator(".prc").innerText().catch(() => null);
      await browser.close();
      return { site: "jumia", title, price };
    } catch (err) {
      return { site: "jumia", error: err.message };
    }
  }

async function scrapeNoon() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const page = await context.newPage();
  const url = `https://www.noon.com/egypt-en/search/?q=${encodeURIComponent(
    query
  )}`;

  try {
    console.log("🟢 Opening:", url);
    await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });

    const content = await page.content();
    console.log("✅ Page loaded. HTML length:", content.length);

    // Try multiple possible selectors (fallback)
    const selectors = [
      "div.ProductDetailsSection_wrapper__yLBrw",
      "div.productContainer",
      "div.productGrid",
      "div.gridView",
      "li.product",
    ];

    let productCard = null;
    let usedSelector = null;

    for (const selector of selectors) {
      const el = await page.$(selector);
      if (el) {
        usedSelector = selector;
        const cards = await page.$$(selector);
        if (cards && cards.length > 0) {
          productCard = cards[0];
          break;
        }
      }
    }

    if (!productCard) {
      // no product found — take screenshot + return debug info
      const tmpPath = "/tmp/noon-debug.png";
      await page.screenshot({ path: tmpPath, fullPage: true }).catch(() => {});
      const buffer = await page.screenshot({ fullPage: true }).catch(() => null);

      // convert to base64 if buffer available
      let b64 = null;
      if (buffer) {
        b64 = buffer.toString("base64");
        // print small prefix in logs so you can quickly spot it
        console.log("📸 Screenshot base64 prefix:", b64.slice(0, 200));
      } else {
        console.log("⚠️ Screenshot buffer not available.");
      }

      await browser.close();

      return {
        site: "noon",
        error:
          "No product card found on Noon page (likely blocked or different markup).",
        debug: {
          htmlLength: content.length,
          usedSelector: null,
          screenshotPath: tmpPath,
          screenshotBase64: b64, // may be large
        },
      };
    }

    // Extract title + price with fallbacks
    const title =
      (await productCard
        .$eval("h2", (el) => el.textContent.trim())
        .catch(() => null)) ||
      (await productCard
        .$eval("h3", (el) => el.textContent.trim())
        .catch(() => null)) ||
      null;

    const price =
      (await productCard
        .$eval("div[data-qa='plp-product-box-price']", (el) =>
          el.textContent.trim()
        )
        .catch(() => null)) ||
      (await productCard
        .$eval("strong", (el) => el.textContent.trim())
        .catch(() => null)) ||
      null;

    await browser.close();
    return { site: "noon", title, price, debug: { usedSelector } };
  } catch (err) {
    // on unexpected error: capture screenshot + html
    let b64 = null;
    try {
      const buffer = await page.screenshot({ fullPage: true }).catch(() => null);
      if (buffer) b64 = buffer.toString("base64");
    } catch (e) {
      console.log("⚠️ failed to capture screenshot:", e.message);
    }

    const pageHtml = await page.content().catch(() => null);
    await browser.close();

    return {
      site: "noon",
      error: err.message,
      debug: {
        htmlLength: pageHtml ? pageHtml.length : null,
        screenshotBase64: b64,
      },
    };
  } finally {
    // ensure browser closed in case of unexpected path
    try { await browser.close(); } catch (e) {}
  }
}




  const [amazon, jumia, noon] = await Promise.all([
    scrapeAmazon(),
    scrapeJumia(),
    scrapeNoon(),
  ]);

  results.push(amazon, jumia, noon);
  return res.status(200).json({ scraped: results });
});

export default router;
