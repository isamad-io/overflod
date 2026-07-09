const IGV_RATE = 0.18;

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function calculateIgv(subtotal) {
  return roundMoney(roundMoney(subtotal) * IGV_RATE);
}

function totalWithIgv(subtotal) {
  const base = roundMoney(subtotal);
  const igv = calculateIgv(base);
  return {
    subtotal: base,
    igv,
    igv_rate: IGV_RATE,
    total: roundMoney(base + igv)
  };
}

module.exports = {
  IGV_RATE,
  calculateIgv,
  roundMoney,
  totalWithIgv
};
