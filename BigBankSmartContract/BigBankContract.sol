// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IBank {
    function deposit() external payable;
    function getTopBalance() external view returns (address[3] memory, uint256[3] memory);
    function withDraw() external;
}

contract Bank is IBank {
    mapping(address => uint256) public balances;
    address public admin;
    
    uint8 private constant TOP_COUNT = 3;
    address[TOP_COUNT] public topAddr;

    // 构造函数设置合约管理员
    constructor () {
        admin = msg.sender;
    }

    // 合约收款函数
    receive() external payable virtual {
        _handleDeposit();
    }

    // 用户主动调用的存款函数
    function deposit() external payable virtual {
        _handleDeposit();
    }

    function _handleDeposit() internal {
        balances[msg.sender] += msg.value;
        _updateTopBalance(msg.sender);
    }

    // 更新存款金额前TOP的用户
    function _updateTopBalance(address depositor) internal {
        uint256 balance = balances[depositor];

        for (uint256 i = 0; i < TOP_COUNT; i++) {
            if (depositor == topAddr[i]) {
                _updateTop();
                return;
            }
        }

        uint256 index = 0;
        while (index < TOP_COUNT) {
            if (balance <= balances[topAddr[index]]) {
                break;
            }
            index++;
        }

        if (index != 0) {
            topAddr[0] = depositor;
            _updateTop();
        }
    }

    // 更新存款金额前TOP的用户排序
    function _updateTop() internal {
        for (uint256 i = 0; i < TOP_COUNT - 1; i++) {
            for (uint256 j = 0; j < TOP_COUNT - i - 1; j++) {
                if (balances[topAddr[j]] > balances[topAddr[j + 1]]) {
                    address temp = topAddr[j];
                    topAddr[j] = topAddr[j + 1];
                    topAddr[j + 1] = temp;
                }
            }
        }
    }

    // 获取前TOP名的存款
    function getTopBalance() external view returns (address[TOP_COUNT] memory, uint256[TOP_COUNT] memory) {
       
        uint256[TOP_COUNT] memory topBalance;
        for (uint8 i = 0; i < TOP_COUNT; i++) {
            topBalance[i] = balances[topAddr[i]];
        }

        return (topAddr, topBalance);
    }

    // 合约管理员提取合约金额
    function withDraw() external {
        require(msg.sender == admin, "Only admin can withdraw");

        uint256 totalBalance = address(this).balance;

        require(totalBalance > 0, "No balance to withdraw");

        // 将合约的所有ETH转给管理员
        // 将当前合约（因为call函数是被当前智能合约执行的）中的资金转给admin这个地址
        (bool success, ) = admin.call{value : totalBalance}("");
        require(success, "Withdrawal failed");
    }
}

contract BigBank is Bank {
    address public immutable owner;

    constructor() {
        owner = msg.sender;
    }

    // 函数修改器modifier要求存款金额大于0.001 ether才能存款
    modifier depositAmountGreaterThan001() {
        require(msg.value > 0.001 ether, "Deposit amount must be greater than 0.001 ether");
        _;
    }

    // 合约收款函数
    receive() external payable override {
        require(msg.value > 0.001 ether, "Deposit amount must be greater than 0.001 ether");
        _handleDeposit();
    }

    // 用户主动调用的存款函数
    function deposit() external payable override depositAmountGreaterThan001 {
        _handleDeposit();
    }

    function changeAdmin(address newAdmin) external {
        require(msg.sender == owner, "must be contract's owner");
        require(newAdmin != address(0), "New admin cannot be zero address");
        admin = newAdmin;
    }

}


contract Admin {
    address public immutable owner;

    constructor() {
        owner = msg.sender;
    }

    // 添加receive函数以接收ETH
    receive() external payable {}

    // 此时bank合约的amidn地址必须是Admin合约的合约地址，该函数才能执行成功，因为bank.withDraw()调用者地址必须是bank合约的admin才行
    function adminWithdraw(IBank bank) external {
        require(msg.sender == owner, "must be contract's owner");

        bank.withDraw();
    }

    function withDrawToOwner() external {
        require(msg.sender == owner, "must be contract's owner");
        uint256 balance = address(this).balance;
        require(balance > 0, "no money to withdraw");

        (bool success, ) = owner.call{value : balance}("");
        require(success, "Withdrawal failed");
    }
}