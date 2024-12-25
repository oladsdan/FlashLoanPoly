/**
 * @title MyFlashLoanProject
 * @author laids
 * @version 1.0
 * @dev MyFlashLoanProject
 * 1. we want to create a flashloan contract that dynamically takes diff dex to trade with
 * 2. we test if the contract actually recieves the flashloan
 */

// import { ethers } from "hardhat";
import pkg from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
// we import the abi to interact with the contract
// import {abi as abiFlashLoan} from "../artifacts/contracts/Flashloan.sol/Flashloan.json"





const {ethers} = pkg;

const AAVE_POOL_PROVIDER = "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb"//pool address for polygon matic

const BORROWED_USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"
// const BORROWED_USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"

const FLASHLOAN_AMOUNT = ethers.utils.parseUnits("100", 6); // borrowing 100 usdt
const WHALE_ADDR = "0x1AB4973a48dc892Cd9971ECE8e01DcC7688f8F23"
const richUSUSDTAddress = "0x1AB4973a48dc892Cd9971ECE8e01DcC7688f8F23";

// tokens we perform trades with
const USDT_ADDRESS =  BORROWED_USDT_ADDRESS;
const WETH = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";

//the router to use
const QuickSwapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
const BalancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
const UniswapV3 = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

describe("MyFlashLoanProject", function () {


    async function create_whale() {
        const provider = ethers.provider;
        const whaleBalance = await provider.getBalance(WHALE_ADDR);
        expect(whaleBalance).to.greaterThan(0);
        //expect(whaleBalance).not.equal(0);


        //now we impersonate whale accoutn
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [WHALE_ADDR],
        });
        const whaleWallet = ethers.provider.getSigner(WHALE_ADDR);
        expect(await whaleWallet.getBalance()).not.equal(0);

       
        // const contractUsdt = new ethers.Contract(BORROWED_USDT_ADDRESS, provider);
        // const balanceUsdt = await contractUsdt.balanceOf(WHALE_ADDR);
        // console.log("Balance Usdt whale: ", balanceUsdt);
        // expect(balanceUsdt).not.equal(0);


        // Return output
        return { whaleWallet };


    }


    describe("testing the components of the flashloan", function() {
        it("it deploys a flashloan and receives the flashloan then performs swap", async function () {

            this.timeout(60000)
            
            let {whaleWallet} = await loadFixture(create_whale);

            const MyFlashLoanProject = await ethers.getContractFactory("Flashloan");
            const myFlashLoanProject = await MyFlashLoanProject.deploy(AAVE_POOL_PROVIDER);
            await myFlashLoanProject.deployed();
    
            console.log("myFlashLoanProject deployed to:", myFlashLoanProject.address);



            //fund the flashloan contract
            const maticAmount = ethers.utils.parseEther("1");
            await network.provider.send("hardhat_setBalance", [
                myFlashLoanProject.address,
                maticAmount.toHexString(),
            ])

            console.log(`Funded FlashLoan contract with ${ethers.utils.formatEther(maticAmount)} MATIC`);


            // //we fund the contract with a bit of Matic for gas fees
            // const [signer] = await ethers.getSigners();
            // await signer.sendTransaction({
            //     to: myFlashLoanProject.address,
            //     value: ethers.utils.parseEther("10"), // Send 1 MATIC
            // });

            //Impersonate the rich USDC holder
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [richUSUSDTAddress],
            });
            const impersonatedSigner = await ethers.getSigner(richUSUSDTAddress);
            const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", BORROWED_USDT_ADDRESS);
    
    
        
            // Transfer USDC to the flash loan contract
            const transferAmount = ethers.utils.parseUnits("10", 6); // 1000 USDC
            await usdt.connect(impersonatedSigner).transfer(myFlashLoanProject.address, transferAmount);
            console.log(`Transferred ${ethers.utils.formatUnits(transferAmount, 6)} USDT to FlashLoan contract`);

            // we check the contract iniail balance
            const initialBalance = await getTokenBalance(BORROWED_USDT_ADDRESS, myFlashLoanProject.address);
            console.log("Initial USDT balance of contract:", ethers.utils.formatUnits(initialBalance, 6));


            //first we add dex
            await myFlashLoanProject.addDex("UniswapV2", QuickSwapRouter, 0); // DexType 0: UniswapV2
            await myFlashLoanProject.addDex("Balancer", BalancerVault, 2); // DexType 2: Balancer

            console.log("Dex Added successfully")

            //paths to take
            const path1 = [USDT_ADDRESS, WETH];
            const path2 = [WETH, USDT_ADDRESS];



            //now we execute the flashloan
            console.log("Requesting flashloan...");

            //
            const contractFlashLoan = new ethers.Contract(myFlashLoanProject.address, myFlashLoanProject.interface, impersonatedSigner);
    
            // const tx = await  myFlashLoanProject.requestFlashLoan("UniswapV2", "UniswapV3", FLASHLOAN_AMOUNT, path1, path2);
            
            const tx = await  contractFlashLoan.requestFlashLoan("UniswapV2", "Balancer", FLASHLOAN_AMOUNT, path1, path2);
            
            // Wait for the transaction receipt
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);

            // Check the balance after the loan is received
            // const balanceAfterLoan = await getTokenBalance(BORROWED_USDT_ADDRESS, myFlashLoanProject.address);
            // console.log("Balance after receiving loan:", ethers.utils.formatUnits(balanceAfterLoan, 6));
    
            // // Ensure the contract received the loan amount
            // expect(balanceAfterLoan).to.be.lte(FLASHLOAN_AMOUNT);
            
            
            // check the balance after the loan is repaid
            const finalBalance = await getTokenBalance(BORROWED_USDT_ADDRESS, myFlashLoanProject.address);
            console.log("Final balance after loan repayment:", ethers.utils.formatUnits(finalBalance, 6));
            
            // Ensure the final balance is paid
            expect(finalBalance).to.be.lte(transferAmount);
            // expect(ethers.utils.formatUnits(balanceAfterLoan, 6)).to.be.lte(ethers.utils.formatUnits(transferAmount, 6));
            // expect(ethers.utils.formatUnits(finalBalance, 6)).to.be.lessThan(ethers.utils.formatUnits(transferAmount, 6));

            

            console.log("Flash loan executed and repaid successfully.");
    
            console.log("Transaction receitp", receipt)
            
            
            //Utility function to get token balance
            async function getTokenBalance(tokenAddress, account) {
                const ERC20 = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", tokenAddress);
                return await ERC20.balanceOf(account);
            }
            


        });

    })

   
});

