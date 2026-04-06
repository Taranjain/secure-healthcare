/**
 * Server Entry Point
 * Starts the Express server and initializes the blockchain.
 */

const app = require('./app');
const config = require('./config');
const blockchainService = require('./services/blockchainService');

async function start() {
    try {
        // Initialize blockchain genesis block
        await blockchainService.initializeChain();

        app.listen(config.port, '0.0.0.0', () => {
            console.log(`
╔═══════════════════════════════════════════════════════╗
║   🏥 Healthcare Data Sharing Platform                 ║
║   🔒 Secure · Encrypted · Audited                    ║
║                                                       ║
║   Server:  http://localhost:${config.port}                  ║
║   Docs:    http://localhost:${config.port}/api-docs            ║
║   Env:     ${config.env}                              ║
╚═══════════════════════════════════════════════════════╝
      `);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
