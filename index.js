const axios = require('axios');
const fs = require('fs');

const ADDRESS_API = "https://sodex.dev/mainnet/chain/user/";
const PNL_API = "https://mainnet-data.sodex.dev/api/v1/perps/pnl/overview?account_id=";
const API_DELAY = 100; // Adjust if getting blocked

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchData(id) {
    try {
        const addrRes = await axios.get(`${ADDRESS_API}${id}/address`, { timeout: 5000 });
        if (addrRes.data.code === 0 && addrRes.data.data?.address) {
            const address = addrRes.data.data.address;
            const pnlRes = await axios.get(`${PNL_API}${id}`, { timeout: 5000 });
            const pnlData = pnlRes.data.data || {};
            
            return {
                id,
                address,
                volume: pnlData.cumulative_quote_volume || "0",
                pnl: pnlData.cumulative_pnl || "0"
            };
        }
    } catch (e) { return null; }
    return null;
}

async function main() {
    console.log("🔍 Scanning for limit...");
    let low = 1000, high = 100000, limit = 1000;
    while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        let check = await fetchData(mid);
        if (check) { limit = mid; low = mid + 1; }
        else { high = mid - 1; }
        await sleep(API_DELAY);
    }

    console.log(`🚀 Scraping up to ID ${limit}...`);
    let results = [];
    for (let i = 1000; i <= limit; i++) {
        const user = await fetchData(i);
        if (user) results.push(user);
        if (i % 20 === 0) console.log(`Progress: ${i}/${limit}`);
        await sleep(API_DELAY);
    }

    const finalJson = {
        updated_at: new Date().toISOString(),
        total_users: results.length,
        users: results
    };

    fs.writeFileSync('sodex_data.json', JSON.stringify(finalJson, null, 2));
    console.log("✅ Done!");
}

main();
