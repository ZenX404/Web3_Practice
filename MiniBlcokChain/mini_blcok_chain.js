const crypto = require('crypto');

class Transaction {
    constructor(fromAddress, toAddress, amount) {
        this.timestamp = Date.now();
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
    }
}


class Block {
    constructor(transactions, previousHash) {
        this.timestamp = Date.now();
        this.transactions = transactions;
        this.hash = this.calculateHash();
        this.previousHash = previousHash;
        this.nonce = 0;
    } 

    calculateHash() {
        return crypto
            .createHash('sha256')
            .update(this.timestamp + JSON.stringify(this.transactions) + this.previousHash + this.nonce)
            .digest('hex'); // 转换为十六进制
    }

    mineBlock(difficulty) {
        // 生成字符串"0000"的巧妙写法，利用往空数组间隙插入字符'0'来实现
        const target = Array(difficulty + 1).join('0');

        console.log("开始挖矿....");

        while (this.hash.substring(0, difficulty) !== target) {
            this.nonce++;
            this.hash = this.calculateHash();
        }

        console.log("区块已挖出! 哈希值: " + this.hash);
    }
}


class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.miningReward = 100;
        this.pendingTransactions = [];
        this.difficulty = 4;

    }

    createGenesisBlock() {
        return new Block([], 0);
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    createTransaction(transaction) {
        this.pendingTransactions.push(transaction);
    }

    minePendingTransactions(miningRewardAddress) {
        let block = new Block(this.pendingTransactions, this.getLatestBlock().hash);

        block.mineBlock(this.difficulty);

        this.chain.push(block);

        this.pendingTransactions = [new Transaction(0, miningRewardAddress, this.miningReward)];
    }

    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }
        }
        return true;
    }
}


function runDemo() {
    // 创建区块链
    const myChain = new Blockchain();

    // 模拟添加交易
    myChain.createTransaction(new Transaction('address1', 'address2', 100));
    myChain.createTransaction(new Transaction('address2', 'address3', 100));
    myChain.createTransaction(new Transaction('address3', 'address1', 100));

    // 挖矿
    myChain.minePendingTransactions('address66');
    
    console.log(myChain.isChainValid());
    console.log(myChain.chain);

}

runDemo();

module.exports = {Blockchain, Transaction, Block};