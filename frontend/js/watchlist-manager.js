// ========================================
// CLICKSHIFT LEVERAGE - WATCHLIST & NOTIFICATIONS
// REAL-TIME MONITORING WITH BROWSER ALERTS
// ========================================

class WatchlistManager {
    constructor() {
        this.watchlist = this.loadWatchlist();
        this.intervals = new Map();
        this.checkInterval = 300000; // 5 minutes default
        this.init();
    }
    
    init() {
        console.log('👁️ Initializing Watchlist Manager...');
        
        // Request notification permission
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        console.log('✅ Notifications enabled!');
                        this.showNotification('Watchlist Active', 'You will receive alerts for price changes and signals');
                    }
                });
            } else if (Notification.permission === 'granted') {
                console.log('✅ Notifications already enabled');
            }
        }
        
        // Create UI
        this.createWatchlistUI();
        
        // Start monitoring existing items
        this.startMonitoring();
        
        // Update display
        this.updateWatchlistDisplay();
    }
    
    // ============ STORAGE MANAGEMENT ============
    loadWatchlist() {
        try {
            const saved = localStorage.getItem('leverage_watchlist');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Failed to load watchlist:', error);
            return [];
        }
    }
    
    saveWatchlist() {
        try {
            localStorage.setItem('leverage_watchlist', JSON.stringify(this.watchlist));
            console.log('💾 Watchlist saved');
        } catch (error) {
            console.error('Failed to save watchlist:', error);
        }
    }
    
    // ============ ADD TO WATCHLIST ============
    addToWatchlist(symbol, customAlerts = {}) {
        // Check if already exists
        if (this.watchlist.find(item => item.symbol === symbol)) {
            alert(`${symbol} is already in your watchlist!`);
            return null;
        }
        
        const item = {
            id: Date.now().toString(),
            symbol: symbol.toUpperCase(),
            addedAt: Date.now(),
            alerts: {
                priceAbove: customAlerts.priceAbove || null,
                priceBelow: customAlerts.priceBelow || null,
                percentChange: customAlerts.percentChange || 5, // Alert on 5% change
                signalChange: customAlerts.signalChange !== false,
                strongBuy: customAlerts.strongBuy !== false,
                strongSell: customAlerts.strongSell !== false,
                fundingRate: customAlerts.fundingRate !== false
            },
            lastCheck: null,
            lastPrice: null,
            lastSignal: null,
            lastFunding: null,
            checkCount: 0,
            alertCount: 0
        };
        
        this.watchlist.push(item);
        this.saveWatchlist();
        this.monitorSymbol(item);
        this.updateWatchlistDisplay();
        
        console.log(`✅ Added ${symbol} to watchlist`);
        this.showNotification('Added to Watchlist', `Now monitoring ${symbol} for signals`);
        
        return item;
    }
    
    // ============ REMOVE FROM WATCHLIST ============
    removeFromWatchlist(symbol) {
        const index = this.watchlist.findIndex(item => item.symbol === symbol);
        if (index === -1) return;
        
        // Stop monitoring
        if (this.intervals.has(symbol)) {
            clearInterval(this.intervals.get(symbol));
            this.intervals.delete(symbol);
        }
        
        // Remove from list
        this.watchlist.splice(index, 1);
        this.saveWatchlist();
        this.updateWatchlistDisplay();
        
        console.log(`🗑️ Removed ${symbol} from watchlist`);
    }
    
    // ============ MONITOR SYMBOL ============
    async monitorSymbol(item) {
        // Clear existing interval if any
        if (this.intervals.has(item.symbol)) {
            clearInterval(this.intervals.get(item.symbol));
        }
        
        // Function to check the symbol
        const checkSymbol = async () => {
            try {
                console.log(`🔍 Checking ${item.symbol}...`);
                
                // Get market data
                let marketData;
                if (window.futuresAPI) {
                    marketData = await window.futuresAPI.searchAllExchanges(item.symbol);
                } else if (window.exchangeAPI) {
                    marketData = await window.exchangeAPI.getMarketDataEnhanced(item.symbol);
                } else {
                    console.error('No exchange API available');
                    return;
                }
                
                // Generate technical analysis
                const technicalSignals = window.generateTechnicalAnalysis ? 
                    window.generateTechnicalAnalysis(marketData) : null;
                
                const recommendation = window.generateSmartRecommendation ? 
                    window.generateSmartRecommendation(technicalSignals, marketData) : null;
                
                // Check for alerts
                const alerts = this.checkAlerts(item, marketData, recommendation);
                
                // Update item data
                item.lastCheck = Date.now();
                item.lastPrice = marketData.currentPrice;
                item.lastSignal = recommendation ? recommendation.direction : null;
                item.lastFunding = marketData.fundingRate || null;
                item.checkCount++;
                
                // Save updates
                this.saveWatchlist();
                
                // Update display
                this.updateWatchlistItemDisplay(item);
                
                // Send notifications for alerts
                alerts.forEach(alert => {
                    this.sendAlert(alert, item, marketData);
                    item.alertCount++;
                });
                
            } catch (error) {
                console.error(`Failed to check ${item.symbol}:`, error);
            }
        };
        
        // Initial check
        checkSymbol();
        
        // Set up interval
        const interval = setInterval(checkSymbol, this.checkInterval);
        this.intervals.set(item.symbol, interval);
    }
    
    // ============ CHECK ALERTS ============
    checkAlerts(item, marketData, recommendation) {
        const alerts = [];
        
        // Price alerts
        if (item.alerts.priceAbove && marketData.currentPrice > item.alerts.priceAbove) {
            alerts.push({
                type: 'price_above',
                message: `${item.symbol} above $${item.alerts.priceAbove.toFixed(2)}`,
                price: marketData.currentPrice,
                severity: 'high'
            });
            
            // Disable this alert after triggering
            item.alerts.priceAbove = null;
        }
        
        if (item.alerts.priceBelow && marketData.currentPrice < item.alerts.priceBelow) {
            alerts.push({
                type: 'price_below',
                message: `${item.symbol} below $${item.alerts.priceBelow.toFixed(2)}`,
                price: marketData.currentPrice,
                severity: 'high'
            });
            
            // Disable this alert after triggering
            item.alerts.priceBelow = null;
        }
        
        // Percent change alert
        if (item.lastPrice && item.alerts.percentChange) {
            const percentChange = ((marketData.currentPrice - item.lastPrice) / item.lastPrice) * 100;
            
            if (Math.abs(percentChange) >= item.alerts.percentChange) {
                const direction = percentChange > 0 ? '📈 UP' : '📉 DOWN';
                alerts.push({
                    type: 'percent_change',
                    message: `${item.symbol} ${direction} ${Math.abs(percentChange).toFixed(2)}%`,
                    price: marketData.currentPrice,
                    severity: 'medium'
                });
            }
        }
        
        // Signal change alert
        if (recommendation && item.alerts.signalChange && item.lastSignal && 
            item.lastSignal !== recommendation.direction) {
            alerts.push({
                type: 'signal_change',
                message: `${item.symbol} signal: ${recommendation.direction}`,
                price: marketData.currentPrice,
                severity: recommendation.confidence === 'HIGH' ? 'high' : 'medium',
                recommendation: recommendation
            });
        }
        
        // Strong buy signal
        if (recommendation && item.alerts.strongBuy && 
            recommendation.direction === 'LONG' && 
            recommendation.confidence === 'HIGH') {
            alerts.push({
                type: 'strong_buy',
                message: `🚀 STRONG BUY: ${item.symbol}`,
                price: marketData.currentPrice,
                severity: 'high',
                recommendation: recommendation
            });
        }
        
        // Strong sell signal
        if (recommendation && item.alerts.strongSell && 
            recommendation.direction === 'SHORT' && 
            recommendation.confidence === 'HIGH') {
            alerts.push({
                type: 'strong_sell',
                message: `🔻 STRONG SELL: ${item.symbol}`,
                price: marketData.currentPrice,
                severity: 'high',
                recommendation: recommendation
            });
        }
        
        // Funding rate alert (for futures)
        if (marketData.fundingRate !== undefined && item.alerts.fundingRate) {
            const fundingPercent = marketData.fundingRate * 100;
            
            if (Math.abs(fundingPercent) > 0.1) {
                const fundingType = fundingPercent > 0 ? 'Longs paying' : 'Shorts paying';
                alerts.push({
                    type: 'funding_rate',
                    message: `${item.symbol} funding: ${fundingPercent.toFixed(4)}% (${fundingType})`,
                    price: marketData.currentPrice,
                    severity: Math.abs(fundingPercent) > 0.2 ? 'high' : 'low'
                });
            }
        }
        
        return alerts;
    }
    
    // ============ SEND ALERT ============
    sendAlert(alert, item, marketData) {
        // Browser notification
        this.showNotification(alert.message, `Price: $${marketData.currentPrice.toFixed(4)}`);
        
        // In-app alert
        this.showInAppAlert(alert, item);
        
        // Console log
        console.log(`🔔 Alert: ${alert.message}`);
        
        // Track alert
        if (window.gtag) {
            gtag('event', 'watchlist_alert', {
                event_category: 'monitoring',
                event_label: item.symbol,
                value: alert.type
            });
        }
    }
    
    // ============ BROWSER NOTIFICATION ============
    showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                const notification = new Notification(title, {
                    body: body,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/badge-72x72.png',
                    vibrate: [200, 100, 200],
                    tag: 'leverage-alert',
                    requireInteraction: false
                });
                
                // Auto close after 5 seconds
                setTimeout(() => notification.close(), 5000);
                
                // Click to analyze
                notification.onclick = function(event) {
                    event.preventDefault();
                    window.focus();
                    notification.close();
                };
            } catch (error) {
                console.error('Notification failed:', error);
            }
        }
    }
    
    // ============ IN-APP ALERT ============
    showInAppAlert(alert, item) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `watchlist-alert severity-${alert.severity}`;
        alertDiv.innerHTML = `
            <div class="alert-content">
                <div class="alert-header">
                    <span class="alert-icon">${this.getAlertIcon(alert.type)}</span>
                    <span class="alert-time">${new Date().toLocaleTimeString()}</span>
                </div>
                <div class="alert-message">${alert.message}</div>
                <div class="alert-price">$${alert.price.toFixed(4)}</div>
                ${alert.recommendation ? `
                    <div class="alert-recommendation">
                        <span>Entry: $${alert.recommendation.entry?.toFixed(4) || 'N/A'}</span>
                        <span>SL: $${alert.recommendation.stopLoss?.toFixed(4) || 'N/A'}</span>
                        <span>TP: $${alert.recommendation.takeProfit?.toFixed(4) || 'N/A'}</span>
                    </div>
                ` : ''}
                <div class="alert-actions">
                    <button onclick="window.quickAnalysis('${item.symbol}')" class="alert-action-btn primary">
                        📊 Analyze Now
                    </button>
                    <button onclick="this.closest('.watchlist-alert').remove()" class="alert-action-btn secondary">
                        Dismiss
                    </button>
                </div>
            </div>
        `;
        
        // Add to container
        let container = document.getElementById('alertContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'alertContainer';
            container.className = 'alert-container';
            document.body.appendChild(container);
        }
        
        container.appendChild(alertDiv);
        
        // Auto remove after 30 seconds
        setTimeout(() => {
            alertDiv.style.animation = 'slideOut 0.3s forwards';
            setTimeout(() => alertDiv.remove(), 300);
        }, 30000);
    }
    
    getAlertIcon(type) {
        const icons = {
            'price_above': '📈',
            'price_below': '📉',
            'percent_change': '📊',
            'signal_change': '🔄',
            'strong_buy': '🚀',
            'strong_sell': '🔻',
            'funding_rate': '💰'
        };
        return icons[type] || '🔔';
    }
    
    // ============ START MONITORING ============
    startMonitoring() {
        this.watchlist.forEach(item => this.monitorSymbol(item));
        console.log(`👁️ Monitoring ${this.watchlist.length} symbols`);
    }
    
    // ============ CREATE UI ============
    createWatchlistUI() {
        // Check if UI already exists
        if (document.getElementById('watchlistPanel')) return;
        
        const watchlistHTML = `
            <div id="watchlistPanel" class="watchlist-panel">
                <div class="watchlist-header">
                    <h3>👁️ Watchlist (${this.watchlist.length})</h3>
                    <div class="watchlist-controls">
                        <button onclick="window.watchlistManager.togglePanel()" class="toggle-btn">_</button>
                        <button onclick="window.watchlistManager.showSettings()" class="settings-btn">⚙️</button>
                    </div>
                </div>
                
                <div class="watchlist-content" id="watchlistContent">
                    <div class="add-to-watchlist">
                        <input type="text" 
                               id="watchlistSymbolInput" 
                               placeholder="Add symbol (e.g., BTC/USDT)"
                               onkeypress="if(event.key==='Enter') window.watchlistManager.addFromInput()">
                        
                        <div class="alert-settings">
                            <input type="number" 
                                   id="alertPriceAbove" 
                                   placeholder="Alert if above $"
                                   step="0.0001">
                            <input type="number" 
                                   id="alertPriceBelow" 
                                   placeholder="Alert if below $"
                                   step="0.0001">
                            <input type="number" 
                                   id="alertPercentChange" 
                                   placeholder="Alert on % change"
                                   value="5"
                                   step="0.1">
                        </div>
                        
                        <button onclick="window.watchlistManager.addFromInput()" class="add-btn">
                            + Add to Watchlist
                        </button>
                    </div>
                    
                    <div class="watchlist-items" id="watchlistItems">
                        <!-- Items will be added here -->
                    </div>
                    
                    <div class="watchlist-footer">
                        <small>Checks every 5 minutes</small>
                        <small id="watchlistStatus">Active</small>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', watchlistHTML);
        
        // Add CSS if not already present
        if (!document.getElementById('watchlistStyles')) {
            const styles = document.createElement('style');
            styles.id = 'watchlistStyles';
            styles.textContent = this.getWatchlistCSS();
            document.head.appendChild(styles);
        }
    }
    
    // ============ UPDATE DISPLAY ============
    updateWatchlistDisplay() {
        const itemsDiv = document.getElementById('watchlistItems');
        const headerCount = document.querySelector('.watchlist-header h3');
        
        if (!itemsDiv) return;
        
        if (this.watchlist.length === 0) {
            itemsDiv.innerHTML = '<p class="empty-watchlist">No items in watchlist</p>';
        } else {
            itemsDiv.innerHTML = this.watchlist.map(item => this.renderWatchlistItem(item)).join('');
        }
        
        // Update count
        if (headerCount) {
            headerCount.textContent = `👁️ Watchlist (${this.watchlist.length})`;
        }
    }
    
    updateWatchlistItemDisplay(item) {
        const itemElement = document.querySelector(`[data-symbol="${item.symbol}"]`);
        if (itemElement) {
            itemElement.outerHTML = this.renderWatchlistItem(item);
        }
    }
    
    renderWatchlistItem(item) {
        const timeSinceCheck = item.lastCheck ? 
            Math.round((Date.now() - item.lastCheck) / 60000) : null;
        
        return `
            <div class="watchlist-item" data-symbol="${item.symbol}">
                <div class="watchlist-item-header">
                    <span class="watchlist-symbol">${item.symbol}</span>
                    <button onclick="window.watchlistManager.removeFromWatchlist('${item.symbol}')" 
                            class="remove-btn" title="Remove from watchlist">×</button>
                </div>
                
                <div class="watchlist-item-data">
                    ${item.lastPrice ? `
                        <div class="data-row">
                            <span>Price:</span>
                            <span class="price">$${item.lastPrice.toFixed(4)}</span>
                        </div>
                    ` : ''}
                    
                    ${item.lastSignal ? `
                        <div class="data-row">
                            <span>Signal:</span>
                            <span class="signal signal-${item.lastSignal.toLowerCase()}">${item.lastSignal}</span>
                        </div>
                    ` : ''}
                    
                    ${item.lastFunding !== null ? `
                        <div class="data-row">
                            <span>Funding:</span>
                            <span class="funding ${item.lastFunding > 0 ? 'positive' : 'negative'}">
                                ${(item.lastFunding * 100).toFixed(4)}%
                            </span>
                        </div>
                    ` : ''}
                    
                    <div class="data-row meta">
                        <span>Checks: ${item.checkCount}</span>
                        <span>Alerts: ${item.alertCount}</span>
                    </div>
                    
                    ${timeSinceCheck !== null ? `
                        <div class="data-row meta">
                            <small>Last check: ${timeSinceCheck}m ago</small>
                        </div>
                    ` : ''}
                </div>
                
                <div class="watchlist-item-actions">
                    <button onclick="window.quickAnalysis('${item.symbol}')" class="analyze-btn">
                        📊 Analyze
                    </button>
                    <button onclick="window.watchlistManager.editAlerts('${item.symbol}')" class="edit-btn">
                        ⚙️ Alerts
                    </button>
                </div>
            </div>
        `;
    }
    
    // ============ UI HELPERS ============
    addFromInput() {
        const symbolInput = document.getElementById('watchlistSymbolInput');
        const priceAbove = document.getElementById('alertPriceAbove');
        const priceBelow = document.getElementById('alertPriceBelow');
        const percentChange = document.getElementById('alertPercentChange');
        
        const symbol = symbolInput.value.trim();
        if (!symbol) {
            alert('Please enter a symbol');
            return;
        }
        
        const alerts = {
            priceAbove: priceAbove.value ? parseFloat(priceAbove.value) : null,
            priceBelow: priceBelow.value ? parseFloat(priceBelow.value) : null,
            percentChange: percentChange.value ? parseFloat(percentChange.value) : 5
        };
        
        const item = this.addToWatchlist(symbol, alerts);
        
        if (item) {
            // Clear inputs
            symbolInput.value = '';
            priceAbove.value = '';
            priceBelow.value = '';
            percentChange.value = '5';
        }
    }
    
    togglePanel() {
        const panel = document.getElementById('watchlistPanel');
        if (panel) {
            panel.classList.toggle('collapsed');
        }
    }
    
    showSettings() {
        alert(`Watchlist Settings
        
• Check Interval: ${this.checkInterval / 60000} minutes
• Total Symbols: ${this.watchlist.length}
• Active Monitors: ${this.intervals.size}
• Notifications: ${Notification.permission}

To change settings, use the browser console:
watchlistManager.checkInterval = 600000; // 10 minutes`);
    }
    
    editAlerts(symbol) {
        const item = this.watchlist.find(i => i.symbol === symbol);
        if (!item) return;
        
        const newPriceAbove = prompt('Alert if price goes above:', item.alerts.priceAbove || '');
        const newPriceBelow = prompt('Alert if price goes below:', item.alerts.priceBelow || '');
        const newPercentChange = prompt('Alert on % change:', item.alerts.percentChange || '5');
        
        if (newPriceAbove !== null) item.alerts.priceAbove = newPriceAbove ? parseFloat(newPriceAbove) : null;
        if (newPriceBelow !== null) item.alerts.priceBelow = newPriceBelow ? parseFloat(newPriceBelow) : null;
        if (newPercentChange !== null) item.alerts.percentChange = newPercentChange ? parseFloat(newPercentChange) : 5;
        
        this.saveWatchlist();
        this.updateWatchlistDisplay();
    }
    
    // ============ CSS STYLES ============
    getWatchlistCSS() {
        return `
            .watchlist-panel {
                position: fixed;
                right: 20px;
                top: 100px;
                width: 320px;
                max-height: 70vh;
                background: rgba(26, 26, 46, 0.98);
                border: 2px solid #667eea;
                border-radius: 12px;
                padding: 0;
                z-index: 1000;
                transition: transform 0.3s ease;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            }
            
            .watchlist-panel.collapsed {
                transform: translateX(340px);
            }
            
            .watchlist-header {
                background: linear-gradient(135deg, #667eea, #764ba2);
                padding: 15px;
                border-radius: 10px 10px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .watchlist-header h3 {
                margin: 0;
                color: white;
                font-size: 16px;
            }
            
            .watchlist-controls {
                display: flex;
                gap: 10px;
            }
            
            .watchlist-controls button {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .watchlist-controls button:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .watchlist-content {
                padding: 15px;
                max-height: 500px;
                overflow-y: auto;
            }
            
            .add-to-watchlist {
                margin-bottom: 20px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .add-to-watchlist input {
                width: 100%;
                padding: 10px;
                margin-bottom: 10px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                color: white;
            }
            
            .alert-settings {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 5px;
                margin-bottom: 10px;
            }
            
            .alert-settings input {
                margin-bottom: 0;
                font-size: 12px;
                padding: 8px;
            }
            
            .add-btn {
                width: 100%;
                padding: 10px;
                background: linear-gradient(135deg, #00ff88, #00a2ff);
                border: none;
                border-radius: 6px;
                color: #1a1a2e;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
            }
            
            .add-btn:hover {
                transform: scale(1.02);
            }
            
            .watchlist-item {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 10px;
            }
            
            .watchlist-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .watchlist-symbol {
                font-weight: 600;
                color: #667eea;
                font-size: 14px;
            }
            
            .remove-btn {
                background: rgba(255, 0, 0, 0.2);
                border: none;
                color: #ff4444;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 18px;
                line-height: 1;
            }
            
            .watchlist-item-data {
                margin-bottom: 10px;
            }
            
            .data-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 5px;
                font-size: 13px;
                color: rgba(255, 255, 255, 0.8);
            }
            
            .data-row.meta {
                color: rgba(255, 255, 255, 0.5);
                font-size: 11px;
            }
            
            .price {
                color: #00ff88;
                font-weight: 500;
            }
            
            .signal {
                font-weight: 500;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
            }
            
            .signal-long {
                background: rgba(0, 255, 136, 0.2);
                color: #00ff88;
            }
            
            .signal-short {
                background: rgba(255, 68, 68, 0.2);
                color: #ff4444;
            }
            
            .signal-wait {
                background: rgba(255, 193, 7, 0.2);
                color: #ffc107;
            }
            
            .funding.positive {
                color: #00ff88;
            }
            
            .funding.negative {
                color: #ff4444;
            }
            
            .watchlist-item-actions {
                display: flex;
                gap: 5px;
            }
            
            .watchlist-item-actions button {
                flex: 1;
                padding: 6px;
                background: rgba(102, 126, 234, 0.2);
                border: 1px solid rgba(102, 126, 234, 0.3);
                border-radius: 4px;
                color: #667eea;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .watchlist-item-actions button:hover {
                background: rgba(102, 126, 234, 0.3);
            }
            
            .watchlist-footer {
                display: flex;
                justify-content: space-between;
                padding-top: 10px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                font-size: 11px;
                color: rgba(255, 255, 255, 0.5);
            }
            
            .empty-watchlist {
                text-align: center;
                color: rgba(255, 255, 255, 0.5);
                padding: 20px;
            }
            
            /* Alert Container */
            .alert-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 400px;
            }
            
            .watchlist-alert {
                background: linear-gradient(135deg, #1a1a2e, #2a2a3e);
                border-left: 4px solid #667eea;
                border-radius: 8px;
                padding: 15px;
                color: white;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                animation: slideIn 0.3s ease;
            }
            
            .watchlist-alert.severity-high {
                border-left-color: #ff4444;
                background: linear-gradient(135deg, #2a1a1e, #3a2a2e);
            }
            
            .watchlist-alert.severity-medium {
                border-left-color: #ffc107;
            }
            
            .watchlist-alert.severity-low {
                border-left-color: #00ff88;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
            
            .alert-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.7);
            }
            
            .alert-message {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 5px;
            }
            
            .alert-price {
                color: #00ff88;
                font-size: 16px;
                font-weight: 500;
                margin-bottom: 10px;
            }
            
            .alert-recommendation {
                display: flex;
                gap: 15px;
                padding: 8px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
                margin-bottom: 10px;
                font-size: 12px;
            }
            
            .alert-actions {
                display: flex;
                gap: 10px;
            }
            
            .alert-action-btn {
                flex: 1;
                padding: 8px;
                border: none;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: transform 0.2s;
            }
            
            .alert-action-btn.primary {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
            }
            
            .alert-action-btn.secondary {
                background: rgba(255, 255, 255, 0.1);
                color: rgba(255, 255, 255, 0.7);
            }
            
            .alert-action-btn:hover {
                transform: scale(1.02);
            }
        `;
    }
}

// ============ INITIALIZE WATCHLIST MANAGER ============
document.addEventListener('DOMContentLoaded', function() {
    window.watchlistManager = new WatchlistManager();
    console.log('✅ Watchlist Manager initialized!');
    console.log('📊 Usage: watchlistManager.addToWatchlist("BTC/USDT")');
});