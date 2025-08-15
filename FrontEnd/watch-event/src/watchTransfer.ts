// 这是一个使用 Viem.js 库监听以太坊智能合约事件的 TypeScript 程序
// 主要功能：实时监听 TokenBank 合约的取款事件

// ===== 导入依赖模块 =====
import {
    createPublicClient,      // 创建只读的以太坊客户端，用于读取区块链数据
    formatEther,            // 将 Wei 单位转换为 ETH 单位的工具函数（1 ETH = 10^18 Wei）
    http,                   // HTTP 传输协议，用于连接以太坊节点
    publicActions,          // 公共客户端的扩展功能，提供更多读取操作
    type Log,               // TypeScript 类型定义，表示区块链日志/事件的数据结构
} from "viem";              // Viem 是现代的以太坊 JavaScript 库，类似于 ethers.js

// 用于加载 .env 环境变量文件的库
import dotenv from 'dotenv';
// 导入Sepolia测试网
import {sepolia} from 'viem/chains';
// 导入TokenBank合约的ABI
import TokenBank_ABI from './abis/TokenBank.json' with { type: 'json' };

// ===== 环境变量配置 =====
// 加载 .env 文件中的环境变量到 process.env 中
dotenv.config();

// 导入TokenBank合约地址
const TOKEN_BANK_ADDRESS = process.env.TOKEN_BANK_ADDRESS;



// ===== 主函数定义 =====
// 使用 async 关键字定义异步函数，因为区块链操作都是异步的
const main = async () => {
    // ===== 创建区块链客户端 =====
    // 创建一个公共客户端用于读取区块链数据
    const publicClient = createPublicClient({
        chain: sepolia, // 指定连接的区块链网络
        transport: http(process.env.RPC_URL!), // 设置连接方式为 HTTP，使用环境变量中的 RPC URL
    // 扩展客户端功能，添加更多的读取操作方法     // ! 符号告诉 TypeScript 这个变量一定存在，不会是 undefined
    }).extend(publicActions);                  

    // 在控制台输出启动信息
    console.log('开始监听TokenBank取款事件');

    // ===== 事件监听核心逻辑 =====
    // 使用 watchEvent 方法监听 TokenBank 合约的取款事件
    // watchEvent 返回一个取消监听的函数，保存到 unwatch 变量中
    const unwatch = publicClient.watchEvent({
        // 指定要监听的合约地址
        address: TOKEN_BANK_ADDRESS as `0x${string}`,

        // ===== 事件定义 =====
        // 定义要监听的事件结构，必须与智能合约中定义的事件完全匹配
        event: {
            type: 'event',
            name: 'Withdraw',
            inputs: [
                {
                    type: 'address', // 参数类型：以太坊地址
                    name: 'user', // 参数名称：取款方
                    indexed: true, // indexed: true 表示这个参数可以被索引，方便搜索和过滤
                },
                {
                    type: 'uint256',
                    name: 'amount',  // 取款金额
                }
            ]
        },
        
        // ===== 事件回调处理函数 =====
        // 当监听到匹配的事件时，会调用这个回调函数
        // logs 是一个数组，包含所有检测到的事件日志
        onLogs: (logs) => {
            // 遍历所有检测到的事件日志
            logs.forEach((log) => {
                // 检查取款金额是否存在（防止数据异常）
                if (log.args.amount !== undefined) {
                    console.log('\n检测到新的取款事件:');
                    console.log(`用户: ${log.args.user}`);
                    console.log(`金额: ${formatEther(log.args.amount)}`);
                    console.log(`交易哈希: ${log.transactionHash}`);
                    console.log(`区块号: ${log.blockNumber}`);
                }
            })
        }
    });

    // ===== 程序生命周期管理 =====
    // 监听 SIGINT 信号（当用户按 Ctrl+C 时触发）
    process.on('SIGINT', () => {
        console.log('\n停止监听...');
        // 调用取消监听函数，清理资源
        unwatch();      
        // 退出程序     
        process.exit();      
    });
};

// ===== 程序入口和错误处理 =====
// 调用主函数并处理可能的错误
main().catch((error) => {
    // 如果程序运行过程中出现错误，打印错误信息
    console.error('发生错误:', error);
     // 以错误状态码 1 退出程序
    process.exit(1); 
})