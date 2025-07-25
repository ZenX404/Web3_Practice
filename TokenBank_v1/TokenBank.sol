// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


contract BaseERC20 {
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