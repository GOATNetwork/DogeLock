// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenClaimer is OwnableUpgradeable {
    event SetAmount(address indexed user, uint256 amount);
    event Claim(address indexed user, address indexed to, uint256 amount);

    mapping(address => uint256) public amount;

    function initialize(address _owner) public initializer {
        __Ownable_init(_owner);
    }

    function setAmount(address _user, uint256 _amount) external onlyOwner {
        require(_user != address(0), "zero address");
        require(_amount > 0, "zero amount");
        amount[_user] = _amount;
        emit SetAmount(_user, _amount);
    }

    function claim(address _to) external {
        require(_to != address(0), "zero address");
        uint256 amountToClaim = amount[msg.sender];
        amount[msg.sender] = 0;
        require(amountToClaim > 0, "nothing to claim");
        payable(_to).transfer(amountToClaim);
        emit Claim(msg.sender, _to, amountToClaim);
    }

    receive() external payable {}
}
