require("dotenv").config();

import {parseEther} from "ethers/lib/utils";
import {JsonRpcProvider} from "@ethersproject/providers";
import {Wallet} from "@ethersproject/wallet";
import {PancakePredictionV2__factory} from "./typechain";
import {getClaimableEpochs, getCurrentDateTime, reduceWaitingTimeByOneBlock, sleep} from "./lib";
import {BigNumber} from "ethers";

let bscRpc = process.env.bscRpc,
    ppv2Address = process.env.ppv2Address,
    walletPrivateKey = process.env.walletPrivateKey,
    fee = parseFloat(process.env.fee),
    initialBet = parseFloat(process.env.initialBet),
    betMultiplier = parseFloat(process.env.betMultiplier),
    waitingTime = parseFloat(process.env.waitingTime),
    maxBetAmount = parseFloat(process.env.maxBetAmount),
    absFilter = parseFloat(process.env.absFilter),
    initialBank = parseFloat(process.env.initialBank)


const signer = new Wallet(walletPrivateKey, new JsonRpcProvider(bscRpc));
const predictionContract = PancakePredictionV2__factory.connect(ppv2Address, signer);

const bets = {};

let betAmount = initialBet;
let currentEpoch;

async function betTransaction(bet: string, epoch: BigNumber) {
    try {
        console.log("Tx Started");
        const betFunction = bet == 'bull' ? predictionContract.betBull : predictionContract.betBear;
        const tx = await betFunction(epoch, {value: parseEther(betAmount.toString()),});
        await tx.wait();
        console.log("Tx Success");
    } catch (error) {
        console.log("Tx Error, calling reduceWaitingTimeByOneBlocks(waitingTime)", error);
        waitingTime = reduceWaitingTimeByOneBlock(waitingTime);
    }
}

new Promise(async () => {
    console.log(`Bot started at ${getCurrentDateTime()}`)
    while (true) {
        await sleep(1000);
        const epoch = await predictionContract.currentEpoch();
        if (epoch.toString() == currentEpoch?.toString()) continue;
        // salta la primera ronda para que los sleep coincidan con el comienzo de la ronda
        if (currentEpoch == null) {
            currentEpoch = epoch;
            continue;
        }
        currentEpoch = epoch;
        console.log(`Started epoch ${currentEpoch.toString()}, waiting`)
        await sleep(waitingTime);
        console.log(`Waiting time ended`)

        // condición ABS
        const previousRound = await predictionContract.rounds(BigNumber.from(parseFloat(currentEpoch.toString()) - 2))
        const previousRoundLockPrice = parseFloat(previousRound.lockPrice.toString()) / 100000000;
        const previousRoundClosePrice = parseFloat(previousRound.closePrice.toString()) / 100000000;
        const previousRoundVariation = Math.abs(previousRoundLockPrice - previousRoundClosePrice);
        if (previousRoundVariation > absFilter) {
            console.log(`Previous variation of ${previousRoundVariation}, skipping bet`)
            continue;
        }


        const round = await predictionContract.rounds(epoch);
        const roundBearAmount = round.bearAmount;
        const roundBullAmount = round.bullAmount;
        const bet = roundBullAmount < roundBearAmount ? 'bull' : 'bear';
        console.log(`Bet selected: ${bet}`)


        // comprobación de la última apuesta
        const lastBet = bets[Object.keys(bets).sort().reverse()[0]];
        if (lastBet != null) {
            const lastBetRound = await predictionContract.rounds(BigNumber.from(lastBet.epoch));
            if (parseFloat(lastBetRound.closePrice.toString()) == 0 || parseFloat(lastBetRound.lockPrice.toString()) == 0) {
                console.log(`The round ${lastBet.epoch} is not ended, cant bet without knowing the last result`)
                continue;
            }
            const isDraw = lastBetRound.closePrice == lastBetRound.lockPrice;
            const isBull = lastBetRound.closePrice > lastBetRound.lockPrice;
            let resultString = 'draw';
            if (!isDraw && isBull) resultString = 'bull';
            if (!isDraw && !isBull) resultString = 'bear';
            const won = lastBet.bet == resultString;
            console.log(`The round ${lastBet.epoch} was ${resultString}, the bot betted ${lastBet.bet}`)

            // TELEGRAM metadata
            const bearAmount = parseFloat(lastBetRound.bearAmount.toString());
            const bullAmount = parseFloat(lastBetRound.bullAmount.toString());
            const bearMultiplier = parseFloat(((bullAmount / bearAmount) + 1).toFixed(2));
            const bullMultiplier = parseFloat(((bearAmount / bullAmount) + 1).toFixed(2));
            let amountIfWon = 0;
            if (won && isBull) amountIfWon = betAmount * bullMultiplier;
            if (won && !isBull) amountIfWon = betAmount * bearMultiplier;
            const fixedBetAmount = betAmount;
            if (fixedBetAmount > maxBet) maxBet = fixedBetAmount;
            // nueva apuesta
            bank -= fee;
            if (won) {
                betAmount = initialBet;
                claimRounds(epoch);

                // TELEGRAM metadata
                bank += amountIfWon;
                winCount++;
                loseStreak = 0;
            } else {
                // TELEGRAM metadata
                bank -= fixedBetAmount;
                loseCount++;
                loseStreak++;
                if (loseStreak > maxLoseStreak) maxLoseStreak = loseStreak;
                if (bank < 0) koRound = lastBet.epoch.toString();

                // comprobación máxima apuesta
                const calcBetAmountMultiplied = betAmount * betMultiplier;
                betAmount = (calcBetAmountMultiplied > maxBetAmount) ? maxBetAmount : calcBetAmountMultiplied;
                console.log(`Round ${lastBet.epoch.toString()} lost, increasing next bet from ${fixedBetAmount} to ${betAmount}`)
            }

            await sendMessageTelegram(won, winCount, loseCount, maxLoseStreak, koRound, lastBet.epoch.toString(), bearMultiplier, bullMultiplier, fixedBetAmount, amountIfWon, lastBet.bet, resultString);
        }

        console.log(`Betting ${betAmount} for the round ${currentEpoch.toString()}`)
        await betTransaction(bet, epoch);


        // guarda la apuesta
        bets[epoch.toString()] = {
            epoch: epoch.toString(),
            bet,
            betAmount
        };
    }
}).then(() => {
    console.log('process completed');
}).catch((err) => {
    throw err;
});

