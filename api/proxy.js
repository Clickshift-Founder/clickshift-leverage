// FILE: api/proxy.js - Place in your Vercel project
// This bypasses CORS and VPN requirements for your demo

export default async function handler(req, res) {
    // Enable CORS for your domains
    const allowedOrigins = [
        'https://leverage.clickshift.io',
        'https://alpha.clickshift.io',
        'https://clickbot.clickshift.io',
        'http://localhost:3000',
        'http://localhost:5000'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const { exchange, endpoint, symbol } = req.query;
    
    try {
        let apiUrl;
        
        // Route to different exchanges
        switch(exchange) {
            case 'binance':
                apiUrl = `https://api.binance.com/api/v3/${endpoint}${symbol ? `?symbol=${symbol}` : ''}`;
                break;
            case 'binance-futures':
                apiUrl = `https://fapi.binance.com/fapi/v1/${endpoint}${symbol ? `?symbol=${symbol}` : ''}`;
                break;
            case 'bybit':
                apiUrl = `https://api.bybit.com/v5/market/${endpoint}${symbol ? `?symbol=${symbol}` : ''}`;
                break;
            case 'coingecko':
                apiUrl = `https://api.coingecko.com/api/v3/${endpoint}`;
                break;
            case 'dexscreener':
                apiUrl = `https://api.dexscreener.com/latest/dex/${endpoint}`;
                break;
            default:
                return res.status(400).json({ error: 'Invalid exchange' });
        }
        
        // Fetch from the actual API
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const data = await response.json();
        
        // Cache for 10 seconds to reduce API calls
        res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');
        
        return res.status(200).json(data);
        
    } catch (error) {
        console.error('Proxy error:', error);
        
        // Return demo data as fallback
        return res.status(200).json({
            symbol: symbol || 'BTCUSDT',
            price: '65432.10',
            priceChangePercent: '2.45',
            volume: '1234567890',
            source: 'demo_fallback',
            error: error.message
        });
    }
}