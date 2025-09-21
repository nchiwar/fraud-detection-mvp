self.onmessage = (e) => {
  const transactions = e.data;
  const thresholds = { amount: 1000, fraudScore: 0.8 };
  const flagged = transactions.filter(t => t.amount > thresholds.amount || t.fraudScore > thresholds.fraudScore);
  self.postMessage(flagged);
};