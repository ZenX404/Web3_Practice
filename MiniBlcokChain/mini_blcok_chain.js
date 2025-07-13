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
        this.nodes = new Set();
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

    // 验证区块链的完整性
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

    // 计算指定地址的余额
    getBalanceOfAddress(address) {
        let balance = 0;

        for (const block of this.chain) {
            for (const trans of block.transactions) {
                if (trans.fromAddress === address) {
                    balance -= trans.amount;
                }

                if (trans.toAddress === address) {
                    balance += trans.amount;
                }
            }
        }

        return balance;
    }

    addNode(nodeUrl) {
        this.nodes.add(nodeUrl);
        console.log("节点已添加: " + nodeUrl);
    }

    // 广播新区块到所有节点
    broadcastNewBlock(newBlock) {
        console.log("广播新区块到所有节点");
        this.nodes.forEach(node => {
            console.log(`发送区块到节点: ${node}`);
        })
    }

    // 接收新区块
    receiveNewBlock(newBlock, senderNodeUrl) {
        const lastBlock = this.getLatestBlock();
        if (newBlock.previousHash !== lastBlock.hash) {
            return false;
        }

        if (newBlock.hash.substring(0, this.difficulty) !== Array(this.difficulty + 1).join('0')) {
            return false;
        }

        this.chain.push(newBlock);
        console.log(`接收来自 ${senderNodeUrl} 的节点`);

        // 更新待处理交易
        this.pendingTransactions = this.pendingTransactions.filter(t => 
            !newBlock.transactions.some(nbt => 
                t.fromAddress === nbt.fromAddress
                && t.toAddress === nbt.toAddress
                && t.amount === nbt.amount
                && t.timestamp === nbt.timestamp
            )
        );

        return true;
    }

    // 解决链冲突 - 共识算法
    resolveConflicts(chains) {
        let maxLength = this.chain.length;
        let maxChain = null;

        for (const chain of chains) {
            if (chain.length > maxLength && this.isValidChain(chain)) {
                maxLength = chain.length;
                maxChain = chain;
            }
        }

        if (maxChain) {
            this.chain = maxChain;
            return true;
        }

        console.log("已经是最长有效链了");
        return false;
    }

    // 验证提供的链是否有效
    isValidChain(chain) {
        if (JSON.stringify(this.createGenesisBlock()) !== JSON.stringify(chain.chains[0])) {
            return false;
        }

        for (let i = 1; i < chain.length; i++) {
            const currentBlock = chain[i];
            const previousBlock = chain[i - 1];

            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }

            if (currentBlock.hash !== currentBlock.calculateHash()) {
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
    myChain.createTransaction(new Transaction('address3', 'address1', 200));

    // 挖矿
    myChain.minePendingTransactions('address66');

    console.log("address3的余额: " + myChain.getBalanceOfAddress('address3'));
    console.log("address66的余额: " + myChain.getBalanceOfAddress('address66'));
    
    console.log("验证区块链完整性: " + myChain.isChainValid());
    console.log("区块链: " + myChain.chain);


    // 模拟添加交易
    myChain.createTransaction(new Transaction('address1', 'address2', 100));
    myChain.createTransaction(new Transaction('address2', 'address3', 100));
    myChain.createTransaction(new Transaction('address3', 'address1', 200));

    // 挖矿
    myChain.minePendingTransactions('address55');
    console.log("address66的余额: " + myChain.getBalanceOfAddress('address66'));
    
}

runDemo();

module.exports = {Blockchain, Transaction, Block};