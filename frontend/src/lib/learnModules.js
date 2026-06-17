/**
 * learnModules.js — Hadaleum Learn engine
 *
 * 6 Robinhood-style educational modules. Each completion unlocks a dashboard feature.
 */

export const LEARN_MODULES = [
  {
    id: 1,
    title: 'What are crypto whales?',
    description: 'Understand who the biggest players in crypto are and why their moves matter.',
    unlocksFeature: 'whale_heatmap',
    screens: [
      {
        title: 'The biggest fish in the ocean',
        body: 'Crypto whales are wallets that hold enormous amounts of a token — large enough that their trades noticeably move the market. On Ethereum, a wallet holding thousands of ETH or tens of millions in stablecoins is considered a whale.',
      },
      {
        title: 'Why size creates power',
        body: 'When a whale sells even a small fraction of their holdings, it can flood the order books with supply. Conversely, a large buy can push prices up fast. Retail traders often react to these moves, amplifying the effect.',
        example: 'A wallet with 5,000 ETH begins transferring to a centralized exchange — Hadaleum flags it as a potential sell event.',
      },
      {
        title: 'Two types of whales',
        body: 'Some whales are long-term holders ("HODLers") who rarely move their coins. Others are active traders who constantly rotate between assets. Knowing which type is moving helps you read the signal correctly.',
      },
      {
        title: 'Dormant vs. active wallets',
        body: 'A wallet that has not moved funds in months or years is called dormant. When a dormant whale suddenly wakes up, it is one of the strongest on-chain signals the market produces — historically, these events precede large price swings.',
        example: 'Pattern D in Hadaleum: a dormant wallet holding significant USDC just became active for the first time in over a year.',
      },
      {
        title: 'You can track them',
        body: 'The beauty of blockchain is that all whale activity is publicly visible. Hadaleum reads this data in real time, so you see what the biggest players are doing before it hits the news.',
      },
    ],
  },
  {
    id: 2,
    title: 'Why whale movements predict price',
    description: 'Learn the on-chain mechanics that link large wallet activity to price direction.',
    unlocksFeature: 'signal_history',
    screens: [
      {
        title: 'Supply and demand on-chain',
        body: 'Prices move because of supply and demand. When a whale moves tokens onto an exchange, they are likely preparing to sell — adding supply. When they withdraw tokens off an exchange into a cold wallet, they are likely holding — reducing available supply.',
      },
      {
        title: 'Exchange inflows and outflows',
        body: 'Large inflows to exchanges (tokens moving in) are bearish signals. Large outflows (tokens moving out) are bullish. Hadaleum monitors these flows across major exchanges in real time.',
        example: 'Three wallets each transfer large amounts of ETH to Binance within a 6-hour window — Hadaleum surfaces this as a concentrated inflow event.',
      },
      {
        title: 'Accumulation patterns',
        body: 'Before a major rally, whales often quietly accumulate tokens over days or weeks — small purchases that do not spike the price. On-chain, you can see this as steady inflows to a wallet without corresponding exchange deposits.',
      },
      {
        title: 'The lead time advantage',
        body: 'On-chain data does not lie, and it often moves before price. A whale positioning for a big trade may take hours or days before the market reacts. Hadaleum gives you that window.',
      },
    ],
  },
  {
    id: 3,
    title: 'Reading on-chain data',
    description: 'Decode the raw blockchain signals Hadaleum surfaces every day.',
    unlocksFeature: 'price_alerts',
    screens: [
      {
        title: 'What is a transaction?',
        body: 'Every token transfer on Ethereum is a transaction recorded permanently on the blockchain. Each transaction has a sender, a receiver, an amount, a timestamp, and a fee. Hadaleum reads millions of these to find the ones that matter.',
      },
      {
        title: 'Key metrics to watch',
        body: 'Three numbers matter most: wallet balance (how much they hold), transfer size (how much they moved), and destination (exchange vs. personal wallet). Together, these tell a clear story.',
      },
      {
        title: 'Smart contract interactions',
        body: 'Whales do more than move tokens. They interact with DeFi protocols — lending, borrowing, providing liquidity. A whale opening a large leveraged position is a strong directional signal. Hadaleum tracks these interactions.',
        example: 'A wallet deposits a large amount of ETH as collateral into Aave and borrows stablecoins — a sign they expect ETH to rise in value.',
      },
      {
        title: 'Reading wallet history',
        body: 'A wallet\'s past behavior is its fingerprint. Has it bought before major rallies? Has it sold near local tops? Hadaleum builds a track record for each tracked wallet so you can weigh its signals accordingly.',
      },
    ],
  },
  {
    id: 4,
    title: 'How to act on a signal safely',
    description: 'Turn whale signals into trades without overexposing yourself.',
    unlocksFeature: 'share_signal',
    screens: [
      {
        title: 'A signal is not a guarantee',
        body: 'Even the clearest on-chain signal is probabilistic, not certain. Whales can be wrong. Markets can be irrational. Treat every signal as one input in your decision — never as a sure thing.',
      },
      {
        title: 'Confirm before you act',
        body: 'Look for confluence: does the whale signal align with price action? Is volume picking up? Are multiple wallets showing the same behavior? Convergence across signals increases confidence — Hadaleum shows you the confidence score for exactly this reason.',
      },
      {
        title: 'Size your position',
        body: 'A high-confidence signal does not mean an all-in bet. Professionals risk a small, fixed percentage of their portfolio per trade — typically 1–3%. This lets them stay in the game through multiple losing trades.',
      },
      {
        title: 'Set your exit before you enter',
        body: 'Decide on your stop loss and take-profit levels before you place the trade. Emotion clouds judgment once you are in a position. A plan made before entry is almost always better than one made under pressure.',
        example: 'Hadaleum shows a bullish whale signal on ETH. You decide: entry near current price, stop loss a few percent below, take profit at a defined target — locked in before you execute.',
      },
      {
        title: 'Wait for your entry',
        body: 'Missing a trade is better than chasing one. If the price has already moved significantly by the time you see the signal, the risk/reward may no longer be favorable. Patience is a real edge.',
      },
    ],
  },
  {
    id: 5,
    title: 'Risk management basics',
    description: 'Protect your capital so you can keep trading through wins and losses.',
    unlocksFeature: 'risk_calculator',
    screens: [
      {
        title: 'The only rule that matters',
        body: 'Never risk more than you can afford to lose. This sounds obvious, but in practice most traders break it when they are excited. Before every trade, ask: if this goes to zero, is my life okay? If not, the size is too large.',
      },
      {
        title: 'Position sizing',
        body: 'Position sizing is how you control risk. If you risk 2% of a $10,000 portfolio per trade, one bad trade costs you $200. You would need 50 consecutive losing trades to be down to $0 — practically impossible if your signals have any edge at all.',
      },
      {
        title: 'Stop losses are not optional',
        body: 'A stop loss is a pre-set exit price. It removes emotion from a losing trade. Without a stop loss, a small loss can become a devastating one. Set it when you enter, and do not move it against your position.',
      },
      {
        title: 'Diversification across time',
        body: 'Do not put all your capital into a single trade at once. Spreading entries over time — called dollar-cost averaging on the way in — reduces the impact of bad timing. The same logic applies to taking profits on the way out.',
      },
    ],
  },
  {
    id: 6,
    title: 'Understanding confidence scores',
    description: 'Learn how Hadaleum scores its signals and what each level means.',
    unlocksFeature: 'confidence_filter',
    screens: [
      {
        title: 'What is a confidence score?',
        body: 'Hadaleum assigns each signal a confidence score from 1 to 5. It reflects how many independent on-chain factors align with the signal direction. More factors pointing the same way = higher score. It is not a price target — it is a quality rating.',
      },
      {
        title: 'How the score is calculated',
        body: 'The model weighs factors like: wallet track record, transfer size relative to historical behavior, exchange flow direction, and whether other tracked wallets are moving similarly. Each factor adds weight to the final score.',
        example: 'A wallet with a strong historical track record moves a large amount to an exchange during a period of rising inflows from multiple other whales — all factors align for a high confidence score.',
      },
      {
        title: 'Score 1–2: low conviction',
        body: 'A single ambiguous signal. Could be noise. If you act on these, use very small position sizes. Think of them as a heads-up to watch, not a reason to trade.',
      },
      {
        title: 'Score 3: moderate — watch and confirm',
        body: 'Multiple signals agree, but not overwhelmingly. This is a solid reason to pay attention and look for confirmation from price action or volume before acting.',
      },
      {
        title: 'Score 4–5: high conviction',
        body: 'Strong alignment across many independent factors. These are Hadaleum\'s highest-quality signals. Still not a guarantee — but historically, these have the best signal-to-noise ratio. Apply your normal position sizing rules and execute with discipline.',
      },
    ],
  },
]
