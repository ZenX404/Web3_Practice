// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// 导入IERC20接口，用于与ERC20代币交互
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

// 定义接收代币回调的接口
interface ITokenReceiver {
    function tokensReceived(address from, uint256 amount, bytes calldata data) external returns (bool);
}

// 简单的ERC721接口
interface IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function getApproved(uint256 tokenId) external view returns (address);
}

// 扩展的ERC20接口，添加带有回调功能的转账函数
interface IExtendedERC20 is IERC20 {
    function transferWithCallback(address _to, uint256 _value) external returns (bool);
    function transferWithCallbackAndData(address _to, uint256 _value, bytes calldata _data) external returns (bool);
}


contract NFTMarket is ITokenReceiver {
    IExtendedERC20 public paymentToken;

    struct Listing {
        address seller;
        address nftContractAddr;
        uint256 tokenId;
        uint256 price;
        bool isActive;
    }

    uint256 public nextListId;
    // 所有上架的NFT，使用listId作为唯一标识
    mapping(uint256 => Listing) listings;

    // NFT上架和购买事件
    event NFTListed(uint256 indexed listId, address indexed seller, address indexed nftContractAddr, uint256 tokenId, uint256 price);
    event NFTSold(uint256 indexed listId, address indexed seller, address indexed buyer, address nftContractAddr, uint256 tokenId, uint256 price);
    event NFTListingCancelled(uint256 indexed listId);

    // 构造函数，设置支付代币地址
    constructor(address _paymentTokenContractAddr) {
        require(_paymentTokenContractAddr != address(0), "NFTMarket: payment token address cannot be zero");
        paymentToken = IExtendedERC20(_paymentTokenContractAddr);
    }


    // 上架NFT
    function list(address nftContractAddr, uint256 tokenId, uint256 price) external returns (uint256) {
        require(price > 0, "NFTMarket: price should be greater zero");
        require(nftContractAddr != address(0), "NFTMarket: nftContractAddr can't be zero");

        // 判断调用者的是否拥有该nft所有权
        IERC721 nftContract = IERC721(nftContractAddr);
        address nftOwner = nftContract.ownerOf(tokenId);
        require(
            msg.sender == nftOwner ||  // 函数调用者是否为该NFT所有者
            nftContract.isApprovedForAll(nftOwner, msg.sender) ||   // 函数调用者是否有该NFT所有者地址的NFT操作权限
            nftContract.getApproved(tokenId) == msg.sender,   // 函数调用者是否有该NFT的操作权限  
            "NFTMarket: caller is not owner nor approved"
        );

        uint256 listId = nextListId;
        listings[listId] = Listing({
            seller: msg.sender,
            nftContractAddr: nftContractAddr,
            tokenId: tokenId,
            price: price,
            isActive: true
        });

        nextListId++;

        emit NFTListed(listId, msg.sender, nftContractAddr, tokenId, price);

        return listId;
    }

    // 下架NFT
    function cancelListing(uint256 listId) external {
        require(listId >= 0 && listId < nextListId, "NFTMarket: listId is not vaild");

        Listing storage listing = listings[listId];
        require(listing.isActive, "NFTMarket: listing is not active");

        listing.isActive = false;
        emit NFTListingCancelled(listId);
    }

    // 购买NFT：方法一
    // 这个流程token并没有流转到NFTMarket，而是直接从买家手里转给卖家的。NFT也是同样。
    // 这个方法买家需要授权NFTMarket可以操作自己的token
    function buyNFT(uint256 listId) external {
        // 检查NFT是否处在上架状态
        Listing storage listing = listings[listId];
        require(listing.isActive, "NFTMarket: NFT is not active");

        // 检查买家是否有足够余额
        require(paymentToken.balanceOf(msg.sender) >= listing.price, "buyer don't have enough token");

        // 先修改状态，防止重入攻击
        listing.isActive = false;

        // 处理代币转账（买家 -> 卖家）
        // NFTMarket合约操作将买家的token转给卖家
        // NFTMarket合约调用ERC20合约的transferFrom()函数   买家必须授权NFTMarket合约可以操作自己的token
        /*
            buyNFT函数使用transferFrom而不是直接transfer的主要原因是：保障交易原子性
                使用transferFrom可以让整个交易在一个原子操作中完成
                代币转移和NFT转移要么同时成功，要么同时失败
            如果买家用transfer直接转账会怎样？
                假设用户直接把钱转给卖家：
                    步骤1: 买家调用代币合约，转账给卖家
                    步骤2: 买家调用市场合约，请求获取NFT
                这会导致严重问题：
                步骤1和步骤2不在同一交易中，没有原子性保证
                付款后，卖家可能已经将NFT卖给别人
                无法保证交易的完整性和公平性

            授权+transferFrom模式让市场合约可以：
                先验证所有条件
                在同一交易中完成代币和NFT的转移
                确保交易完整执行或完全回滚
        */
        bool success = paymentToken.transferFrom(msg.sender, listing.seller, listing.price);
        require(success, "NFTMarket: token transfer failed");

        // 处理NFT转移（卖家 -> 买家）
        // NFTMarket合约操作将卖家的NFT转给买家
        IERC721 nftContract = IERC721(listing.nftContractAddr);
        // NFTMarket合约调用ERC721合约的transferFrom()函数   卖家必须授权NFTMarket合约可以操作自己的NFT  一般卖家如果想要在这个商店上架NFT，都会有一步授权NFTMarket可以操作自己上架的这个NFT的权限
        nftContract.transferFrom(listing.seller, msg.sender, listing.tokenId);

        emit NFTSold(listId, listing.seller, msg.sender, listing.nftContractAddr, listing.tokenId, listing.price);
    }

    // 购买NFT：方法二
    // 这个流程是买家先把token转给NFTMarket，NFTMarket作为第三方再去将NFT从卖方那里转给买方，NFT转移成功后NFTMarket才会把token转给卖方
    // 这个方法买家不需要授权NFTMarket可以操控自己的token
    /*
        整个流程简述:
            用户直接调用buyNFTWithCallback函数
            该函数调用代币的特殊转账方法
            用户直接将代币发送给市场合约（而不是授权市场合约去拿）
            代币合约自动触发回调完成后续交易
        用户体验优势:
            这种设计带来了显著的用户体验改进：
            单步操作：用户只需点击一次按钮
            无需授权：跳过了容易让新用户困惑的授权步骤
            节省gas：只需支付一次交易费用，没有授权费用
            流程简化：更接近传统电子商务的"一键购买"体验
    */
    function buyNFTWithCallback(uint256 listId) external {
        // 检查NFT是否处在上架状态
        Listing storage listing = listings[listId];
        require(listing.isActive, "NFTMarket: NFT is not active");

        // 检查买家是否有足够余额
        require(paymentToken.balanceOf(msg.sender) >= listing.price, "buyer don't have enough token");

        // 调用transferWithCallbackAndData函数，将代币转给市场合约并附带listingId数据
        // 编码listingId作为附加数据
        // 这里之所以要将listId转换为byte格式，而不是直接传递ListId，是因为transferWithCallbackAndData函数定义要求第三个参数必须是bytes类型。
        // 这个函数之所以这样设置自己的参数类型，是因为当数据需要跨合约传递时，通常会被编码为bytes，特别是在回调模式中，这是标准的规范做法，确保了数据在不同合约之间传递时的兼容性和灵活性。
        bytes memory data = abi.encode(listId);
        // 使用paymentToken合约的transferWithCallbackAndData函数完成将买家的token转给NFTMarket
        // 这个函数是通过mag.sender调用的，也就是买家，所以买家不需要授权NFTMarket可以操作自己的token
        // 买家使用transferWithCallbackAndData函数将token转给NFTMarket后，该函数会回调NFTMarket合约的tokensReceived回调函数，进而让NFTMarket合约将NFT从卖家手中转给买家
        bool success = paymentToken.transferWithCallbackAndData(address(this), listing.price, data);

        require(success, "NFTMarket: token transfer with callback failed");
    }

    // token合约会回调NFTMarket合约的该函数，让NFTMarket将token转给卖家，并把NFT转给买家
    // 实现tokensReceived接口，处理通过transferWithCallback接收到代币后的操作逻辑
    // from是买家地址
    function tokensReceived(address from, uint256 amount, bytes calldata data) external returns (bool) {
        // 检查调用者是否为支付代币合约
        require(msg.sender == address(paymentToken), "NFTMarket: caller is not the payment token contract");
        
        // 解析附加数据，获取listingId
        require(data.length == 32, "NFTMarket: invalid data length");
        uint256 listingId = abi.decode(data, (uint256));
        
        // 检查上架信息是否存在且处于活跃状态
        Listing storage listing = listings[listingId];
        require(listing.isActive, "NFTMarket: listing is not active");
        
        // 检查转入的代币数量是否等于NFT价格
        require(amount == listing.price, "NFTMarket: incorrect payment amount");
        
        // 将上架信息标记为非活跃   先修改状态，防止重入攻击
        listing.isActive = false;
        
        // 将代币转给卖家   该操作是NFTMarket合约自己调用的，将自己收到的token转给卖家
        bool success = paymentToken.transfer(listing.seller, amount);
        require(success, "NFTMarket: token transfer to seller failed");
        
        // 处理NFT转移（卖家 -> 买家）   卖家需要授权NFTMarket合约可以操作其NFT
        IERC721(listing.nftContractAddr).transferFrom(listing.seller, from, listing.tokenId);
        
        // 触发NFT售出事件
        emit NFTSold(listingId, from, listing.seller, listing.nftContractAddr, listing.tokenId, amount);
        
        return true;
    }

}