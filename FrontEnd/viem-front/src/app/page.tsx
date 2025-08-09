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
const TOKEN_BANK_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_BANK_ADDRESS;


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
  const [depositeBalance, setdepositeBalance] = useState<string>('0');

  // 存储用户输入的存款金额
  const [depositeAmount, setdepositeAmount] = useState<string>('');
  
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
    transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL)  // RPC端点(需要用viem提供的http函数转换一下)  用来与区块链交互
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
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
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
    if (window.ethereum && window.ethereum.removeAllListeners === 'function') {
      window.ethereum.removeAllListeners('accountsChanged');
      window.ethereum.removeAllListeners('chainChanged');
    }
  };


  // 获取用户存在TokenBank中的余额以及用户剩余的token余额
  const fetchBalances = async () => {
    // 如果没有地址就直接返回
    if (!address) return;

    // 创建TokenBank合约对象
    const tokenBankContract = getContract({
      address: TOKEN_BANK_ADDRESS,
      abi: TokenBank_ABI,
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
      setdepositeBalance(formatEther(desposit));

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
  const handledeposite = async () => {
    // 检查必要条件
    if (!address || !depositeAmount) return;
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
        abi: TokenBank_ABI,
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
        parseEther(depositeAmount)], // parseEther将ether转换为wei(乘以10^18)
        {account: address}); // 因为这里调用的是写操作，使用walletClient，所以需要指定调用的用户是谁，要扣除gas费

      console.log('Approve hash:', approveHash);

      // 等待批准交易被确认
      await publicClient.waitForTransactionReceipt({hash: approveHash});

      // 执行到这里说明批准交易已经被链上确认了
      // 现在TokenBank合约已经可以操控用户的token余额了，下面开始存款操作

      // 在实际调用前先模拟
    const simulationResult = await publicClient.simulateContract({
      address: TOKEN_BANK_ADDRESS,
      abi: TokenBank_ABI,
      functionName: 'deposite',
      args: [parseEther(depositeAmount)],
      account: address,
    });
    console.log('模拟调用成功:', simulationResult);

      // 调用TokenBank合约的存款函数
      // 但是这里要用钱包客户端调用，因为用户要通过操作钱包完成存款
      const hash = await walletClient.writeContract({
        address: TOKEN_BANK_ADDRESS,
        abi: TokenBank_ABI,
        functionName: 'deposite', // 调用合约的deposite函数
        args: [parseEther(depositeAmount)],  // 函数参数
        account: address // 发送交易的账户（这里就是要存款的用户）  写操作
      });

      console.log('deposite hash:', hash);
      // 保存交易哈希用于显示
      setTxHash(hash);

      // 等待交易确认后刷新余额
      await publicClient.waitForTransactionReceipt({hash});
      // 刷新所有余额
      fetchBalances();
      // 清空输入框
      setdepositeAmount('');
    } catch (error) {
      console.error('存款失败', error);
    } finally {
      setIsLoading(false);
    }
  };


  // 用户取款
  const handleWithdraw = async () => {
    if (!address || !withdrawAmount) return;
    setIsLoading(true);
    setTxHash('');

    try {
      if (!window.ethereum) {
        setError('MetaMask 未安装');
        return;
      }

      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(window.ethereum)
      });

      // 通过钱包调用TokenBank合约的取款函数(不需要approve)
      const hash = await walletClient.writeContract({
        address: TOKEN_BANK_ADDRESS,
        abi: TokenBank_ABI,
        functionName: 'withdraw',
        args: [parseEther(withdrawAmount)],
        account: address
      });

      console.log('Withdraw hash:', hash);
      setTxHash(hash);
      // 等待交易确认后刷新余额
      await publicClient.waitForTransactionReceipt({hash});
      fetchBalances();
      setWithdrawAmount('');
    } catch (error) {
      console.error('取款失败', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * useEffect 是 React 中的一个核心 Hook，主要用于处理组件中的"副作用"。所谓副作用，指的是在组件渲染之外发生的操作，如：
      数据获取 - 从API或区块链获取数据
      订阅/监听事件 - 如区块链事件、窗口大小变化等
      手动DOM操作 - 直接操作DOM元素
      定时器 - 设置和清除计时器
   */
  // useEffect 是 React 的副作用钩子，用于在组件渲染后执行某些操作。
  // 第一个参数是效果函数，也就是需要执行的副作用代码。第二个参数是依赖数组，指定在哪些值变化时重新执行副作用，如果是空数组[]表示仅在组件挂载和卸载时执行
  // useEffect函数会在组件首次渲染后以及address变化时执行，当前这个页面导出的Home就是一个组件，也就是等整个页面都加载渲染完，才会去用这个useEffect副作用函数
  useEffect(() => {
    const fetchEthBalance = async () => {
      if (!address) return;

      // 创建获取用户ETH余额的函数
      const ethBalance = await publicClient.getBalance({
        address: address
      });

      setBalance(formatEther(ethBalance));
    };

    // 当地址存在时，获取ETH余额和其他余额
    if (address) {
      fetchEthBalance();
      fetchBalances();
    }
    // 不提供第二个参数则在每次渲染后执行
  }, [address]); // 依赖数组：当address变化时会重新执行该useEffect钩子函数


  // Home组件的返回值(JSX)，也就是在这里返回整个页面样式，通过上面的函数加载数值，然后渲染到下面的页面上，最后返回出去显示页面。
  // JSX是JavaScript的语法扩展，允许在JS中写HTML-like的代码
  return (
    // 最外层容器div，使用Tailwind CSS类名进行样式设置
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* 标题 */}
      <h1 className="text-3xl font-bold mb-8">Token Bank Demo</h1>
      
      {/* 主要内容区域 */}
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl">
        {/* 错误提示区域 */}
        {/* 条件渲染：只有当error存在时才显示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {/* 根据连接状态显示不同内容 */}
        {!isConnected ? (
          // 未连接时显示连接按钮
          <button
            onClick={connectWallet}  // 点击事件处理器
            disabled={isLoading}     // 根据加载状态禁用按钮
            // 模板字符串和条件操作符用于动态类名
            className={`w-full py-2 px-4 rounded transition-colors ${
              isLoading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white`}
          >
            {/* 根据加载状态显示不同文本 */}
            {isLoading ? '连接中...' : '连接 MetaMask'}
          </button>
        ) : (
          // 已连接时显示主要功能区域
          <div className="space-y-4">
            {/* 钱包地址显示 */}
            <div className="text-center">
              <p className="text-gray-800 font-semibold">钱包地址:</p>
              {/* break-all用于长文本换行 */}
              <p className="font-mono break-all text-gray-900">{address}</p>
            </div>
            
            {/* 当前网络显示 */}
            <div className="text-center">
              <p className="text-gray-800 font-semibold">当前网络:</p>
              {/* 根据网络状态动态设置文本颜色 */}
              <p className={`font-mono font-bold ${isCorrectNetwork ? 'text-green-600' : 'text-red-600'}`}>
                {/* 三元操作符用于条件显示 */}
                {chainId === sepolia.id ? sepolia.name : `未知网络 (Chain ID: ${chainId})`}
                {/* 嵌套的条件渲染 */}
                {!isCorrectNetwork && (
                  <span className="block text-sm text-red-500 mt-1">
                    ⚠️ 请切换到 {sepolia.name} 网络
                  </span>
                )}
              </p>
            </div>
            
            {/* ETH余额显示 */}
            <div className="text-center">
              <p className="text-gray-800 font-semibold">ETH 余额:</p>
              <p className="font-mono text-gray-900 text-lg">{balance} ETH</p>
            </div>
            
            {/* Token 余额显示 */}
            <div className="text-center">
              <p className="text-gray-800 font-semibold">Token 余额:</p>
              <p className="font-mono text-gray-900 text-lg">{tokenBalance} Token</p>
            </div>
            
            {/* 存款余额显示 */}
            <div className="text-center">
              <p className="text-gray-800 font-semibold">存款余额:</p>
              <p className="font-mono text-gray-900 text-lg">{depositeBalance} Token</p>
            </div>
            
            {/* 存款表单 */}
            <div className="border p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2 text-black">存款</h3>
              <div className="flex space-x-2">
                {/* 受控输入组件 */}
                <input
                  type="text"
                  value={depositeAmount}  // 受状态控制的值
                  // 事件处理器：更新状态
                  onChange={(e) => setdepositeAmount(e.target.value)}
                  placeholder="输入存款金额"
                  className="flex-1 border rounded p-2 text-black"
                  disabled={isLoading}
                />
                <button
                  onClick={handledeposite}
                  // 多个条件的组合判断
                  disabled={isLoading || !depositeAmount || !isCorrectNetwork}
                  className={`px-4 py-2 rounded ${
                    isLoading || !isCorrectNetwork
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-green-500 hover:bg-green-600'
                  } text-white`}
                >
                  {/* 嵌套的三元操作符 */}
                  {isLoading ? '处理中...' : !isCorrectNetwork ? '网络错误' : '存款'}
                </button>
              </div>
            </div>
            
            {/* 取款表单 */}
            <div className="border p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2 text-black">取款</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="输入取款金额"
                  className="flex-1 border rounded p-2 text-black"
                  disabled={isLoading}
                />
                <button
                  onClick={handleWithdraw}
                  disabled={isLoading || !withdrawAmount || !isCorrectNetwork}
                  className={`px-4 py-2 rounded ${
                    isLoading || !isCorrectNetwork
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-red-500 hover:bg-red-600'
                  } text-white`}
                >
                  {isLoading ? '处理中...' : !isCorrectNetwork ? '网络错误' : '取款'}
                </button>
              </div>
            </div>
            
            {/* 交易哈希显示 */}
            {/* 条件渲染：只有当txHash存在时才显示 */}
            {txHash && (
              <div className="text-center">
                <p className="text-gray-600">交易哈希:</p>
                <p className="font-mono break-all text-blue-500">{txHash}</p>
              </div>
            )}
            
            {/* 断开连接按钮 */}
            <button
              onClick={disconnectWallet}
              className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition-colors"
            >
              断开连接
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
