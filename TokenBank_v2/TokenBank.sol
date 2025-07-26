// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


interface IERC20 {
    function balanceOf(address _owner) external view returns (uint256 balance);
    function transfer(address _to, uint256 _value) external returns (bool success);
    function transferFrom(address _from, address _to, uint256 _value) external returns (bool success);
    function approve(address _spender, uint256 _value) external returns (bool success);
    function allowance(address _owner, address _spender) external view returns (uint256 remaining);

}

// 定义接收代币回调的接口
interface ITokenReceiver {
    function tokensReceived(address from, uint256 amount) external returns (bool);
}

contract ExtendedERC20 is IERC20 {
    string public name; 
    string public symbol; 
    uint8 public decimals; 

    uint256 public totalSupply; 

    mapping (address => uint256) balances; 

    mapping (address => mapping (address => uint256)) allowances; 

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() public {
        // write your code here
        // set name,symbol,decimals,totalSupply
        
        name = "BaseERC20";
        symbol = "BERC20";
        // solidity中没有浮点类型，所以相当于一个BaseREC20，后面要加18个0
        decimals = 18;
        totalSupply = 100000000 * 10 ** decimals;
        balances[msg.sender] = totalSupply;  
    }

    function balanceOf(address _owner) public view returns (uint256 balance) {
        // write your code here
        return balances[_owner];
    }

    function transfer(address _to, uint256 _value) public returns (bool success) {
        // write your code here
        uint256 balance = balances[msg.sender];
        require(balance >= _value, "ERC20: transfer amount exceeds balance");
        require(_to != address(0), "ERC20: transfer to the zero address");

        // 复用balance，减少SLOAD，降低gas消耗
        balances[msg.sender] = balance - _value;
        balances[_to] += _value;

        emit Transfer(msg.sender, _to, _value);  
        return true;   
    }

    function transferWithCallback(address _to, uint256 _value) external returns (bool success) {
        require(_to != address(0), "ERC20: transfer to the zero address");
        uint256 balance = balances[msg.sender];
        require(balance >= _value, "ERC20: transfer amount exceeds balance");

        // 复用balance，减少SLOAD，降低gas消耗
        balances[msg.sender] = balance - _value;
        balances[_to] += _value;

        emit Transfer(msg.sender, _to, _value);  

        if (isContractAddr(_to)) {
            try ITokenReceiver(_to).tokensReceived(msg.sender, _value) returns (bool) {

            } catch {

            }
        }

        return true;

    }

    function isContractAddr(address _addr) internal returns (bool isContract) {
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }

        return (size > 0);
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        // address()是强制类型转换，并不是调用函数
        require(_to != address(0), "ERC20: transfer to the zero address");
        uint256 balance = balances[_from];
        require(balance >= _value, "ERC20: transfer amount exceeds balance");

        // write your code here
        require(allowances[_from][msg.sender] >= _value, "ERC20: transfer amount exceeds allowance");

        
        balances[_from] = balance - _value;
        balances[_to] += _value;
        allowances[_from][msg.sender] -= _value;
        
        emit Transfer(_from, _to, _value); 
        return true; 
    }

    function approve(address _spender, uint256 _value) public returns (bool success) {
        // write your code here
        require(_spender != address(0), "ERC20: approve to the zero address");
        allowances[msg.sender][_spender] = _value;

        emit Approval(msg.sender, _spender, _value); 
        return true; 
    }

    function allowance(address _owner, address _spender) public view returns (uint256 remaining) {   
        // write your code here     
        return allowances[_owner][_spender];
    }
}

contract TokenBank {
    // 代币合约地址
    IERC20 public token;
    
    // 记录每个用户存入的代币数量
    mapping(address => uint256) public deposits;
    
    // 存款和取款事件
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    
    // 构造函数，设置代币合约地址
    constructor(address _tokenAddress) {
        require(_tokenAddress != address(0), "TokenBank: token address cannot be zero");
        token = IERC20(_tokenAddress);
    }
    
    // 存入代币
    function deposit(uint256 _amount) external {
        // 检查金额是否大于0
        require(_amount > 0, "TokenBank: deposit amount must be greater than zero");
        
        // 检查用户是否有足够的代币
        require(token.balanceOf(msg.sender) >= _amount, "TokenBank: insufficient token balance");
        
        // 将代币从用户转移到合约
        // 注意：用户需要先调用token.approve(tokenBank地址, 金额)来授权TokenBank合约
        bool success = token.transferFrom(msg.sender, address(this), _amount);
        require(success, "TokenBank: transfer failed");
        
        // 更新用户的存款记录
        deposits[msg.sender] += _amount;
        
        // 触发存款事件
        emit Deposit(msg.sender, _amount);
    }
    
    // 提取代币
    function withdraw(uint256 _amount) external {
        // 检查金额是否大于0
        require(_amount > 0, "TokenBank: withdraw amount must be greater than zero");
        
        // 检查用户是否有足够的存款
        require(deposits[msg.sender] >= _amount, "TokenBank: insufficient deposit balance");
        
        // 更新用户的存款记录（先减少记录，再转账，防止重入攻击）
        deposits[msg.sender] -= _amount;
        
        // 将代币从合约转移回用户
        bool success = token.transfer(msg.sender, _amount);
        require(success, "TokenBank: transfer failed");
        
        // 触发提款事件
        emit Withdraw(msg.sender, _amount);
    }
    
    // 查询用户在银行中的存款余额
    function balanceOf(address _user) external view returns (uint256) {
        return deposits[_user];
    }
}


// TokenBankV2合约，支持直接通过transferWithCallback存入代币
contract TokenBankV2 is TokenBank, ITokenReceiver {
    // 扩展的ERC20代币合约地址
    ExtendedERC20 public extendedToken;

    constructor(address tokenAddr) TokenBank(tokenAddr) {
        extendedToken = ExtendedERC20(tokenAddr);
    }


    function tokensReceived(address from, uint256 amount) external returns (bool) {
        // 检查调用者是否为代币合约
        require(msg.sender == address(token), "TokenBankV2: caller is not the token contract");
        
        // 更新用户的存款记录
        deposits[from] += amount;
        
        // 触发存款事件
        emit Deposit(from, amount);
        
        return true;
    }
}