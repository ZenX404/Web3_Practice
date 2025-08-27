import { createWalletClient, http, parseEther, parseGwei, type Hash, type TransactionReceipt } from 'viem'
import { prepareTransactionRequest } from 'viem/actions'
import { foundry } from 'viem/chains'
import { createPublicClient, type PublicClient, type WalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'
import { Wallet } from '@ethersproject/wallet'

dotenv.config();

/**
 * : Promise<Hash>
 *  这是 TypeScript 的类型注解，指定函数的返回类型：
      Promise：表示这个函数返回一个 Promise 对象
      <Hash>：这是泛型语法，表示 Promise 最终解析出的值的类型是 Hash
      Hash：这是从 viem 库导入的类型，表示以太坊交易哈希

    Promise 是什么？
      Promise 是JavaScript中处理异步操作的一种机制，可以理解为一个"承诺"或"约定"。
      Promise就是JavaScript处理"需要等待的操作"的标准方式，让你可以在不阻塞程序的情况下处理异步任务，比如网络请求、文件读写、数据库操作等。
 */
async function sendTransactionWithKeystore(): Promise<Hash> {
    try {
        /**
         * 概念解释
             1、keystorePassword (Keystore 密码)
                是什么：这是一个你自己设定的密码。它不是自动生成的。
                作用：用来加密和解密你的私钥。我们的私钥是需要加密后，被存在Keystore文件中的，私钥不能明文存储，而是用你设定的这个密码加密过的。这样即使别人拿到了你的 Keystore 文件，没有密码也无法获取你的私钥。
                总结：密码是你自己想的，然后告诉工具用这个密码去加密。
            2、keystorePath (Keystore 文件路径)
                是什么：这是一个指向 Keystore 文件的路径。Keystore 文件是一个 JSON 格式的文件，里面包含了用你的 keystorePassword 加密后的私钥以及一些其他元数据。
                作用：你的程序通过读取这个文件，并结合你提供的密码，才能在内存中解密出真正的私钥来进行交易签名。
                总结：Keystore 文件是工具根据你的私钥和密码生成的。

            Keystore文件可以使用 Foundry 自带的工具 cast来生成。 
            整个流程如下：
                私钥 + 你设定的密码 => (通过cast工具) => 生成

            步骤 1: 获取一个私钥
                为了生成 Keystore，我们首先需要一个私钥。最简单的方法就是从 anvil 本地网络获取一个。
                打开终端，运行 anvil 启动本地网络。
                复制一个它提供给你的私钥 (Private Key)。  
            
            步骤 2: 设定你的密码
                想一个你自己的密码，例如 mysecretpassword123。这个就是你需要在 .env 文件中设置的 KEYSTORE_PASSWORD 的值。

            步骤 3: 使用 cast 生成 Keystore 文件
                现在，我们有了私钥和密码，可以使用 cast 命令来生成 Keystore 文件了。
                再打开一个新终端 (保持 anvil 运行)。
                进入你的项目根目录 D:\workspace\Web3_Practice。
                执行以下命令：
                    # 注意：命令中没有 --password
                    cast wallet import <可以自己随便为keystore文件起名字> --private-key <私钥>
                    执行上述命令后，终端会提示你输入密码：
                    Enter password: 
                输入完密码后，Foundry就会生成对应的Keystore文件，

                cast 会在 Foundry 的默认数据目录里生成这个 Keystore 文件。在 Windows 上，这个路径通常是：
                C:\Users\你的用户名\.foundry\keystores\
        */
        // 1. 从环境变量获取 keystore 文件路径和密码
        const keystorePath = process.env.KEYSTORE_PATH;
        const keystorePassword = process.env.KEYSTORE_PASSWORD;

        if (!keystorePath || !keystorePassword) {
            throw new Error('请在 .env 文件中设置 KEYSTORE_PATH 和 KEYSTORE_PASSWORD')
        }

        // 2. 读取 keystore 文件
        const keystoreContent = readFileSync(join(process.cwd(), keystorePath), 'utf-8')
        const keystore = JSON.parse(keystoreContent)

        // 3. 使用 ethers.js 的 Wallet 来解密 keystore
        const wallet = await Wallet.fromEncryptedJson(keystoreContent, keystorePassword);
        // 根据keystorePassword解密keystore，进而得到账户的私钥
        const privateKey = wallet.privateKey as `0x${string}`;

        // 4. 从私钥创建账户
        const account = privateKeyToAccount(privateKey);
        const userAddress = account.address;
        console.log('账户地址:', userAddress);
        
        /**
         * : PublicClient
                语法: 这是一个 TypeScript 的类型注解。冒号 : 后面跟着的是这个变量的类型。
                PublicClient: 这是从 viem 库中导入的一个类型定义。
                含义: 这行代码像是在对程序做一个“承诺”：“我保证 publicClient 这个变量里存放的一定是符合 PublicClient 类型规范的对象”。
                好处:
                代码提示: 当你在编辑器里输入 publicClient. 时，编辑器会自动弹出所有 PublicClient 对象可用的方法（如 getBlockNumber(), getBalance() 等）。
                类型安全: 如果你试图把一个不符合 PublicClient 类型的对象（比如一个数字或字符串）赋值给它，TypeScript 在编译时就会报错，提前发现潜在的 bug。
         */
        // 5. 创建公共客户端
        const publicClient: PublicClient = createPublicClient({
            chain: foundry,
            transport: http(process.env.RPC_URL)
        });

        // 6. 创建钱包客户端
        const walletClient: WalletClient = createWalletClient({
            chain: foundry,
            transport: http(process.env.RPC_URL)
        });

        // 7. 检查网络状态
        const blockNumber = await publicClient.getBlockNumber();
        console.log('当前区块号:', blockNumber);

        // 8. 获取当前 gas 价格
        const gasPrice = await publicClient.getGasPrice();
        console.log('当前 gas 价格:', parseGwei(gasPrice.toString()));

        // 9. 查询余额
        const balance = await publicClient.getBalance({
            address: userAddress
        });
        console.log('账户余额:', parseEther(balance.toString()));

        /**
         * Nonce，全称是 "Number used once" (只使用一次的数字)，它本质上是一个与你的以太坊账户关联的交易计数器。
            对于一个全新的账户，它的初始 Nonce 是 0。
            每当你从这个账户成功发送一笔交易（并且这笔交易被打包进区块确认），这个账户的 Nonce 就会自动加 1。
            如果你已经发送了 5 笔交易（Nonce 分别是 0, 1, 2, 3, 4），那么你账户在链上的 Nonce 就是 5。这意味着你下一笔要发送的交易，其 Nonce 必须是 5。
         
            nonce主要是为了避免重放攻击，
            一个黑客看到了一笔交易的签名数据。如果没有 Nonce，这笔交易数据是“静态”的。
            黑客就可以把这笔已完成的交易数据原封不动地再广播一次。
         */
        // 10. 查询 nonce
        const nonce = await publicClient.getTransactionCount({
            address: userAddress
        });
        console.log('当前 Nonce:', nonce);
        
        // 11. 构建交易参数
        const txParams = {
            account: account,
            to: '0x01BF49D75f2b73A2FDEFa7664AEF22C86c5Be3df' as `0x${string}`,
            value: parseEther('0.001'), // 发送金额（ETH）
            chainId: foundry.id,
            type: 'eip1559' as const,
            chain: foundry,

            maxFeePerGas: gasPrice * 2n,
            maxPriorityFeePerGas: parseGwei('1.5'),
            gas: 21000n,
            nonce: nonce
        };

        // 12. 准备交易
        const preparedTx = await prepareTransactionRequest(publicClient, txParams)
        console.log('准备后的交易参数:', {
            /**
             * ...preparedTx —— 展开语法 (Spread Syntax)
                ... 是什么？
                    这三个点是 JavaScript (ES6+) 的展开语法。当它用在对象字面量 {} 中时，它的作用就像是“解包”或者“摊开”一个对象。
                它做了什么？
                    它会把 preparedTx 对象里所有的属性（键和值）都取出来，然后一个个地复制到这个正在创建的新对象里。
                举个例子：
                假设 preparedTx 对象是这样的：
                    const preparedTx = {
                        to: '0x...',
                        value: 1000000000000000n, // 这是一个 bigint
                        nonce: 5,
                        maxFeePerGas: 20000000000n, // 也是 bigint
                        maxPriorityFeePerGas: 1500000000n // 也是 bigint
                    };
                那么，{ ...preparedTx } 就等同于：
                    {
                        to: '0x...',
                        value: 1000000000000000n,
                        nonce: 5,
                        maxFeePerGas: 20000000000n,
                        maxPriorityFeePerGas: 1500000000n
                    }
                它创建了一个 preparedTx 的浅拷贝。
             */
            ...preparedTx,
            maxFeePerGas: parseGwei(preparedTx.maxFeePerGas.toString()),
            maxPriorityFeePerGas: parseGwei(preparedTx.maxPriorityFeePerGas.toString()),
        });

        

        // 13. 签名交易
        const signedTx = await walletClient.signTransaction(preparedTx);
        console.log('Signed Transaction:', signedTx);

        // 14. 发送交易
        const txHash = await publicClient.sendRawTransaction({
            serializedTransaction: signedTx
        })
        console.log('Transaction Hash:', txHash);

        // 15. 等待交易确认
        const receipt: TransactionReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
        console.log('交易状态:', receipt.status === 'success' ? '成功' : '失败')
        console.log('区块号:', receipt.blockNumber)
        console.log('Gas 使用量:', receipt.gasUsed.toString())

        return txHash;

        
    } catch (error) {
        console.error('错误:', error)
        if (error instanceof Error) {
          console.error('错误信息:', error.message)
        }
        if (error && typeof error === 'object' && 'details' in error) {
          console.error('错误详情:', error.details)
        }
        throw error
    }
}


// 执行示例
sendTransactionWithKeystore() 