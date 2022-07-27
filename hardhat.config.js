require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()


/** @type import('hardhat/config').HardhatUserConfig */
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || ""
const RINKEBY_RPC_URL =
  process.env.RINKEBY_RPC_URL ||
  "https://eth-rinkeby.alchemyapi.io/v2/your-api-key"
const PRIVATE_KEY =
  process.env.PRIVATE_KEY ||
  "0x11ee3108a03081fe260ecdc106554d09d9d1209bcafd46942b10e02943effc4a"
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ""
const REPORT_GAS = process.env.REPORT_GAS || false


module.exports = {
  defaultNetwork: "hardhat",
  networks: {
      hardhat: {
          // // If you want to do some forking, uncomment this
          // forking: {
          //   url: MAINNET_RPC_URL
          // }
          chainId: 31337,
      },
      localhost: {
          chainId: 31337,
      },
      
      rinkeby: {
          url: RINKEBY_RPC_URL,
          accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
          //   accounts: {
          //     mnemonic: MNEMONIC,
          //   },
          saveDeployments: true,
          chainId: 4,
      },
      
  },
  etherscan: {
      // yarn hardhat verify --network <NETWORK> <CONTRACT_ADDRESS> <CONSTRUCTOR_PARAMETERS>
      apiKey: {
          rinkeby: ETHERSCAN_API_KEY,
         
      },
  },
  gasReporter: {
      enabled: REPORT_GAS,
      currency: "USD",
      outputFile: "gas-report.txt",
      noColors: true,
      coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  contractSizer: {
      runOnCompile: false,
      only: ["Raffle"],
  },
  namedAccounts: {
      deployer: {
          default: 0, // here this will by default take the first account as deployer
          1: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
      },
      player: {
          default: 1,
      },
  },
  solidity: {
      compilers: [
          {
              version: "0.8.7",
          },
          {
            version: "0.8.4",
          },
          {
              version: "0.4.24",
          },
      ],
  },
  mocha: {
      timeout: 500000, // 500 seconds max for running tests
  },
}
