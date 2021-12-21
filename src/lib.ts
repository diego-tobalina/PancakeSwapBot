import {BigNumber} from "@ethersproject/bignumber";
import {PancakePredictionV2,} from "./typechain";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getClaimableEpochs = async (
    predictionContract: PancakePredictionV2,
    epoch: BigNumber,
    userAddress: string,
) => {
    const claimableEpochs: BigNumber[] = [];

    for (let i = 1; i <= 5; i++) {
        const epochToCheck = epoch.sub(i);

        const [claimable, refundable, {claimed, amount}] = await Promise.all([
            predictionContract.claimable(epochToCheck, userAddress),
            predictionContract.refundable(epochToCheck, userAddress),
            predictionContract.ledger(epochToCheck, userAddress)
        ]);

        if (amount.gt(0) && (claimable || refundable) && !claimed) {
            claimableEpochs.push(epochToCheck);
        }
    }

    return claimableEpochs;
};

export const reduceWaitingTimeByOneBlock = (waitingTime: number) => {
    if (waitingTime <= 3000) {
        return waitingTime;
    }
    return waitingTime - 3000;
};

export const getCurrentDateTime = () => {
    const currentDate = new Date();
    return currentDate.getHours() + ":" + (currentDate.getMinutes() < 10 ? `0${currentDate.getMinutes()}` : currentDate.getMinutes());
}
