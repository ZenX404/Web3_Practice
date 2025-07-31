// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/NFTMarket.sol";


// 模拟ERC20代币合约
contract MockERC20 is IExtendedERC20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    string public name = "Mock Token";
    string public symbol = "MOCK";
    uint8 public decimals = 18;
    uint256 public totalSupply = 1000000 * 10**18;
    
    constructor() {
        _balances[msg.sender] = totalSupply;
    }
    
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }
    
    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _balances[msg.sender] -= amount;
        _balances[recipient] += amount;
        return true;
    }
    
    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        require(_allowances[sender][msg.sender] >= amount, "ERC20: insufficient allowance");
        _allowances[sender][msg.sender] -= amount;
        _balances[sender] -= amount;
        _balances[recipient] += amount;
        return true;
    }
    
    function approve(address spender, uint256 amount) external override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        return true;
    }
    
    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }
    
    function mint(address to, uint256 amount) external {
        _balances[to] += amount;
    }
    
    function transferWithCallback(address _to, uint256 _value) external override returns (bool) {
        _balances[msg.sender] -= _value;
        _balances[_to] += _value;
        ITokenReceiver(_to).tokensReceived(msg.sender, _value, "");
        return true;
    }
    
    function transferWithCallbackAndData(address _to, uint256 _value, bytes calldata _data) external override returns (bool) {
        _balances[msg.sender] -= _value;
        _balances[_to] += _value;
        ITokenReceiver(_to).tokensReceived(msg.sender, _value, _data);
        return true;
    }
}

// 模拟ERC721代币合约
contract MockERC721 is IERC721 {
    mapping(uint256 => address) private _owners;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => address) private _tokenApprovals;
    
    function mint(address to, uint256 tokenId) external {
        _owners[tokenId] = to;
    }
    
    function ownerOf(uint256 tokenId) external view override returns (address) {
        require(_owners[tokenId] != address(0), "ERC721: owner query for nonexistent token");
        return _owners[tokenId];
    }
    
    function transferFrom(address /*from*/, address to, uint256 tokenId) external override {
        require(_isApprovedOrOwner(msg.sender, tokenId), "ERC721: transfer caller is not owner nor approved");
        _owners[tokenId] = to;
    }
    
    function safeTransferFrom(address /*from*/, address to, uint256 tokenId) external override {
        require(_isApprovedOrOwner(msg.sender, tokenId), "ERC721: transfer caller is not owner nor approved");
        _owners[tokenId] = to;
    }
    
    function approve(address to, uint256 tokenId) external {
        address owner = _owners[tokenId];
        require(msg.sender == owner || _operatorApprovals[owner][msg.sender], "ERC721: approve caller is not owner nor approved for all");
        _tokenApprovals[tokenId] = to;
    }
    
    function getApproved(uint256 tokenId) external view override returns (address) {
        return _tokenApprovals[tokenId];
    }
    
    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
    }
    
    function isApprovedForAll(address owner, address operator) external view override returns (bool) {
        return _operatorApprovals[owner][operator];
    }
    
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = _owners[tokenId];
        return (spender == owner || 
                _operatorApprovals[owner][spender] || 
                _tokenApprovals[tokenId] == spender);
    }
}

