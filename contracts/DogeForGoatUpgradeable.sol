// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { OFTUpgradeable } from "@layerzerolabs/oft-evm-upgradeable/contracts/oft/OFTUpgradeable.sol";
import { SendParam, OFTReceipt, MessagingReceipt, MessagingFee } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IDogeLock } from "./interfaces/IDogeLock.sol";

/**
 * @dev Locking and bridging contract for Dogecoin.
 */
contract DogeForGoatUpgradeable is IDogeLock, OFTUpgradeable {
    using SafeERC20 for IERC20;

    IERC20 public immutable dogeCoin;
    uint256 public immutable bridgeTime;

    // Conversion rate from Dogecoin (8 decimals) to Wrapped Dogecoin (18 decimals)
    uint256 private constant CONVERSION_MULTIPLIER = 10 ** 10;

    uint256 public maxLockAmount;
    uint256 public personalMaxLockAmount;
    uint256 public personalMinLockAmount;

    mapping(address user => uint256 balance) public balances;
    uint256 public totalBalance;

    /**
     * @dev Constructor for the DogeLockUpgradeable contract.
     * @param _dogeCoin The address of the Dogecoin token.
     * @param _lzEndpoint The LayerZero endpoint address.
     * @param _bridgeTime Time the users can bridge their tokens to Goat Network
     */
    constructor(address _dogeCoin, address _lzEndpoint, uint256 _bridgeTime) OFTUpgradeable(_lzEndpoint) {
        bridgeTime = _bridgeTime;
        dogeCoin = IERC20(_dogeCoin);
    }

    /**
     * @dev Initializes the DogeLockUpgradeable with the provided owner and locking limits.
     * @param _owner The owner/delegate of the contract/OFTAdapter
     */
    function initialize(address _owner) external initializer {
        __OFT_init("Doge For Goat", "DFG", _owner);
        __Ownable_init(_owner);
        maxLockAmount = 20_000_000 ether;
        personalMaxLockAmount = 5_000_000 ether;
        personalMinLockAmount = 50 ether;
    }

    /**
     * @dev Helper function to convert address to Bytes32 for peer setup
     * @param _addr The address needed to be converted
     * @return The converted address
     */
    function addressToBytes32(address _addr) external pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    /**
     * @dev Owner function to set the max total locking amount of Dogecoin
     * @param _amount The new max total locking amount
     */
    function setMax(uint256 _amount) external onlyOwner {
        require(_amount >= totalBalance, InvalidAmount());
        maxLockAmount = _amount;
    }

    /**
     * @dev Owner function to set the max/min locking amount of Dogecoin for each user
     * @param _max The new max locking amount
     * @param _min The new min locking amount
     */
    function setPersonalLimit(uint256 _max, uint256 _min) external onlyOwner {
        require(_max > _min, InvalidAmount());
        personalMaxLockAmount = _max;
        personalMinLockAmount = _min;
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    /**
     * @dev Allow a user to deposit underlying tokens and mint the corresponding number of wrapped tokens.
     */
    function deposit(uint256 value) public {
        dogeCoin.safeTransferFrom(msg.sender, address(this), value);
        _mint(msg.sender, value * CONVERSION_MULTIPLIER);
    }

    /**
     * @dev Allow a user to burn a number of wrapped tokens and withdraw the corresponding number of underlying tokens.
     */
    function withdraw(uint256 value) public {
        _burn(msg.sender, value);
        dogeCoin.safeTransfer(msg.sender, value / CONVERSION_MULTIPLIER);
    }

    /**
     * @dev Lock user's Dogecoin into this contract
     * @param _amount The amount the user wishes to lock
     * @dev The amount and lock time is recorded for points calculation on Goat Network
     * @dev The user must approve the amount before calling this function
     * @dev The final amount cannot be less than the personal min or more than personal/total max
     */
    function lock(uint256 _amount) external {
        deposit(_amount);
        _amount *= CONVERSION_MULTIPLIER;
        require(_amount >= personalMinLockAmount, BelowMin());
        balances[msg.sender] += _amount;
        totalBalance += _amount;
        require(balances[msg.sender] <= personalMaxLockAmount, ExceededPersonalMax(balances[msg.sender]));
        require(totalBalance <= maxLockAmount, ExceededTotalMax(totalBalance));
        emit Lock(msg.sender, _amount, block.number);
    }

    /**
     * @dev Unlock user's Dogecoin from this contract
     * @param _amount The amount the user wishes to unlock
     * @dev The amount and unlock time is recorded for points calculation on Goat Network
     */
    function unlock(uint256 _amount) external {
        require(_amount <= balances[msg.sender], ExceededBalance(balances[msg.sender]));
        balances[msg.sender] -= _amount;
        totalBalance -= _amount;
        withdraw(_amount);
        emit Unlock(msg.sender, _amount, block.number);
    }

    /**
     * @dev Bridge user's Dogecoin onto Goat Network
     * @param _sendParam The bridging operation paramters
     * @param _fee The calculated fee for the bridge() operation.
     *      - nativeFee: The native fee.
     *      - lzTokenFee: The lzToken fee.
     * @param _refundAddress The address to receive any excess funds.
     * @return msgReceipt The receipt for the send operation.
     * @return oftReceipt The OFT receipt information.
     * @dev The amount and unlock time is recorded for points calculation on Goat Network
     */
    function bridge(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable override returns (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) {
        require(block.timestamp >= bridgeTime, TimeNotReached());
        // @dev Applies the token transfers regarding this bridge() operation.
        // - amountSentLD is the amount in local decimals that was ACTUALLY sent/debited from the sender.
        // - amountReceivedLD is the amount in local decimals that will be received/credited to the recipient on the remote OFT instance.
        (uint256 amountSentLD, uint256 amountReceivedLD) = _bridgeDebit(
            msg.sender,
            _sendParam.amountLD,
            _sendParam.minAmountLD,
            _sendParam.dstEid
        );

        // @dev Builds the options and OFT message to quote in the endpoint.
        // @param message encoded (address(to), amountSD, composed message)
        (bytes memory message, bytes memory options) = _buildMsgAndOptions(_sendParam, amountReceivedLD);

        // @dev Sends the message to the LayerZero endpoint and returns the LayerZero msg receipt.
        msgReceipt = _lzSend(_sendParam.dstEid, message, options, _fee, _refundAddress);
        // @dev Formulate the OFT receipt.
        oftReceipt = OFTReceipt(amountSentLD, amountReceivedLD);

        emit OFTSent(msgReceipt.guid, _sendParam.dstEid, msg.sender, amountSentLD, amountReceivedLD);
    }

    /**
     * @dev Decrease token balance of the sender
     * @param _from The address to debit from.
     * @param _amountLD The amount of tokens to send in local decimals.
     * @param _minAmountLD The minimum amount to send in local decimals.
     * @param _dstEid The destination chain ID.
     * @return amountSentLD The amount sent in local decimals.
     * @return amountReceivedLD The amount received in local decimals on the remote.
     */
    function _bridgeDebit(
        address _from,
        uint256 _amountLD,
        uint256 _minAmountLD,
        uint32 _dstEid
    ) internal returns (uint256 amountSentLD, uint256 amountReceivedLD) {
        // @dev return the amount after removeDust(), check if it's below the min amount
        (amountSentLD, amountReceivedLD) = _debitView(_amountLD, _minAmountLD, _dstEid);
        balances[_from] -= amountSentLD;
    }
}
