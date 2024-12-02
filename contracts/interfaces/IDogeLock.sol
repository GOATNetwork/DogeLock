// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { SendParam } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

interface IDogeLock {
    // Events
    event Lock(address user, uint256 amount, uint256 blockNumber);
    event Unlock(address user, uint256 amount, uint256 blockNumber);
    event Bridge(address user, uint256 amount, SendParam sendParam);

    // Custom errors
    error InvalidAddress();
    error InvalidAmount();
    error ExceededBalance(uint256);
    error ExceededTotalBalance(uint256);
    error ExceededPersonalMax(uint256);
    error ExceededTotalMax(uint256);
    error BelowMin();
    error TimeNotReached();

    /**
     * @dev Owner function to set the max total locking amount of Dogecoin
     * @param _amount The new max total locking amount
     */
    function setMax(uint256 _amount) external;

    /**
     * @dev Owner function to set the max/min locking amount of Dogecoin for each user
     * @param _max The new max locking amount
     * @param _min The new min locking amount
     */
    function setPersonalLimit(uint256 _max, uint256 _min) external;

    /**
     * @dev Lock user's Dogecoin into this contract
     * @param _amount The amount the user wishes to lock
     * @dev The amount and lock time is recorded for points calculation on Goat Network
     * @dev The user must approve the amount before calling this function
     * @dev The final amount cannot be less than the personal min or more than personal/total max
     */
    function lock(uint256 _amount) external;

    /**
     * @dev Unlock user's Dogecoin from this contract
     * @param _amount The amount the user wishes to unlock
     * @dev The amount and unlock time is recorded for points calculation on Goat Network
     */
    function unlock(uint256 _amount) external;
}
