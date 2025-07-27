// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// 必须显式引入ERC721，否则无法调用ERC721()构造函数，即使是ERC721URIStorage已经继承了ERC721合约
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";



contract MyNFT is ERC721URIStorage, Ownable {

    constructor() 
        ERC721("MyNFT", "MNFT") 
        Ownable(msg.sender) // 设置该合约所有者，这是Ownable合约的构造函数
    {}

    function mint(
        address to, 
        uint256 tokenId, 
        string calldata tokenURI
    ) external onlyOwner {
        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
    }
}