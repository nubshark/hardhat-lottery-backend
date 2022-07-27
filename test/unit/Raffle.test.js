const { inputToConfig } = require("@ethereum-waffle/compiler");
const { assert, expect } = require("chai");
const { network, ethers, deployments } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");



!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function(){
        let raffle, raffleContract, vrfCoordinatorV2Mock, raffleEntranceFee, interval, player

        beforeEach(async() => {
            accounts = await ethers.getSigners()
            player = accounts[1]
            await deployments.fixture(["mocks","raffle"])
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
            raffleContract = await ethers.getContract("Raffle")
            raffle = raffleContract.connect(player)
            raffleEntranceFee= await raffle.getEntranceFee()
            interval = await raffle.getInterval()

        })

        describe ("constructor", function(){
            it("initializes the raffle correctly", async () => {
                const raffleState = (await raffle.getRaffleState()).toString()
                assert.equal(raffleState,"0")
                assert.equal(interval.toString(), networkConfig[network.config.chainId]["keepersUpdateInterval"])
            })
            
        })
        
        describe("enterRaffle", function () {
            it("reverts when you dont pay enough", async () => {
                await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__SendMoreToEnterRaffle")
            })

            it("records player when they enter", async () =>{
                await raffle.enterRaffle({value: raffleEntranceFee})
                const contractPlayer = await raffle.getPlayer(0)
                assert.equal(player.address, contractPlayer)
            })

            it("emits event on enter", async () => {
                await expect(raffle.enterRaffle({value : raffleEntranceFee})).to.emit(raffle,"RaffleEnter")
            })

            it("doesnt allow entrance when raffle is calculating", async () => {
                await raffle.enterRaffle({value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime",[interval.toNumber() +1])
                await network.provider.request({method: "evm_mine", params: []})
                await raffle.performUpkeep([])
                await expect(raffle.enterRaffle({value : raffleEntranceFee})).to.be.revertedWith("Raffle__RaffleNotOpen")
            })
        })

        describe("checkUpkeep", function () {
            it("returns false if people haven't sent any ETH", async () => {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(!upkeepNeeded)
            })
            it("returns false if raffle isn't open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                await raffle.performUpkeep([]) // changes the state to calculating
                const raffleState = await raffle.getRaffleState() // stores the new state
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert.equal(raffleState.toString() == "1", upkeepNeeded == false)
            })
            it("returns false if enough time hasn't passed", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(!upkeepNeeded)
            })
            it("returns true if enough time has passed, has players, eth, and is open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(upkeepNeeded)
            })
        })

        describe("performUpkeep", function () {
            it("can only run if checkupkeep is true", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const tx = await raffle.performUpkeep("0x") 
                assert(tx)
            })
            it("reverts if checkup is false", async () => {
                await expect(raffle.performUpkeep("0x")).to.be.revertedWith( 
                    "Raffle__UpkeepNotNeeded"
                )
            })
            it("updates the raffle state and emits a requestId", async () => {
                // Too many asserts in this test!
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const txResponse = await raffle.performUpkeep("0x") // emits requestId
                const txReceipt = await txResponse.wait(1) // waits 1 block
                const raffleState = await raffle.getRaffleState() // updates state
                const requestId = txReceipt.events[1].args.requestId
                assert(requestId.toNumber() > 0)
                assert(raffleState == 1) // 0 = open, 1 = calculating
            })
        })

        describe("fulfillRandomWords", function (){
            beforeEach(async () => {
               await raffle.enterRaffle({value: raffleEntranceFee})
               await network.provider.send("evm_increaseTime",[interval.toNumber() + 1])
               await network.provider.request({method:"evm_mine", params: []}) 
            })

            it("can only be called after performUpkeep", async() => {
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request")
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request")

            })


            it("picks a winner, resets and sends money", async () => {
                const additionalEntrances = 3
                const startingIndex =2
                const accounts = await ethers.getSigners()
                for(let i = startingIndex; i< startingIndex + additionalEntrances; i++){
                    const connectedRaffle = raffle.connect(accounts[i])
                    await connectedRaffle.enterRaffle({value : raffleEntranceFee})
                }
                const startingTimeStamp = await raffle.getLastTimeStamp()

                await new Promise(async (resolve, reject) => {
                    raffle.once("WinnerPicked", async() => { console.log("Winner picked event fired .....")

                    try {
                        const recentWinner = await raffle.getRecentWinner()
                        const raffleState = await raffle.getRaffleState()
                        const winnerBalance = await accounts[2].getBalance()
                        const endingTimeStamp = await raffle.getLastTimeStamp()
                        const numPlayers= await raffle.getNumberOfPlayers()
                        await expect(raffle.getPlayer(0)).to.be.reverted
                        assert.equal(recentWinner.toString(),accounts[2].address)
                        assert.equal(numPlayers.toString(),"0")
                        assert.equal(raffleState.toString(),"0")
                        assert.equal(
                            winnerBalance.toString(), 
                            startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                                .add(raffleEntranceFee.mul(additionalEntrances).add(raffleEntranceFee)).toString())
                        assert (endingTimeStamp > startingTimeStamp)
                        resolve()
                    }catch (e){
                        reject(e)
                    }
                })
                const tx = await raffle.performUpkeep([])
                const txReceipt = await tx.wait(1)
                const startingBalance = await accounts[2].getBalance() 
                await vrfCoordinatorV2Mock.fulfillRandomWords(  txReceipt.events[1].args.requestId,raffle.address )
            })
        })
    })
})
