function formatReceiptNumber(year, sequence) {
  return `RCP-${year}-${String(sequence).padStart(6, '0')}`;
}

module.exports = { formatReceiptNumber };
