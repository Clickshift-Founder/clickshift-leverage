export default async function handler(req, res) {
    const { method, body, query } = req;
    
    // This is a serverless function that runs for free on Vercel
    switch(method) {
        case 'GET':
            // Get user's watchlist from database
            const watchlist = await getWatchlist(query.userId);
            res.status(200).json(watchlist);
            break;
            
        case 'POST':
            // Add to watchlist
            const added = await addToWatchlist(body.userId, body.symbol, body.alerts);
            res.status(201).json(added);
            break;
            
        case 'DELETE':
            // Remove from watchlist
            await removeFromWatchlist(query.userId, query.symbol);
            res.status(204).end();
            break;
    }
}