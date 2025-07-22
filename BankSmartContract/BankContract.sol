// SPDX-License-Identifier: MIT
pragma solidity^0.8.9;

contract BankContract {
    mapping(address => uint256) public balances;
    address private admin;
    
    uint8 private constant TOP_COUNT = 3;
    address[TOP_COUNT] public topAddr;

    // 构造函数设置合约管理员
    constructor () {
        admin = msg.sender;
    }

    // 合约收款函数
    receive() external payable {
        _handleDeposit();
    }

    // 用户主动调用的存款函数
    function deposit() external payable {
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