# [🔥 UPDATE V2] PancakeSwap Prediction Bot

### ⚠️ Beware of forks. I do not give any guarantee that the fork may turn out to be a scam.

### 💥 Disclaimer

I'm coding this stuff on a pure open source, every time the bot wins, it donates a small portion of your winnings to a developer account so we can continue improving this bot.

0xC3c531bE09102E84D4273984E29e827D71e28Ae8

As you receive the program as open source feel free to update the bot strategy to increase the win-rate or even changing the formula of the donation to what you consider rasonable.

### [Donate with Trust Wallet](https://link.trustwallet.com/send?asset=c20000714&address=0xC3c531bE09102E84D4273984E29e827D71e28Ae8)

All investment strategies and investments involve risk of loss.
**Nothing contained in this program, scripts, code or repository should be construed as investment advice.**
Any reference to an investment's past or potential performance is not, and should not be construed as, a recommendation
or as a guarantee of any specific outcome or profit. By using this program you accept all liabilities, and that no
claims can be made against the developers or others connected with the program.

## Info

This is a PancakeSwap Prediction game bot, it includes backtesting code so you can try new strategies changing the `env` variables on a risk free environment.

It works with PancakePredictionV2 (https://pancakeswap.finance/prediction)

## 💡 How to use

```
1. Provide your private key to .env PRIVATE_KEY field
2. Install dependencies `npm i`
4. Start the app with `npm run start`
5. Enjoy winning!
```

## 🦊 How to Export Private Key from MetaMask
````
Open your account
Click on three points at top-right corner
Account details
Export Private Key
````

## 💡 BackTesting with PancakeSwap data

````
1. Update initialEpoch with the current epoch in pancake -5 (example: current epoch 25890 -> 25885)
2. Update finalEpoch with the current epoch in pancake -500 (example: current epoch 25890 -> 25390)
3. Install dependencies `npm i`
4. Run `npm run download_data` **not needed as this code contains history.json file
5. Run `npm run backtest` 
6. Open file chart.png
````

![alt PancakeSwap Prediction Bot-Winner](images/ppw-image.png)
![alt PancakeSwap Prediction Bot-Winner Screenshot](images/ppw-image-2.png)
![alt Candle Genie Bot-Winner Screenshot](images/ppw-image-3.png)

### Strategy

The bot strategy can be found in [src/bot.ts](https://github.com/diego-tobalina/PancakeSwapBot/blob/main/src/bot.ts#L73). It bets on the biggest of the bull or bear payout.

`const bet = roundBullAmount < roundBearAmount ? 'bull' : 'bear';`

To increase the bet amount the bot uses this strategy (check the .env to modify the multiplier and the initial bet amount)

`https://en.wikipedia.org/wiki/Martingale_(probability_theory)`

