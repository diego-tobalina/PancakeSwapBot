require("dotenv").config();
const fs = require('fs');
const readline = require('readline');
const ChartJsImage = require('chartjs-to-image');

const
    outputFileName = process.env.outputFileName,
    fee = parseFloat(process.env.fee),
    initialBank = parseFloat(process.env.initialBank),
    initialBet = parseFloat(process.env.initialBet),
    betMultiplier = parseFloat(process.env.betMultiplier),
    maxBetAmount = parseFloat(process.env.maxBetAmount),
    absFilter = parseFloat(process.env.absFilter),
    percentMissing = parseFloat(process.env.percentMissing)


new Promise(async () => {

    let maxLoseStreakCount = 0;
    let loseStreakCount = 0;
    let loseCount = 0;

    let maxWinStreakCount = 0;
    let winStreakCount = 0;
    let winCount = 0;

    let maxBet = 0;


    console.log('process started')
    const fileStream = fs.createReadStream(outputFileName);
    const rows = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    const rowsInJson = [];
    for await (const row of rows) {
        if (row.trim() == '') continue;
        rowsInJson.push(JSON.parse(row))
    }
    rowsInJson.sort((a, b) => parseFloat(a.epoch) - parseFloat(b.epoch));


    let bank = initialBank,
        betAmount = initialBet;
    const epochs = [];
    const banks = [];
    for (let row of rowsInJson) {
        const {epoch, resultString, bearMultiplier, bullMultiplier, multiplier: roundMultipier} = row;
        // el bot necesita 1 de margen para conocer el resultado de la anterior
        if (rowsInJson.indexOf(row) % 2 == 0) continue;

        const previousRound = rowsInJson[rowsInJson.indexOf(row) - 2];
        if (previousRound != null) {
            let previousRoundLockPrice = previousRound.lockPrice / 100000000;
            let previousRoundClosePrice = previousRound.closePrice / 100000000;
            if (Math.abs(previousRoundLockPrice - previousRoundClosePrice) < absFilter) {
                // betting
                let bet = bullMultiplier > bearMultiplier ? 'bull' : 'bear';
                if (Math.round(Math.random() * 100) <= percentMissing) {
                    bet = bullMultiplier < bearMultiplier ? 'bull' : 'bear';
                }

                bank -= betAmount;
                bank -= fee;
                const won = bet == resultString;
                const tmpBetAmount = betAmount * betMultiplier;
                const calcBetAmount = (tmpBetAmount > maxBetAmount) ? maxBetAmount : tmpBetAmount;
                if (calcBetAmount > maxBet) maxBet = calcBetAmount;

                if (won) {
                    bank += betAmount * roundMultipier
                    betAmount = initialBet;


                    winStreakCount++;
                    winCount++;
                    if (winStreakCount > maxWinStreakCount) maxWinStreakCount = winStreakCount;
                    loseStreakCount = 0;

                } else {
                    betAmount = calcBetAmount;

                    loseStreakCount++;
                    loseCount++;
                    if (loseStreakCount > maxLoseStreakCount) maxLoseStreakCount = loseStreakCount;

                    winStreakCount = 0;
                }

            }
        }

        epochs.push(parseFloat(epoch))
        banks.push(bank);
    }

    const chart = new ChartJsImage();
    chart.setConfig({
        type: 'line',
        data: {
            labels: reduceArray(epochs, 249),
            datasets: [{
                label: 'BNB',
                data: reduceArray(banks, 249),
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255,99,132,1)',
                borderWidth: 1
            }]
        }
    }).setWidth(1500).setHeight(1000);
    chart.toFile('chart.png');

    console.log("maxLoseStreakCount", maxLoseStreakCount)
    console.log("loseStreakCount", loseStreakCount)
    console.log("loseCount", loseCount)
    console.log("maxWinStreakCount", maxWinStreakCount)
    console.log("winStreakCount", winStreakCount)
    console.log("winCount", winCount)
    console.log("maxBet", maxBet)
    console.log("bank", bank)

}).then(() => {
    console.log('process completed');
}).catch((err) => {
    throw err;
});

function reduceArray(arr, chunks) {
    let groups = getChunks(arr, arr.length / chunks);
    let avgGroups = [];
    for (let group of groups) {
        avgGroups.push(getAvg(group))
    }
    return avgGroups;
}


function getChunks(arr, len) {
    let chunks = [], i = 0, n = arr.length;
    while (i < n) {
        chunks.push(arr.slice(i, i += len));
    }
    return chunks;
}

function getAvg(values) {
    let sum = values.reduce((previous, current) => current += previous);
    return sum / values.length;
}

