const axios = require('axios');
const fs = require('fs');

const ADDRESS_API = "https://sodex.dev/mainnet/chain/user/";
const PNL_API = "https://mainnet-data.sodex.dev/api/v1/perps/pnl/overview?account_id=";
const API_DELAY = 50; // Reduced delay since we are batching
const CONCURRENCY = 25; // Number of users to fetch at the exact same time

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchData(id) {
    try {
        const addrRes = await axios.get(`${ADDRESS_API}${id}/address`, { timeout: 6000 });
        if (addrRes.data.code === 0 && addrRes.data.data?.address) {
            const address = addrRes.data.data.address;
            const pnlRes = await axios.get(`${PNL_API}${id}`, { timeout: 6000 });
            const pnlData = pnlRes.data.data || {};

            return {
                id,
                address,
                volume: pnlData.cumulative_quote_volume || "0",
                pnl: pnlData.cumulative_pnl || "0"
            };
        }
    } catch (e) { 
        return null; 
    }
    return null;
}

async function main() {
    console.log("🔍 Finding the last active User ID...");
    let low = 1000, high = 100000, limit = 1000;
    while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        let check = await fetchData(mid);
        if (check) { limit = mid; low = mid + 1; }
        else { high = mid - 1; }
    }

    console.log(`🚀 Scraping up to ID ${limit} with concurrency: ${CONCURRENCY}`);
    let results = [];
    let ids = Array.from({ length: limit - 999 }, (_, i) => i + 1000);

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
        const batch = ids.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(batch.map(id => fetchData(id)));
        
        results.push(...batchResults.filter(u => u !== null));
        
        console.log(`Progress: ${Math.min(i + CONCURRENCY, ids.length)}/${ids.length}`);
        await sleep(API_DELAY); 
    }

    const finalJson = {
        updated_at: new Date().toISOString(),
        total_users: results.length,
        users: results.sort((a, b) => a.id - b.id) // Ensure they stay in order
    };

    fs.writeFileSync('sodex_data.json', JSON.stringify(finalJson, null, 2));
    console.log(`✅ Done! Saved ${results.length} users.`);
}

main();
