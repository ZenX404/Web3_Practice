// 'use client' 指令告诉Next.js这是一个客户端组件
// 在Next.js 13+的app目录中，组件默认在服务器端渲染
// 添加这个指令后，组件会在浏览器中运行，可以使用浏览器APIs和状态管理
'use client';

// 从React库导入必要的Hook
// useState: 用于管理组件的状态(数据)
// useEffect: 用于处理副作用(如API调用、事件监听等)
import { useState, useEffect } from 'react';

// 从viem库导入Web3相关的函数
// viem是一个现代的以太坊JavaScript库，用于与区块链交互
import { createPublicClient, createWalletClient, http, formatEther, getContract, custom, parseEther } from 'viem';

// 导入Sepolia测试网的配置
// sepolia是以太坊的测试网络，用于开发和测试
import { sepolia } from 'viem/chains';

// 导入TokenBank合约的ABI(应用程序二进制接口)
// ABI定义了如何与智能合约交互，用于实现前端调用智能合约函数
import TokenBank_ABI from './contracts/TokenBank.json';

// 定义TokenBank合约的地址(这是一个常量)
const TOKEN_BANK_ADDRESS = "0xDe74ba2a8BCfb0da3a36f6BffbdE9f98ef4f3B84";


// 导出默认函数组件Home，React的组件本质上就是函数
// export default 表示这是模块的默认导出
// 函数组件是React中定义UI的方式
export default function Home() {
  // useState Hook用于创建状态变量及修改状态变量的函数
  // 语法: const [变量名, 修改变量值的函数] = useState(初始值)

  // 存储用户的ETH余额  并且通过setBalance修改balance变量值。balance默认值为0
  const [balance, setBalance] = useState<String>('0');

  // 存储用户的Token余额
  const [tokenBalance, setTokenBalance] = useState<string>('0');

  // 存储用户在TokenBank中的存款余额
  const [depositBalance, setDepositBalance] = useState<string>('0');

  // 存储用户输入的存款金额
  const [depositAmount, setDepositAmount] = useState<string>('');
  
  // 存储用户输入的取款金额
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  
  // 存储用户的钱包地址
  // `0x${string}` | undefined 表示这个变量可能是以0x开头的字符串，也可能是undefined
  const [address, setAddress] = useState<`0x${string}` | undefined>();
  
  // 存储钱包是否已连接的状态
  const [isConnected, setIsConnected] = useState(false);
  
  // 存储当前网络的链ID
  const [chainId, setChainId] = useState<number | undefined>();
  
  // 存储是否正在加载的状态(用于显示加载动画)
  const [isLoading, setIsLoading] = useState(false);
  
  // 存储交易哈希
  const [txHash, setTxHash] = useState<string>('');
  
  // 存储错误信息
  const [error, setError] = useState<string>('');

  // createPublicClient是viem提供的组件，用来创建连接区块链网络的客户端，实现与区块链的交互
  const publicClient = createPublicClient({
    chain: sepolia, // 指定使用Sepolia测试网
    transport: http('https://sepolia.infura.io/v3/fb22f989d7e14bce8b720ab082a8a0fe')  // RPC端点(需要用viem提供的http函数转换一下)  用来与区块链交互
  });

  // 计算是否在正确的网络上
  // 这是一个计算属性，每次chainId变化时都会重新计算
  const isCorrectNetwork = chainId === sepolia.id;

  // 清除错误信息的函数
  // 箭头函数语法: const 函数名 = (函数入参) => 函数体
  const clearError = () => setError('');

  
  // 连接钱包的异步函数
  // async/await 用于处理异步操作
  const connectWallet = async () => {
    // 清除之前的错误
    setError('');

    // 检查是否在浏览器环境中运行
    // typeof window === 'undefined' 表示不在浏览器中(可能在服务器端)
    if (typeof(window) === 'undefined') {
      setError('请在浏览器中运行此应用');
      return;  // 提前退出函数
    }

    // 检查是否安装了MetaMask钱包
    // window.ethereum 是MetaMask注入到浏览器的对象
    if (typeof(window.ethereum) === 'undefined') {
      setError('请安装 MetaMask 钱包');
      return;
    }

    try {
      setIsLoading(true);  // 开始加载状态
      
      // 请求用户授权访问钱包账户
      // await 等待异步操作完成，代码执行会停在这里等待响应数据
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts' // MetaMask申请访问钱包的标准方法
      });

      // 检查是否成功获取钱包账户
      if (!accounts || accounts.length === 0) {
        setError('未获取到账户信息');
        return;
      }

      // 获取当前网络ID
      const networkId = await window.ethereum.request({
        method: 'eth_chainId'  // 请求获取当前钱包连接的chainId
      });
      // 将十六进制字符串转换为十进制数字
      const currentChainId = parseInt(networkId, 16);

      // 更新状态变量
      // as `0x${string}` 是TypeScript的类型断言，告诉编译器这个值的类型
      setAddress(accounts[0] as `0x${string}`);
      setChainId(currentChainId);
      setIsConnected(true);

      // 检查是否在正确的网络上
      if (currentChainId !== sepolia.id) {
        setError(`请切换到 ${sepolia.name} 网络 (Chain ID: ${sepolia.id})`);
        
        // 尝试自动切换到Sepolia网络
        // js中{}就表示对象结构  []就表示数组结构
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain', // metamask切换网络的方法
            params: [{ chainId: `0x${sepolia.id.toString(16)}` }],  // 转换为十六进制
          });
        } catch (switchError: any) { // any类型表示任意类型
          // 如果网络不存在，尝试添加网络
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: `0x${sepolia.id.toString(16)}`,
                  chainName: sepolia.name,
                  rpcUrls: ['https://eth-sepolia.public.blastapi.io'],
                  nativeCurrency: {
                    name: 'Sepolia ETH',
                    symbol: 'ETH',
                    decimals: 18,
                  },
                  blockExplorerUrls: ['https://sepolia.etherscan.io'],
                }],
              });
            } catch (addError) {
              console.error('添加网络失败:', addError);
              setError('无法添加 Sepolia 网络，请手动添加');
            }
          } else {
            console.error('切换网络失败:', switchError);
            setError('无法切换到 Sepolia 网络');
          }
        }
      } 
      

      // 在添加事件监听器之前，先尝试删除一波事件监听器，避免重复注册
      if (window.ethereum && typeof(window.ethereum.removeAllListeners) === 'function') {
        window.ehtereum.removeAllListeners('accountsChanged');
        window.ehtereum.removeAllListeners('chainChanged');
      }

      // 添加事件监听器
      // 监听账户变化事件,当用户在MetaMask中切换账户时会触发
      /**
       * 语法讲解：
       * 这是一个箭头函数（Arrow Function），也叫匿名函数。
          (accounts: string[]) 是函数的入参，类型是 string[]，即字符串数组，表示新的账户地址列表。
          => { ... } 是箭头函数的主体，花括号 {} 里面可以写你希望在事件发生时执行的代码。
       */
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          // 用户断开了连接
          setIsConnected(false);
          setAddress(undefined);
          setError('钱包已断开连接');
        } else {
          // 用户切换到了不同的账户
          setAddress(accounts[0] as `0x${string}`);
          clearError();
        }
      });


      // 监听网络变化事件
      // 当用户在MetaMask中切换网络时会触发
      window.ethereum.on('chainChanged', (chainId: string) => {
        const newChainId = parseInt(chainId, 16);
        setChainId(newChainId);

        if (newChainId !== sepolia.id) {
          setError(`请切换到 ${sepolia.name} 网络 (Chain ID: ${sepolia.id})`);
        } else {
          clearError();
        }
      });

    } catch (error : any) {
      console.error('连接钱包失败:', error);

      // 处理不同类型的错误
      if (error.code === 4001) {
        setError('用户拒绝了连接请求');
      } else if (error.code === -32002) {
        setError('MetaMask 正在处理请求，请检查扩展程序');
      } else if (error.message?.includes('User rejected')) {
        setError('用户拒绝了连接请求');
      } else {
        setError(`连接失败: ${error.message || '未知错误'}`);
      }
    } finally {
      // finally块总是会执行，无论是否有错误
      // 结束加载
      setIsLoading(false);
    }
  };



  // 断开钱包连接的函数
  const disconnectWallet = () => {
    // 重置状态变量
    setIsConnected(false);
    setAddress(undefined);
    setChainId(undefined);
    setError('');

    // 移除事件监听器
    if (windows.ethereum && windwos.ethereum.removeAllListeners === 'function') {
      window.ethereum.removeAllListeners('accountsChanged');
      window.ethereum.removeAllListeners('chainChanged');
    }
  };


  // 获取用户存在TokenBank中的余额以及用户剩余的余额
  const fetchBalances = async () => {
    // 如果没有地址就直接返回
    if (!address) return;

    // 创建TokenBank合约对象
    const tokenBankContract = getContract({
      address: TOKEN_BANK_ADDRESS,
      abi: TokenBank_ABI.abi,
      client: publicClient
    });


    try {
      // 获取用户在TokenBank中的存款余额
      // as bigint 是类型断言，表示返回值是大整数类型
      /**
       * 代码分解
          tokenBankContract - 这是通过 viem 的 getContract 函数创建的合约实例
          .read - 表示这是一个只读操作，不会修改区块链状态（不消耗 gas）
          .balanceOf - 合约中定义的函数名
          ([address]) - 函数参数以数组形式传递，即使只有一个参数也需要放在数组中
          as bigint - TypeScript 类型断言，告诉编译器函数返回值应该被视为 bigint 类型
       */
      const desposit = await tokenBankContract.read.balanceOf([address]) as bigint;
      // formatEther 将wei转换为ether单位(除以10^18)
      setDepositBalance(formatEther(desposit));

      // 获取Token合约的地址
      const tokenContractAddress = await tokenBankContract.read.token() as `0x${string}`;
      // 创建Token合约实例
      const tokenContract = getContract({
        address: tokenContractAddress,
        // 手动定义ERC20 balanceOf函数的ABI
        abi: [{
          "type": "function",
          "name": "balanceOf",
          "inputs": [{ "name": "owner", "type": "address" }],
          "outputs": [{ "name": "", "type": "uint256" }],
          "stateMutability": "view"  // view表示只读函数
        }],
        client: publicClient
      });

      // 获取用户的Token余额
      const tokenBalance = await tokenContract.read.balanceOf([address]) as bigint;
      setTokenBalance(formatEther(tokenBalance));

    } catch (error) {
      console.error('获取余额失败：', error);
    }
  }

  // 用户存款
  const handleDeposit = async () => {
    // 检查必要条件
    if (!address || !depositAmount) return;
    // 开始加载
    setIsLoading(true);
    setTxHash('');

    try {
      if (!window.ethereum) {
        setError('MetaMasj 未安装');
        return;
      }

      // 创建钱包客户端，用于发送需要签名的交易
      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(window.ethereum)  // 使用MetaMask作为传输层
      });

      // 首先需要批准TokenBank合约使用Token
      const tokenBankContract = getContract({
        address: TOKEN_BANK_ADDRESS,
        abi: TokenBank_ABI.abi,
        client: publicClient // 表示使用publicClient客户端实现与合约的调用交互
      });
      // 获取Token合约地址
      const tokenAddress = await tokenBankContract.read.token() as `0x${string}`;
      // 创建Token合约实例用于批准授权操作
      const tokenContract = getContract({
        address: tokenAddress,
        // ERC20 approve函数的ABI  我们只需要输入我们需要调用的函数的abi即可
        abi: [{
          "type": "function",
          "name": "approve",
          "inputs": [
            { "name": "spender", "type": "address" },
            { "name": "amount", "type": "uint256" }
          ],
          "outputs": [{ "name": "", "type": "bool" }],
          "stateMutability": "nonpayable"  // nonpayable表示需要gas但不接受ETH
        }], 
        client: {
          public: publicClient,  // 用于调用读取函数  read
          wallet: walletClient   // 用于调用写入函数  write
        }
      });

      /**
       * // 只读函数调用（不改变状态）
         const result = await contract.read.functionName([param1, param2, ...]) as ReturnType;

         // 写入函数调用（改变状态，需要签名和支付 gas）
         const hash = await contract.write.functionName([param1, param2, ...], {
          account: address,  // 发送交易的账户
          // 其他可选参数
         });
       */
      // 调用approve函数，允许TokenBank使用指定数量的Token，这样TokenBank就可以把用户想存的钱操作转入TokenBank合约中
      // 调用wirte的时候，第一个参数是数组，就是Token合约approve函数的两个入参，第二个参数是一个结构体对象，传入调用approve函数的地址是谁，
      // 这里我们就传入的要存款用户的地址，表明是用户自己调用的approve函数授权给TokenBank合约
      const approveHash = await tokenContract.write.approve([
        TOKEN_BANK_ADDRESS,
        parseEther(depositAmount)], // parseEther将ether转换为wei(乘以10^18)
        {account: address});

      console.log('Approve hash:', approveHash);

      // 等待批准交易被确认
      await publicClient.waitForTransactionReceipt({hash: approveHash});

      // 执行到这里说明批准交易已经被链上确认了
      // 现在TokenBank合约已经可以操控用户的token余额了，下面开始存款操作

      // 调用TokenBank合约的存款函数
      // 但是这里要用钱包客户端调用，因为用户要通过操作钱包完成存款
      const hash = await walletClient.writeContract({
        address: TOKEN_BANK_ADDRESS,
        abi: TokenBank_ABI.abi,
        functionName: 'deposit', // 调用合约的deposit函数
        args: [parseEther(depositAmount)],  // 函数参数
        account: address // 发送交易的账户
      });

      console.log('Deposit hash:', hash);
      // 保存交易哈希用于显示
      setTxHash(hash);

      // 等待交易确认后刷新余额
      await publicClient.waitForTransactionReceipt({hash});
      // 刷新所有余额
      fetchBalances();
      // 清空输入框
      setDepositAmount('');
    } catch (error) {
      console.error('存款失败', error);
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol className="font-mono list-inside list-decimal text-sm/6 text-center sm:text-left">
          <li className="mb-2 tracking-[-.01em]">
            Get started by editing{" "}
            <code className="bg-black/[.05] dark:bg-white/[.06] font-mono font-semibold px-1 py-0.5 rounded">
              src/app/page.tsx
            </code>
            .
          </li>
          <li className="tracking-[-.01em]">
            Save and see your changes instantly.
          </li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </a>
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
