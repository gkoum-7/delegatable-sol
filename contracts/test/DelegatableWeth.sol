//SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../Delegatable.sol";

contract DelegatableWeth is ERC20, Delegatable {
    constructor(
        string memory name,
        string memory symbol
    ) Delegatable(name, "1") ERC20(name, symbol) {}

    function deposit() public payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint wa) public {
        require(balanceOf(msg.sender) >= wa, "DelegatableWeth:insufficient-funds");
        _burn(msg.sender, wa);
        (bool sent, ) = msg.sender.call{value: wa}("");
        require(sent, "DelegatableWeth:eth-send-failed");
    }

    function _msgSender()
        internal
        view
        override(DelegatableCore, Context)
        returns (address sender)
    {
        if (msg.sender == address(this)) {
            bytes memory array = msg.data;
            uint256 index = msg.data.length;
            assembly {
                sender := and(
                    mload(add(array, index)),
                    0xffffffffffffffffffffffffffffffffffffffff
                )
            }
        } else {
            sender = msg.sender;
        }
        return sender;
    }
}
