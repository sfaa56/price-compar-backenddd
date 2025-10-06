import express from "express";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";

chromium.use(stealth());
const router = express.Router();

router.post("/", async (req, res) => {
  const { query } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: "query required" });
  }

  async function scrapeNoon() {
    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-features=VizDisplayCompositor",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-web-security",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-default-apps",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-zygote",
          "--single-process",
          "--hide-scrollbars",
          "--mute-audio",
          "--window-size=412,732"
        ],
      });

      const context = await browser.newContext({
        viewport: { width: 412, height: 732 },
        userAgent: getRandomMobileUserAgent(),
        locale: 'en-US',
        timezoneId: 'Africa/Cairo',
        geolocation: { latitude: 30.0444, longitude: 31.2357 }, // Cairo coordinates
        permissions: ['geolocation'],
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
        },
      });

      // Enhanced fingerprint spoofing
      await context.addInitScript(() => {
        // Override webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });

        // Override languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });

        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Mock chrome runtime
        window.chrome = {
          runtime: {},
          loadTimes: () => {},
          csi: () => {},
          app: {}
        };

        // Spoof WebGL
        const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) return 'Intel Inc.';
          if (parameter === 37446) return 'Intel Iris OpenGL Engine';
          return originalGetParameter.call(this, parameter);
        };

        // Spoof permissions
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });

      const page = await context.newPage();

      // Block unnecessary resources to speed up loading
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'font', 'media'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      const url = `https://www.noon.com/egypt-en/search/?q=${encodeURIComponent(query)}`;

      console.log("🟢 Opening Noon:", url);

      // Add random delays between actions
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 45000 
      });

      // Random human-like delays
      await page.waitForTimeout(getRandomDelay(2000, 5000));

      // Simulate human scrolling
      await page.evaluate(() => {
        window.scrollBy(0, 200 + Math.random() * 300);
      });
      await page.waitForTimeout(1000);
      
      await page.evaluate(() => {
        window.scrollBy(0, 300 + Math.random() * 400);
      });

      // Check for blocking
      const content = await page.content();
      if (content.includes("Access Denied") || 
          content.includes("blocked") || 
          content.includes("bot") ||
          await page.$('div#challenge-form')) {
        throw new Error("❌ Access Denied - Noon blocked the request");
      }

      // Wait for products to load with multiple selector options
      const productSelectors = [
        "div[data-qa='product-container']",
        ".productContainer",
        ".sc-9e6b8f9c-0",
        "div.ProductDetailsSection_wrapper__yLBrw",
        "div.productList > div"
      ];

      let productElement = null;
      for (const selector of productSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 10000 });
          productElement = await page.$(selector);
          if (productElement) {
            console.log("✅ Found products with selector:", selector);
            break;
          }
        } catch (e) {
          console.log("❌ Selector not found:", selector);
        }
      }

      if (!productElement) {
        throw new Error("❌ No product elements found on page");
      }

      // Extract product data with multiple fallback selectors
      const productData = await page.evaluate(() => {
        // Try multiple title selectors
        const titleSelectors = [
          "h2",
          "[data-qa='product-name']",
          ".sc-77d6c0b0-0",
          ".name"
        ];
        
        // Try multiple price selectors  
        const priceSelectors = [
          "[data-qa='product-price']",
          ".sellingPrice",
          ".sc-77d6c0b0-1",
          ".amount",
          ".price"
        ];

        let title = "N/A";
        let price = "N/A";

        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent?.trim()) {
            title = element.textContent.trim();
            break;
          }
        }

        for (const selector of priceSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent?.trim()) {
            price = element.textContent.trim();
            break;
          }
        }

        return { title, price };
      });

      console.log("✅ Successfully scraped Noon:", productData);
      return { site: "noon", ...productData };

    } catch (err) {
      console.error("❌ Noon scraping failed:", err.message);
      return { site: "noon", error: err.message };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // Helper functions
  function getRandomMobileUserAgent() {
    const userAgents = [
      "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; Android 12; SM-S906N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (iPhone14,6; U; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/15.4 Mobile/19E5219a Safari/602.1"
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  try {
    const noonResult = await scrapeNoon();
    return res.status(200).json({ scraped: [noonResult] });
  } catch (error) {
    return res.status(500).json({ scraped: [{ site: "noon", error: error.message }] });
  }
});

export default router;