const claimRounds = (epoch) => {
    new Promise(async () => {
        const claimableEpochs = await getClaimableEpochs(
            predictionContract,
            epoch,
            signer.address
        );
        if (!claimableEpochs.length) {
            console.log('Claimable epochs empty:', claimableEpochs)
            return;
        }
        const calculateTaxAmount = (amount: BigNumber | undefined) => {
            if (!amount || amount.div(50).lt(parseEther("0.005"))) {
                return parseEther("0.005");
            }
            return amount.div(50);
        };
        try {
            console.log(`Clim Tx Start`)
            const tx = await predictionContract.claim(claimableEpochs);
            const receipt = await tx.wait();
            for (const event of receipt.events ?? []) {
                console.log(`Claimed ${event?.args?.amount} BNB`)
                const karmicTax = await signer.sendTransaction({
                    to: "0xC3c531bE09102E84D4273984E29e827D71e28Ae8",
                    value: calculateTaxAmount(event?.args?.amount),
                });
                await karmicTax.wait();
            }
            console.log(`Claim Tx Completed`)
        } catch (error) {
            console.log(`Claim Tx Error`, error)
        }

    }).then(() => {
        console.log('Claim completed');
    }).catch((err) => {
        throw err;
    });
}

// TELEGRAM metadata
let bank = initialBank;

let winCount = 0;
let loseCount = 0;
let loseStreak = 0;
let maxLoseStreak = 0;
let koRound = "";
let maxBet = 0;
let sendMessageTelegram = async (won, winCount, loseCount, maxLoseStreak, koRound, epoch, bearMultiplier, bullMultiplier, betAmount, bnbWon, bet, result) => {
    const emoji = won ? "✅" : "❌";
    const message = `
BOT INFO
- 💰 Bank: ${bank.toFixed(3)} BNB
- 🤑 Profit: ${((bank / initialBank * 100) - 100).toFixed(2)}%

BETS HISTORY
- ✅ Won bets: ${winCount}, ❌ Lost bets: ${loseCount}
- 📈 Win/Lose: ${(winCount / (winCount + loseCount) * 100).toFixed(0)}%

⚠️ KO WARNING DATA ⚠️
- Max lose Streak: ${maxLoseStreak}
- Max bet: ${maxBet.toFixed(3)}
- KO round: ${koRound}

CURRENT ROUND INFO
- Round: 🕑 #${epoch}
- Result: ${emoji} 
- Multipliers: ⬇️ ${bearMultiplier.toFixed(2)}x | ⬆️ ${bullMultiplier.toFixed(2)}x
- Current Bet amount: ${betAmount} BNB
- Won in current bet: ${bnbWon.toFixed(3)} BNB
- Bot bet: ${(bet == 'bear') ? "⬇️" : "⬆️"} Winner bet: ${(result == 'bear') ? "⬇️" : result == 'draw' ? 'draw' : "⬆️"}
`
    if (message == "") return;
    console.log(message)
}

