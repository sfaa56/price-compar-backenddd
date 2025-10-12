const endpoint = "https://production-sfo.browserless.io/chromium/bql";
const token = "2TDt2b9SEZ0tkix38758f1189c1427554f6558f685b6a44cc";

async function fetchBrowserQL() {

    
  const response = await fetch(`${endpoint}?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
      mutation MultiLineEvaluate {
        goto(url: "https://www.noon.com/egypt-en/search/?q=iphone") {
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
      }`
    }),
  });

  const data = await response.json();
  console.log(data);
}

fetchBrowserQL();
