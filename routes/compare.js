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
      await page.goto(
        `https://www.amazon.eg/s?k=${encodeURIComponent(query)}`,
        {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        }
      );
      await page.waitForSelector(
        "div.s-main-slot div[data-component-type='s-search-result']",
        { timeout: 15000 }
      );
      const card = (
        await page.$$(
          "div.s-main-slot div[data-component-type='s-search-result']"
        )
      )[0];
      const title = await card
        .$eval("h2 span", (el) => el.innerText)
        .catch(() => null);
      const price = await card
        .$eval(".a-price .a-price-whole", (el) => el.innerText)
        .catch(() => null);
      await browser.close();
      console.log("hiiiii");
      return { site: "amazon", title, price };
    } catch (err) {
      return { site: "amazon", error: err.message };
    }
  }

  async function scrapeJumia() {
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(
        `https://www.jumia.com.eg/catalog/?q=${encodeURIComponent(query)}`,
        { timeout: 60000 }
      );
      await page.waitForSelector("article.prd h3.name", { timeout: 15000 });
      const card = await page.locator("article.prd").first();
      const title = await card
        .locator("h3.name")
        .innerText()
        .catch(() => null);
      const price = await card
        .locator(".prc")
        .innerText()
        .catch(() => null);
      await browser.close();
      return { site: "jumia", title, price };
    } catch (err) {
      return { site: "jumia", error: err.message };
    }
  }

  async function scrapeNoon() {
    const browser = await chromium.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--start-maximized",
        "--no-first-run",
        "--no-default-browser-check",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "en-US,en;q=0.9",
      viewport: { width: 1366, height: 768 },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3],
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });
    });

    const page = await context.newPage();
    const url = `https://www.noon.com/egypt-en/search/?q=${encodeURIComponent(
      query
    )}`;

    try {
      console.log("🟢 Opening:", url);

      await page.setExtraHTTPHeaders({
        "accept-language": "en-US,en;q=0.9",
        "user-agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${100 + Math.floor(Math.random() * 20)}.0.0.0 Safari/537.36`,
      });

      await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });

      // تأكد إن الصفحة فعلاً اتحملت
      const html = await page.content();
      if (html.includes("Access Denied")) {
        throw new Error(
          "❌ Access Denied detected — Noon blocked this request"
        );
      }

      // 🧩 Try multiple selectors for debugging
      const selectors = [
        "div.ProductDetailsSection_wrapper__yLBrw",
        "div.productContainer",
        "div.productList",
      ];
      let foundSelector = null;
      for (const selector of selectors) {
        const exists = await page.$(selector);
        if (exists) {
          foundSelector = selector;
          console.log("✅ Found selector:", selector);
          break;
        } else {
          console.log("❌ Not found:", selector);
        }
      }

      const card = (await page.$$(foundSelector))[0];
      if (!card) throw new Error("No product card found");
      const title = await card
        .$eval("h2", (el) => el.textContent.trim())
        .catch(() => null);
      const price = await card
        .$eval("div[data-qa='plp-product-box-price']", (el) =>
          el.textContent.trim()
        )
        .catch(() => null);

      console.log("✅ Extracted:", { title, price });
      return { site: "noon", title, price };
    } catch (err) {
      console.error("❌ Noon scraping error:", err.message);
      return { site: "noon", error: err.message };
    } finally {
      await browser.close();
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
