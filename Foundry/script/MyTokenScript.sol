// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

// 引入Foundry提供的工具
import {Script, console} from "forge-std/Script.sol";
// 引入要部署的合约
import {MyToken} from "../src/MyToken.sol";


contract MyTokenScript is Script {

    function setUp() public {}

    // 部署MyToken合约
    function run() public {
       
        // 开启交易广播模式，在这之后的所有合约调用和部署都会作为实际交易发送到区块链网络
        vm.startBroadcast();

        // 部署代币合约，传入名称和符号
        MyToken token = new MyToken("MyToken", "MTK");
        
        // 结束交易广播模式，停止记录和发送交易。
        vm.stopBroadcast();
    }
}
