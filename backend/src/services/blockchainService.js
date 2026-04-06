/**
 * Simple Blockchain Service
 * 
 * Implements a tamper-proof audit trail using a SHA-256 hash chain.
 * Each block contains audit data and the hash of the previous block.
 * Any modification to a past block breaks the chain, detectable via verification.
 */

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Calculate SHA-256 hash of a block
 * @param {Object} block - Block data
 * @returns {string} Hex hash
 */
function calculateHash(block) {
    const record = `${block.index}${block.previousHash}${JSON.stringify(block.data)}${block.timestamp}${block.nonce}`;
    return crypto.createHash('sha256').update(record).digest('hex');
}

/**
 * Get the latest block in the chain
 * @returns {Object|null} Latest block
 */
async function getLatestBlock() {
    const block = await prisma.blockchainBlock.findFirst({
        orderBy: { index: 'desc' },
    });
    return block;
}

/**
 * Create the genesis block if it doesn't exist
 */
async function initializeChain() {
    const latest = await getLatestBlock();
    if (latest) return latest;

    const genesisData = {
        index: 0,
        previousHash: '0'.repeat(64),
        data: { message: 'Genesis Block - Healthcare Audit Chain Initialized' },
        timestamp: BigInt(Date.now()),
        nonce: 0,
    };

    const hash = calculateHash({
        ...genesisData,
        timestamp: genesisData.timestamp.toString(),
    });

    const genesis = await prisma.blockchainBlock.create({
        data: { ...genesisData, hash },
    });

    console.log('🔗 Blockchain genesis block created');
    return genesis;
}

/**
 * Add a new block to the chain with audit data
 * @param {Object} data - Audit data to store
 * @returns {Object} Created block
 */
async function addBlock(data) {
    let latest = await getLatestBlock();
    if (!latest) {
        latest = await initializeChain();
    }

    const newBlock = {
        index: latest.index + 1,
        previousHash: latest.hash,
        data,
        timestamp: BigInt(Date.now()),
        nonce: 0,
    };

    const hash = calculateHash({
        ...newBlock,
        timestamp: newBlock.timestamp.toString(),
    });

    const created = await prisma.blockchainBlock.create({
        data: { ...newBlock, hash },
    });

    return created;
}

/**
 * Verify the entire blockchain integrity
 * @returns {{ valid: boolean, invalidAt?: number, details: string }}
 */
async function verifyChain() {
    const blocks = await prisma.blockchainBlock.findMany({
        orderBy: { index: 'asc' },
    });

    if (blocks.length === 0) {
        return { valid: true, details: 'Chain is empty' };
    }

    // Verify genesis block
    const genesisHash = calculateHash({
        ...blocks[0],
        timestamp: blocks[0].timestamp.toString(),
    });
    if (blocks[0].hash !== genesisHash) {
        return { valid: false, invalidAt: 0, details: 'Genesis block has been tampered with' };
    }

    // Verify each subsequent block
    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const prevBlock = blocks[i - 1];

        // Check previous hash link
        if (block.previousHash !== prevBlock.hash) {
            return {
                valid: false,
                invalidAt: block.index,
                details: `Block ${block.index} previous hash doesn't match block ${prevBlock.index} hash`,
            };
        }

        // Recalculate and verify hash
        const recalculatedHash = calculateHash({
            ...block,
            timestamp: block.timestamp.toString(),
        });
        if (block.hash !== recalculatedHash) {
            return {
                valid: false,
                invalidAt: block.index,
                details: `Block ${block.index} hash has been tampered with`,
            };
        }
    }

    return { valid: true, details: `Chain verified: ${blocks.length} blocks intact` };
}

/**
 * Get all blocks in the chain
 * @param {number} limit - Max blocks to return
 * @returns {Array} Blocks
 */
async function getChain(limit = 50) {
    return prisma.blockchainBlock.findMany({
        orderBy: { index: 'desc' },
        take: limit,
    });
}

module.exports = {
    initializeChain,
    addBlock,
    verifyChain,
    getChain,
    calculateHash,
};
