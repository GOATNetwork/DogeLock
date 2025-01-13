// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract TokenClaimerUpgradeable is OwnableUpgradeable {
    event SetAmount(address indexed user, uint256 amount);
    event Claim(address indexed user, uint256 amount);

    mapping(address => uint256) public amount;

    function initialize(address _owner) public initializer {
        __Ownable_init(_owner);
    }

    function setAmountBatch(address[] calldata _users, uint256[] calldata _amounts) external payable onlyOwner {
        require(_users.length == _amounts.length, "length mismatch");
        uint256 totalAmount;
        for (uint256 i = 0; i < _users.length; i++) {
            _setAmount(_users[i], _amounts[i]);
            totalAmount += _amounts[i];
        }
        require(msg.value >= totalAmount, "incorrect value");
    }

    function _setAmount(address _user, uint256 _amount) internal {
        require(_user != address(0), "zero address");
        require(_amount > 0, "zero amount");
        amount[_user] = _amount;
        emit SetAmount(_user, _amount);
    }

    function claim() external {
        uint256 amountToClaim = amount[msg.sender];
        amount[msg.sender] = 0;
        require(amountToClaim > 0, "nothing to claim");
        payable(msg.sender).transfer(amountToClaim);
        emit Claim(msg.sender, amountToClaim);
    }

    function withdraw() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    receive() external payable {}
}
