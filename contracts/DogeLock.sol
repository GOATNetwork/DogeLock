// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { OFTAdapter } from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";
import { SendParam, OFTReceipt, MessagingReceipt, MessagingFee } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract DogeLock is OFTAdapter {
    using SafeERC20 for IERC20;

    event Lock(address user, uint256 amount, uint256 blockNumber);
    event Unlock(address user, uint256 amount, uint256 blockNumber);

    error InvalidAmount();
    error ExceededAmount();

    uint256 public maxLockAmount = 20_000_000 ether;
    uint256 public personalMaxLockAmount = 5_000_000 ether;
    uint256 public personalMinLockAmount = 50 ether;

    uint256 constant UNLOCK_TIME = 123456789; // unlock timestamp;

    IERC20 public immutable dogeCoin;
    mapping(address user => uint256 balance) public balances;

    constructor(
        address _dogeCoin,
        address _lzEndpoint
    ) OFTAdapter(_dogeCoin, _lzEndpoint, msg.sender) Ownable(msg.sender) {
        dogeCoin = IERC20(_dogeCoin);
    }

    function addressToBytes32(address _addr) public pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    function setMax(uint256 _amount) external onlyOwner {
        maxLockAmount = _amount;
    }

    function setPersonalLimit(uint256 _max, uint256 _min) external onlyOwner {
        require(_max > _min, InvalidAmount());
        personalMaxLockAmount = _max;
        personalMinLockAmount = _min;
    }

    function lock(uint256 _amount) external {
        require(_amount > 0, InvalidAmount());
        dogeCoin.safeTransferFrom(msg.sender, address(this), _amount);
        balances[msg.sender] += _amount;
        emit Lock(msg.sender, _amount, block.number);
    }

    function unlock(uint256 _amount) external {
        require(_amount <= balances[msg.sender], ExceededAmount());
        balances[msg.sender] -= _amount;
        dogeCoin.safeTransfer(msg.sender, _amount);
        emit Unlock(msg.sender, _amount, block.number);
    }

    function bridge(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable virtual returns (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) {
        return _send(_sendParam, _fee, _refundAddress);
    }

    function _debit(
        address _from,
        uint256 _amountLD,
        uint256 _minAmountLD,
        uint32 _dstEid
    ) internal override returns (uint256 amountSentLD, uint256 amountReceivedLD) {
        (amountSentLD, amountReceivedLD) = _debitView(_amountLD, _minAmountLD, _dstEid);
        balances[_from] -= amountSentLD;
    }
}