contract NFTMarketTest is Test {
    NFTMarket public nftMarketContract;
    MockERC20 public token;
    MockERC721 public nft;

    address public seller = address(1);
    address public buyer = address(2);
    // 授权操作员地址
    address public operator = address(3);
    

    function setUp() public {
        // 部署模拟代币合约
        token = new MockERC20();
        nft = new MockERC721();
        // 部署NFT市场合约，需要设置支付token的合约地址
        nftMarketContract = new NFTMarket(address(token));
        

        // 为买家铸造100个token
        token.mint(buyer, 100 * 10 ** 18);
        // 为卖家铸造NFT
        nft.mint(seller, 811);
    }

    // 1、上架NFT：测试上架成功和失败情况，要求断言错误信息和上架事件。
    function testListNFT() public {
        // 切换到卖家账户。这个函数和prank()函数的区别就是：prank()函数只作用于下一次的函数调用，startPrank()作用于后面所有的函数调用
        // 从现在开始，所有的交易都以指定地址的身份执行
        vm.startPrank(seller);
        // 期望后面会发出NFTListed事件
        /**
         * 告诉 Foundry："我期望下一个交易会发出一个事件"
            四个 true 参数分别表示：
            第1个 true：检查第1个索引参数（indexed parameter）
            第2个 true：检查第2个索引参数
            第3个 true：检查第3个索引参数
            第4个 true：检查所有非索引参数的数据

            这行代码就是告诉 Foundry："下一个交易应该发出一个事件，我要检查所有的 indexed 参数和数据参数。"
         */
        vm.expectEmit(true, true, true, true);
        // 跟在expectEmit()函数后面，这行代码不是真的发出事件，而是告诉 Foundry："我期望的事件内容就是这样。"
        // 定义了期望的事件内容（事件和时间参数必须和下面的完全匹配），如果实际执行时没有发出这个事件，或者事件参数不匹配，测试就会失败
        // 这里要注意需要制定是哪个合约的事件类型，不然测试脚本就不知道这个事件类型是什么
        // 这里要写合约类型.事件类型，千万不要写合约对象.事件类型，或者不能写合约地址.事件类型
        // 还要注意入参是address类型的，不要传入合约类型变量，要转换成合约地址传入
        emit NFTMarket.NFTListed(0, seller, address(nft), 811, 50 * 10 ** 18);

        // 上架NFT
        // 还要注意入参是address类型的，不要传入合约类型变量，要转换成合约地址传入
        uint256 listingId = nftMarketContract.list(address(nft), 811, 50 * 10 ** 18);
        // 验证上架信息
        // 首先获取到上架NFT的相关数据，listings是public变量，所以可以通过listings(listingId)函数索引对应的Listing结构体变量
        // 下面这个是解构赋值语法，一次性获取结构体或者多返回值函数的所有返回值
        // 左边的变量按结构体中的顺序接收这些返回值
        (address listingSeller, address listingNftContractAddr, uint256 listingTokenId, uint256 listingPrice, bool listingIsActive) = nftMarketContract.listings(listingId);
        assertEq(seller, listingSeller, "Seller address mismatch");
        assertEq(address(nft), listingNftContractAddr, "nft address mismatch");
        assertEq(811, listingTokenId, "token id mismatch");
        assertEq(50 * 10 ** 18, listingPrice, "nftPrice mismatch");
        assertTrue(listingIsActive, "Listing should be active");
        // 验证listingId
        assertEq(0, listingId, "listingId should be 0");
        // nftMarketContract合约变量nextListId是public类型，所以默认自动生成了nextListId()函数用来获取该变量的值
        assertEq(1, nftMarketContract.nextListId(), "nextListId shoud be incremented");

        // 结束以seller地址进行模拟调用，之后的交易会继续默认以测试合约自身的身份执行
        vm.stopPrank();
    }

    // 测试非所有者上架NFT失败的情况
    function testListNFTFailureNotOwner() public {
        // 切换到非所有者账户
        vm.startPrank(buyer);
        
        // 预期会失败，并显示特定错误信息
        vm.expectRevert("NFTMarket: caller is not owner nor approved");
        nftMarketContract.list(address(nft), 811, 50 * 10 ** 18);
        
        vm.stopPrank();
    }
    
    // 测试价格为零上架NFT失败的情况
    function testListNFTFailureZeroPrice() public {
        // 切换到卖家账户
        vm.startPrank(seller);
        
        // 预期会失败，并显示特定错误信息
        vm.expectRevert("NFTMarket: price should be greater zero");
        nftMarketContract.list(address(nft), 811, 0);
        
        vm.stopPrank();
    }
    
    // 测试NFT合约地址为零上架NFT失败的情况
    function testListNFTFailureZeroAddress() public {
        // 切换到卖家账户
        vm.startPrank(seller);
        
        // 预期会失败，并显示特定错误信息
        vm.expectRevert("NFTMarket: nftContractAddr can't be zero");
        nftMarketContract.list(address(0), 811, 50 * 10 ** 18);
        
        vm.stopPrank();
    }
    
    // 测试授权操作员上架NFT成功的情况
    function testListNFTByApprovedOperator() public {
        // 卖家授权操作员
        vm.startPrank(seller);
        nft.setApprovalForAll(operator, true);
        vm.stopPrank();
        
        // 切换到操作员账户
        vm.startPrank(operator);
        
        // 预期会发出NFTListed事件
        vm.expectEmit(true, true, true, true);
        emit NFTMarket.NFTListed(0, seller, address(nft), 811, 50 * 10 ** 18);
        
        // 操作员上架NFT
        uint256 listingId = nftMarketContract.list(address(nft), 811, 50 * 10 ** 18);
        
        // 验证上架信息
        (address listedSeller, , , , ) = nftMarketContract.listings(listingId);
        assertEq(listedSeller, seller, "Seller should be the NFT owner, not the operator");
        
        vm.stopPrank();
    }
    
    // 测试单个代币授权上架NFT成功的情况
    function testListNFTByApprovedForToken() public {
        // 卖家授权特定代币
        vm.startPrank(seller);
        nft.approve(operator, 811);
        vm.stopPrank();
        
        // 切换到被授权账户
        vm.startPrank(operator);
        
        // 预期会发出NFTListed事件
        vm.expectEmit(true, true, true, true);
        emit NFTMarket.NFTListed(0, seller, address(nft), 811, 50 * 10 ** 18);
        
        // 被授权账户上架NFT
        uint256 listingId = nftMarketContract.list(address(nft), 811, 50 * 10 ** 18);
        
        // 验证上架信息
        (address listedSeller, , , , ) = nftMarketContract.listings(listingId);
        assertEq(listedSeller, seller, "Seller should be the NFT owner, not the approved address");
        
        vm.stopPrank();
    }

    // 2、购买NFT：测试购买成功、自己购买自己的NFT、NFT被重复购买、支付Token过多或者过少情况，要求断言错误信息和购买事件。
    function testBuyNFTSuccess() public {
        // 先上架NFT
        vm.startPrank(seller);
        // 将自己的NFT授权给NFTMarket
        nft.approve(address(nftMarketContract), 811);
        uint256 listingId = nftMarketContract.list(address(nft), 811, 50 * 10 ** 18);
        vm.stopPrank();


        vm.startPrank(buyer);
        // 将自己的Token授权给NFTMarket
        token.approve(address(nftMarketContract), 500 * 10 ** 18);
        vm.expectEmit(true, true, true, true);
        emit NFTMarket.NFTSold(0, seller, buyer, address(nft), 811, 50 * 10 ** 18);
        nftMarketContract.buyNFT(0);

        vm.stopPrank();
    }


    // 3、模糊测试：测试随机价格上架NFT并随机地址购买NFT
    /**
     * 模糊测试是Foundry 框架中的一个非常强大的功能。
     * ## 什么是模糊测试？

        模糊测试（Fuzz Testing）是一种自动化测试技术，它会：
        - 生成大量随机输入数据
        - 用这些随机数据测试你的合约
        - 寻找边界情况和潜在的漏洞
        - Foundry 默认会运行 256 次不同的随机输入

        函数名以 testFuzz_ 开头，Foundry 会自动识别为模糊测试
     */
    /**
     * 入参：
     * fuzzPrice：Foundry 会生成随机的 uint256 价格
     * fuzzBuyer：Foundry 会生成随机的 address 买家地址
     */
    function testFuzz_ListAndBuyNFT(uint256 fuzzPrice, address fuzzBuyer) public {
        // 首先要过滤一边参数，剔除掉无意义的随机值
        // 限制价格范围在 0.01-10000 Token之间（考虑到18位小数）
        /**
         * bound()函数作用：
            - 将随机生成的 `fuzzPrice` 限制在合理范围内
            - 最小值：`10**16` = 0.01 Token（18位小数）
            - 最大值：`10000 * 10**18` = 10,000 Token
            - 为什么要限制？ 避免测试极端值（如0或超大数）导致测试无意义

           `fuzzPrice` 是一个完全随机的数,如果不对它的范围加以限制，可能会遇到很多极端情况，导致测试无法通过

            `bound()` 函数的作用就是限制fuzzPrice的大小，`bound()` 函数的工作原理：
            // 伪代码理解
            function bound(uint256 randomValue, uint256 min, uint256 max) returns (uint256) {
                return min + (randomValue % (max - min + 1));
            }

            通过 `bound()` 函数将价格限制在合理范围内的价格
         */
        // 上架NFT要卖的价格
        uint256 listingPrice = bound(fuzzPrice, 10 ** 16, 10000 * 10 ** 18);

        // 确保买家地址有效（不为零地址，不是卖家，不是市场合约）
        /**
         * `vm.assume()` 函数作用：
            - 告诉 Foundry："只在满足这些条件时运行测试"
            - 如果条件不满足，跳过这次测试，生成新的随机值
            - 过滤条件：
            - `!= address(0)`：不能是零地址（无效地址）
            - `!= seller`：买家不能是卖家（避免自己买自己）
            - `!= address(market)`：不能是市场合约地址
            - `!= address(this)`：不能是测试合约地址
         */
        vm.assume(fuzzBuyer != seller);
        vm.assume(fuzzBuyer != address(0));
        vm.assume(fuzzBuyer != address(nftMarketContract));
        vm.assume(fuzzBuyer != address(this));

        // 为买家铸造足够的代币
        token.mint(fuzzBuyer, listingPrice * 2);  // 铸造两倍价格的代币，确保足够

        // 卖家上架NFT
        vm.startPrank(seller);
        uint256 listingId = nftMarketContract.list(address(nft), 811, listingPrice);
        // 卖家授权市场合约转移NFT
        nft.approve(address(nftMarketContract), 811);

        vm.stopPrank();

        // 切换到随机买家账户
        vm.startPrank(fuzzBuyer);
        // 买家授权市场合约转移代币
        token.approve(address(nftMarketContract), listingPrice);
        // 预期会发出NFTSold事件
        vm.expectEmit(true, true, true, true);
        emit NFTMarket.NFTSold(0, seller, fuzzBuyer, address(nft), 811, listingPrice);
        // 购买NFT
        nftMarketContract.buyNFT(listingId);
        // 验证NFT所有权已转移
        assertEq(nft.ownerOf(811), fuzzBuyer, "NFT ownership should be transferred to buyer");
        // 验证代币已转移
        assertEq(token.balanceOf(seller), listingPrice, "token should be transferred to seller");
        // 验证上架信息已更新为非活跃
        (, , , , bool isActive) = nftMarketContract.listings(listingId);
        assertFalse(isActive, "Listing should be inactive after purchase");

        vm.stopPrank();

    }


    // 4、不可变测试：测试无论如何买卖，NFTMarket合约中都不可能有Token持仓
    function testInvariant_NoTokenBalance() public {
        // 设置初始场景：上架NFT
        vm.startPrank(seller);
        uint256 listingId = market.list(address(nftContract), tokenId, price);
        nftContract.approve(address(market), tokenId);
        vm.stopPrank();
        
        // 买家购买NFT
        vm.startPrank(buyer);
        paymentToken.approve(address(market), price);
        market.buyNFT(listingId);
        vm.stopPrank();
        
        // 验证市场合约中没有Token持仓
        assertEq(paymentToken.balanceOf(address(market)), 0, "Market contract should not hold any tokens");
        
        // 再次上架NFT（现在由买家上架）
        vm.startPrank(buyer);
        uint256 newListingId = market.list(address(nftContract), tokenId, price * 2); // 双倍价格
        nftContract.approve(address(market), tokenId);
        vm.stopPrank();
        
        // 卖家（原来的）购买NFT
        paymentToken.mint(seller, price * 2); // 为卖家铸造足够的代币
        vm.startPrank(seller);
        paymentToken.approve(address(market), price * 2);
        market.buyNFT(newListingId);
        vm.stopPrank();
        
        // 验证市场合约中仍然没有Token持仓
        assertEq(paymentToken.balanceOf(address(market)), 0, "Market contract should not hold any tokens");
        
        // 测试使用回调方式购买
        vm.startPrank(seller);
        uint256 callbackListingId = market.list(address(nftContract), tokenId, price);
        nftContract.approve(address(market), tokenId);
        vm.stopPrank();
        
        // 买家使用回调方式购买NFT
        vm.startPrank(buyer);
        bytes memory data = abi.encode(callbackListingId);
        paymentToken.transferWithCallbackAndData(address(market), price, data);
        vm.stopPrank();
        
        // 验证市场合约中仍然没有Token持仓
        assertEq(paymentToken.balanceOf(address(market)), 0, "Market contract should not hold any tokens after callback purchase");
    }
}

