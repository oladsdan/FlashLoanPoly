//SPDX-License-Identifier: MIT

// we want to create a flashloan contract that dynamically takes diff dex to trade with

pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {FlashLoanSimpleReceiverBase} from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import {Ivault} from "@balancer-labs/v2-interfaces/contracts/vault/iVault.sol";
import {IVault} from "@balancer-labs/v2-interfaces/contracts/vault/IVault.sol";
// import {ethers} from "ethers";
import {IAsset} from "@balancer-labs/v2-interfaces/contracts/vault/IAsset.sol";

contract Flashloan is FlashLoanSimpleReceiverBase {
    // we create an enum for the dexes we want to trade with

    enum DexType {
        UniswapV2,
        UniswapV3,
        Balancer
    }

    // then a struct for the dexes

    struct Dex {
        address router;
        DexType dexType;
    }

    // store the dexes in a mapping
    mapping(string => Dex) public dexes;

    address private owner;
    bytes32 private BalancerPoolId = 0x8f8ef111b67c04eb1641f5ff19ee54cda062f163000200000000000000000000;

    event FlashLoanRequested(address token, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor(
        address _addressProviderr
    ) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProviderr)) {
        owner = msg.sender;
    }

    //To add the Dexes
    function addDex(
        string memory dexName,
        address router,
        DexType dexType
    ) external onlyOwner {
        dexes[dexName] = Dex(router, dexType);
    }

    function _place_swap(
        string memory dexName,
        uint256 amountIn,
        address[] memory path
    ) internal returns (uint256 amountOut) {
        Dex memory dex = dexes[dexName];
        require(dex.router != address(0), "DEX not found");

        if (dex.dexType == DexType.UniswapV2) {
            IERC20(path[0]).approve(dex.router, amountIn);
            uint256[] memory amounts = IUniswapV2Router02(dex.router)
                .swapExactTokensForTokens(
                    amountIn,
                    1,
                    path,
                    address(this),
                    block.timestamp
                );

            return amounts[amounts.length - 1];
        } else if (dex.dexType == DexType.UniswapV3) {
            IERC20(path[0]).approve(dex.router, amountIn);
            uint256 amountOutMinimum = 0;
            uint160 sqrtPriceLimitX96 = 0;
            uint24 _v3_fee = 500;

            //we perform the swap
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
                .ExactInputSingleParams({
                    tokenIn: path[0],
                    tokenOut: path[1],
                    fee: _v3_fee,
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: amountIn,
                    amountOutMinimum: amountOutMinimum,
                    sqrtPriceLimitX96: sqrtPriceLimitX96
                });

            return ISwapRouter(dex.router).exactInputSingle(params);
        } else if (dex.dexType == DexType.Balancer) {
            IERC20(path[0]).approve(dex.router, amountIn);

            //perform Balancer Batch Swap
            


            IVault.FundManagement memory funds = IVault.FundManagement({
                sender: address(this),
                fromInternalBalance: false,
                recipient: payable(address(this)),
                toInternalBalance: false
            });

            // IBalancer.BatchSwapStep memory swap = IBalancer.BatchSwapStep({
            //     poolId: BalancerPoolId,
            //     assetInIndex: 0,
            //     assetOutIndex: 1,
            //     amount: amountIn,
            //     userData: "0x"
            // });
            IVault.SingleSwap memory singleSwap = IVault.SingleSwap({
                poolId: BalancerPoolId,
                kind: IVault.SwapKind.GIVEN_IN,
                assetIn: IAsset(path[0]),
                assetOut:IAsset(path[1]),
                amount: amountIn,
                userData: "0x"
            });

            // Define the limits
            //  uint256[] memory limits = new uint256[](2);
            //  limits[0] = amountIn; // Positive for input token
            //  limits[1] = type(uint256).max; // Negative for output token

            uint256 limits = amountIn;

            // amountOut = IBalancer(dex.router).swap(
            //     singleSwap,
            //     funds,
            //     limits,
            //     block.timestamp
            // );
            // return amountOut;

            amountOut = IVault(dex.router).swap(
                singleSwap,
                funds,
                limits,
                block.timestamp
            );
            return amountOut;

            // return IBalancer(dex.router).batchSwap(0, [swap], path, funds, limits, block.timestamp);
        }
        revert("Unsupported DEX type");
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(POOL), "Caller is not the pool");
        require(initiator == address(this), "Initiator invalid");

        // my logic goes here

        (
            string memory dex1Name,
            string memory dex2Name,
            address[] memory path1,
            address[] memory path2
        ) = abi.decode(params, (string, string, address[], address[]));

        //so we perform the firstSwap

        uint256 intermediateAmount = _place_swap(dex1Name, amount, path1);

        console.log("This is the intermediate amount",intermediateAmount);

        //second swap
        uint256 finalAmount = _place_swap(dex2Name, intermediateAmount, path2);
        
        console.log("This is the final amount",finalAmount);

        //then we approve the pool to transfer the tokens
        uint256 amountOwed = amount + premium;
        console.log("This is the amount owed",amountOwed);

         uint256 balanceAfter = IERC20(asset).balanceOf(address(this));
        require(balanceAfter >= amount + premium, "Repayment balance insufficient");

        console.log("BalanceAfter the swap", balanceAfter);

        require(balanceAfter > amountOwed, "Arbitrage not profitable");

        IERC20(asset).approve(address(POOL), amountOwed);

        // ////then we pay ourself the balance
        // uint256 balance = IERC20(asset).balanceOf(address(this));
        // require(balance > 0, "No funds to recover");
        // IERC20(asset).transfer(owner, balance);
        

        return true;
    }

    // function formatTokenAmount(address tokenAddress, uint256 rawAmount) public view returns (string memory) {
    //     uint8 decimals = IERC20(tokenAddress).decimals();
    //     uint256 factor = 10 ** decimals;
    //     uint256 wholePart = rawAmount / factor;
    //     uint256 fractionalPart = rawAmount % factor;

    //     return string(abi.encodePacked(
    //         uintToString(wholePart),
    //         ".",
    //         uintToString(fractionalPart)
    //     ));
    // }

    function requestFlashLoan(
        string memory dex1Name,
        string memory dex2Name,
        uint256 _amount,
        address[] memory path1,
        address[] memory path2
    ) public {
        address receiverAddress = address(this);
        address asset = path1[0];
        uint256 amount = _amount;
        bytes memory params = abi.encode(dex1Name, dex2Name, path1, path2);
        uint16 referralCode = 0;

        emit FlashLoanRequested(asset, amount);
        console.log(path1[0]);
        POOL.flashLoanSimple(
            receiverAddress,
            asset,
            amount,
            params,
            referralCode
        );
        
    }

    // we recover funds left
    // function recoverFunds(address token) external onlyOwner {
    //     uint256 balance = IERC20(token).balanceOf(address(this));
    //     require(balance > 0, "No funds to recover");
    //     IERC20(token).transfer(owner, balance);
    // }

    // recieve() external payable {}
}
