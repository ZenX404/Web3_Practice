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
        // 这里只是起到一个记录作用。  在BankTest合约中调用的所有合约函数，默认调用者都是BankTest合约地址，因为都是在BankTest合约内完成调用的
        // 除非用作弊码vm.prank()函数来指定下一次函数调用的地址
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


        // 部署要进行测试的Bank合约。 
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
        // payable函数可以这样写调用代码，表示向合约转账，写法和call函数差不多。
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
    function testTopDepositors() public {
        // 测试场景1：只有1个用户存款
        vm.prank(user1);
        bank.deposit{value: 1 ether}();

        // 获取存款前三名
        // 同时也定义了topAddr和topBalance这两个局部变量
        (address[3] memory topAddr, uint256[3] memory topBalance) = bank.getTopBalance();
        assertEq(topAddr[2], user1);
        assertEq(topBalance[2], 1 ether);
        assertEq(topAddr[1], address(0));
        assertEq(topBalance[1], 0);
        assertEq(topAddr[0], address(0));
        assertEq(topBalance[0], 0);


        // 测试场景2：只有2个用户存款
        vm.prank(user2);
        bank.deposit{value: 2 ether}();

        // 获取存款前三名
        // 前面已经定义了这两个变量了，不需要重复声明
        (topAddr, topBalance) = bank.getTopBalance();
        assertEq(topAddr[2], user2);
        assertEq(topBalance[2], 2 ether);
        assertEq(topAddr[1], user1);
        assertEq(topBalance[1], 1 ether);
        assertEq(topAddr[0], address(0));
        assertEq(topBalance[0], 0);


        // 测试场景3：只有3个用户存款
        vm.prank(user3);
        bank.deposit{value: 1.5 ether}();

        // 获取存款前三名
        (topAddr, topBalance) = bank.getTopBalance();
        assertEq(topAddr[2], user2);
        assertEq(topBalance[2], 2 ether);
        assertEq(topAddr[1], user3);
        assertEq(topBalance[1], 1.5 ether);
        assertEq(topAddr[0], user1);
        assertEq(topBalance[0], 1 ether);


        // 测试场景4：有4个用户存款，但只记录前3名
        vm.prank(user4);
        bank.deposit{value: 0.5 ether}();
        
        (topAddr, topBalance) = bank.getTopBalance();
        assertEq(topAddr[2], user2);
        assertEq(topBalance[2], 2 ether);
        assertEq(topAddr[1], user3);
        assertEq(topBalance[1], 1.5 ether);
        assertEq(topAddr[0], user1);
        assertEq(topBalance[0], 1 ether);
        // user4不应该在前3名中
        
        // 测试场景5：同一用户多次存款
        vm.prank(user1);
        bank.deposit{value: 2 ether}();
        
        (topAddr, topBalance) = bank.getTopBalance();
        assertEq(topAddr[2], user1);
        assertEq(topBalance[2], 3 ether); // 1 + 2 = 3 ether
        assertEq(topAddr[1], user2);
        assertEq(topBalance[1], 2 ether);
        assertEq(topAddr[0], user3);
        assertEq(topBalance[0], 1.5 ether);
    }

    // 测试3：检查只有管理员可取款，其他人不可以取款
    function testOnlyOwnerCanWithDraw() public {
        // 先存入一些ETH
        vm.prank(user1);
        bank.deposit{value: 1 ether}();

        // 确认合约余额
        assertEq(address(bank).balance, 1 ether);

        // 非管理员尝试取款，应该失败
        vm.prank(user1);
        // 期望下一个函数调用应该会失败，并且失败的原因应该是 "Only admin can withdraw" 这个错误消息
        // vm.expectRevert()用来期望require()函数返回的信息
        vm.expectRevert("Only admin can withdraw");
        bank.withDraw();

        // 使用 prank 模拟管理员调用
        // 只要是public的合约变量，就都默认有一个变量名()的函数，用来调用获取该合约变量的值
        // 这里通过调用自动生成的admin()函数来获取BankContract合约的admin地址
        // 因为BankContract合约是BankTest合约内部署的，所以其实BankContract合约的admin地址就是BankTest合约地址
        address bankAdmin = bank.admin();
        uint256 adminBalanceBefore = bankAdmin.balance;
        vm.prank(bankAdmin);
        bank.withDraw();
        uint256 adminBalanceAfter = bankAdmin.balance;
        // 检查管理员余额是否增加了1 ETH
        assertEq(adminBalanceAfter - adminBalanceBefore, 1 ether);
        
        console.log("BankTest's balance: " , bankAdmin.balance);
        // 不能直接用判断合约余额的方式设置断言，因为函数调用过程中还会消耗gas，所以要用取BankTest合约余额差值的方法来设置断言，这样是最准的
        // 以后所有涉及到验证合约余额的时候都要用差值来设置断言
        //assertEq(bankAdmin.balance, 1 ether);
        // 检查合约余额为0
        assertEq(address(bank).balance, 0);
    }

    // 给测试脚本合约BankTest添加receive函数以接收ETH，
    // 如果不写receive()函数的话，在上面testOnlyOwnerCanWithDraw()函数中，
    // 调用withDraw()将BankContract合约余额转给BankTest合约时就会报错（部署BankContract合约是在BankTest合约中完成的，所以BankContract的admin地址就是BankTest合约地址），
    // 因为只有实现了receive() 或 fallback() 函数，BankContract合约才能直接接收ETH转账（不需要调用payable函数）
    receive() external payable {}
}