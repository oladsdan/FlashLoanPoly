require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
// import { network } from "hardhat";





const mainnet_polygon_url = process.env.MAINNET_PROVIDER_URL;
const testnet_provider_url = process.env.TESTNET_PROVIDER_URL;
const accounts = process.env.PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.10",
  networks: {
    hardhat: {
      forking: {
        url: mainnet_polygon_url,
      },
    },
    mainnet: {
      url: mainnet_polygon_url,
      chainId: 137,
      accounts: [`0x${accounts}`]
    },
    mumbai: {
      url: testnet_provider_url,
      chainId: 80001,
      accounts: [`0x${accounts}`]
    }
  }
};






// require("@nomicfoundation/hardhat-toolbox");
// require("dotenv").config();

// module.exports = {
//     solidity: "0.8.0",
//     networks: {
//         hardhat: {
//             forking: {
//                 url: process.env.POLYGON_RPC_URL,
//             },
//         },
//         polygon: {
//             url: process.env.POLYGON_RPC_URL,
//             accounts: [`0x${process.env.PRIVATE_KEY}`],
//         },
//         mumbai: {
//             url: "https://polygon-mumbai.infura.io/v3/" + process.env.POLYGON_RPC_URL,
//             accounts: [`0x${process.env.PRIVATE_KEY}`],
//         },
//     },
//     mocha: {
//         timeout: 200000,
//     },
// };
