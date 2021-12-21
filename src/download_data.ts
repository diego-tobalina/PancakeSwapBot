import {JsonRpcProvider} from "@ethersproject/providers";
import {Wallet} from "@ethersproject/wallet";
import {PancakePredictionV2__factory} from "./typechain";
import {BigNumber} from "ethers";

require("dotenv").config();

const bscRpc = process.env.bscRpc,
    ppv2Address = process.env.ppv2Address,
    walletPrivateKey = process.env.walletPrivateKey,
    initialEpoch: number = parseFloat(process.env.initialEpoch),
    finalEpoch: number = parseFloat(process.env.finalEpoch),
    outputFileName = process.env.outputFileName

const fs = require('fs');
const signer = new Wallet(walletPrivateKey, new JsonRpcProvider(bscRpc));
const predictionContract = PancakePredictionV2__factory.connect(ppv2Address, signer);


new Promise(async () => {
    console.log('process started')

    let epoch: number = initialEpoch;
    while (true) {
        if (epoch < finalEpoch) break;
        const round = await predictionContract.rounds(BigNumber.from(epoch));
        const lockPrice = parseFloat(round.lockPrice.toString());
        const closePrice = parseFloat(round.closePrice.toString());
        if (closePrice == 0 || lockPrice == 0) continue;
        const bearAmount = parseFloat(round.bearAmount.toString());
        const bullAmount = parseFloat(round.bullAmount.toString());
        const isDraw = closePrice == lockPrice;
        const isBull = closePrice > lockPrice;
        const bearMultiplier = parseFloat(((bullAmount / bearAmount) + 1).toFixed(2));
        const bullMultiplier = parseFloat(((bearAmount / bullAmount) + 1).toFixed(2));
        const multiplier = isBull ? bullMultiplier : bearMultiplier;
        let resultString = 'draw';
        if (!isDraw && isBull) resultString = 'bull';
        if (!isDraw && !isBull) resultString = 'bear';
        const resume = {
            epoch: epoch.toString(),
            lockPrice,
            closePrice,
            bearAmount,
            bullAmount,
            resultString,
            bearMultiplier,
            bullMultiplier,
            multiplier,
        };
        await addRowToFile(outputFileName, resume);
        console.log(`saved epoch ${epoch.toString()}`);
        epoch--;
    }

}).then(() => {
    console.log('process completed');
}).catch((err) => {
    throw err;
});


async function addRowToFile(fileName: string, resume: { lockPrice: number; multiplier: number; bearAmount: number; bullAmount: number; resultString: string; epoch: string; closePrice: number; bullMultiplier: number; bearMultiplier: number }) {
    await createFileIfNotExists(fileName);
    const data = fs.readFileSync(fileName);
    const fd = fs.openSync(fileName, 'w+');
    const content = `${JSON.stringify(resume)}\n`;
    const buffer = Buffer.from(content);
    fs.writeSync(fd, buffer, 0, buffer.length, 0); //write new data
    fs.writeSync(fd, data, 0, data.length, buffer.length); //append old data
    fs.close(fd);
}

async function createFileIfNotExists(name: string) {
    try {
        await fs.promises.readFile(name)
    } catch (error) {
        await fs.promises.writeFile(name, '')
    }
}
