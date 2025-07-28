// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// 导入IERC20接口，用于与BERC20代币交互
interface IERC20 {
    function balanceOf(address _owner) external view returns (uint256 balance);
    function transfer(address _to, uint256 _value) external returns (bool success);
    function transferFrom(address _from, address _to, uint256 _value) external returns (bool success);
    function approve(address _spender, uint256 _value) external returns (bool success);
    function allowance(address _owner, address _spender) external view returns (uint256 remaining);
}

contract BaseERC20 is IERC20 {
    string public name; 
    string public symbol; 
    uint8 public decimals; 

    uint256 public totalSupply; 

    mapping (address => uint256) balances; 

    mapping (address => mapping (address => uint256)) allowances; 

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
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
    IERC20 public token;
    
    mapping(address => uint256) deposits;


    // 存款和取款事件
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    // 设置代币合约地址
    constructor(address tokenContractAddr) {
        require(tokenContractAddr != address(0), "tokenContractAddr can't be zero address");
        token = IERC20(tokenContractAddr);
    }

    function deposite(uint256 amount) external {
        require(amount > 0, "amount must be greater than zero");
        require(token.balanceOf(msg.sender) >= amount, "balance is not enough");
        // 注意：用户需要先调用token.approve(tokenBank地址, 金额)来授权TokenBank合约
        bool success = token.transferFrom(msg.sender, address(this), amount);
        require(success, "TokenBank: transfer failed");
        deposits[msg.sender] += amount;

        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "amount must be greater than zero");
        uint256 balance = deposits[msg.sender];
        require(balance >= amount, "balance is not enough");

        // 更新用户的存款记录（！！！先减少记录，再转账，防止重入攻击）
        deposits[msg.sender] = balance - amount;
        // 是当前TokenBank合约调用的transfer()函数，所以这里会把该合约下的BaseERC20转给msg.sender
        bool success = token.transfer(msg.sender, amount);
        require(success, "TokenBank: transfer failed");

        emit Withdraw(msg.sender, amount);
    }

    function balanceOf(address addr) external view returns (uint256) {
        return deposits[addr];
    }
}