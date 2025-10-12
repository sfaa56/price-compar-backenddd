import express from "express";
import puppeteer from "puppeteer-core";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import fetch from "node-fetch";

chromium.use(stealth());
const router = express.Router();

router.post("/", async (req, res) => {
  const { query } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: "query required" });
  }

  const results = [];

  // ===== AMAZON =====
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
      return { site: "amazon", title, price };
    } catch (err) {
      return { site: "amazon", error: err.message };
    }
  }

  // ===== JUMIA =====
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

  // ===== NOON (via Browserless.io) =====

  const endpoint = "https://production-sfo.browserless.io/chromium/bql";
  const token = "2TDt2b9SEZ0tkix38758f1189c1427554f6558f685b6a44cc";

  async function scrapeNoon() {
    try {
      const response = await fetch(`${endpoint}?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
      mutation MultiLineEvaluate($url: String!) {
        goto(url: $url) {
          status
        }

        evaluate(content: """
        (() => {
          try {
            const selectors = [
              'div.ProductDetailsSection_wrapper__yLBrw',
              'div.productContainer',
              'div.productList'
            ];

            let foundSelector = null;
            for (const sel of selectors) {
              if (document.querySelector(sel)) {
                foundSelector = sel;
                break;
              }
            }
            if (!foundSelector) throw new Error('No product wrapper selector found');

            const products = Array.from(document.querySelectorAll(foundSelector)).slice(0, 1);

            const results = products.map(card => {
              const title = card.querySelector('h2')?.textContent.trim() || null;
              const price = card.querySelector("div[data-qa='plp-product-box-price']")?.textContent.trim() || null;
              const url = card.querySelector('a')?.href || null;
              return { title, price, url };
            });

            return JSON.stringify({ results, count: results.length, error: null });
          } catch (e) {
            return JSON.stringify({ results: null, count: 0, error: e.message });
          }
        })()
        """) {
          value
        }
      }`,
          variables: {
            url: `https://www.noon.com/egypt-en/search/?q=${encodeURIComponent(
              query
            )}`,
          },
        }),
      });

      // قراءة الاستجابة وتحويل النص إلى JSON
      const data = await response.json();
      const noonStr = data.data.evaluate.value;
      const noonValue = JSON.parse(noonStr); // تحويل النص إلى كائن

      // في حال وجود خطأ تم رده
      if (noonValue.error) {
        return { site: "noon", error: noonValue.error };
      }

      // التأكد من وجود نتائج واستخراج أول نتيجة
      const products = noonValue.results;
      if (!products || products.length === 0) {
        return { site: "noon", error: "No products found" };
      }
      const firstProduct = products[0];

      console.log(data);

      // إرجاع الكائن المطلوب مع العنوان والسعر
      return {
        site: "noon",
        title: firstProduct.title || null,
        price: firstProduct.price || null,
      };
    } catch (err) {
      // في حال حدوث خطأ في الطلب نفسه
      return { site: "noon", error: err.message };
    }
  }

  // Run all
  const [amazon, jumia, noon] = await Promise.all([
    scrapeAmazon(),
    scrapeJumia(),
    scrapeNoon(),
  ]);
  results.push(amazon, jumia, noon);

  res.status(200).json({ scraped: results });
});

export default router;
