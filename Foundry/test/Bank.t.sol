// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

// 导入Foundry测试工具
import {Test, console} from "forge-std/Test.sol";
// 导入要测试的合约
import {BankContract} from "../src/Bank.sol";

// 测试脚本要继承Foundey提供的Test合约，这样才能使用Foundry提供的关于合约测试的一些函数
contract BankTest is Test {
    BankContract public bank;
    address public admin;
    address public user1;
    address public user2;
    address public user3;
    address public user4;

    // Foundry的测试脚本不需要写构造函数

    // 在每个测试用例执行前设置测试环境
    function setUp() public {
        // 设置管理员地址, 也就是当前测试合约的地址
        admin = address(this);

        // 创建测试用户地址
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        user4 = makeAddr("user4");

        // 通过Forge标准库的vm库合约使用作弊码，给测试用户一些ETH
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(user3, 10 ether);
        vm.deal(user4, 10 ether);


        // 部署要进行测试的Bank合约
        bank = new BankContract();
    }


    /**
     * 测试Case 包含：
        1、断言检查存款前后用户在 Bank 合约中的存款额更新是否正确。
        2、检查存款金额的前 3 名用户是否正确，分别检查有1个、2个、3个、4 个用户， 以及同一个用户多次存款的情况。
        3、检查只有管理员可取款，其他人不可以取款。
     */


    // 测试1：检查存款前后用户在Bank合约中的存款额更新是否正确
    function testDeposit() public {
        // 初始存款额应为0
        // 这个balances就是BankContract合约中的balances合约变量，
        // 因为这个变量设置的是public，而且solidity有对mapping使用()进行key索引的语法支持
        // 所以下面可以直接通过balances(user1)获取mapping balances中key为user1对应的余额
        assertEq(bank.balances(user1), 0);

        // 用户1存款1 ETH
        uint256 depositAmount = 1 ether;
        // Foundry 作弊码，让下一个函数调用以 user1 身份执行
        vm.prank(user1);
        // user1存款depositAmount个ETH
        bank.deposit{value: depositAmount}();

        // 检查存款后余额是否正确
        assertEq(bank.balances(user1), depositAmount);

        // 再次存款0.5 ETH
        uint256 secondDepositAmount = 0.5 ether;
        vm.prank(user1);
        bank.deposit{value: secondDepositAmount}();
        
        // 检查总存款额是否正确
        assertEq(bank.balances(user1), depositAmount + secondDepositAmount);
    }

    // 测试2：检查存款金额的前3名用户是否正确

    // 测试3：检查只有管理员可取款，其他人不可以取款
}