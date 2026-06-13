export function rankPurchaseFit(alternatives, customer) {
  return alternatives
    .map((item) => {
      const budgetFit = item.price <= customer.fitProfile.budgetCeiling ? 100 : 68;
      const formFactorFit = customer.fitProfile.prefersOverEar
        ? item.name.toLowerCase().includes("pods")
          ? 62
          : 96
        : 82;
      const comfortFit =
        100 - Math.abs(customer.fitProfile.comfortPriority - item.comfortScore);
      const sustainabilityFit =
        100 -
        Math.abs(customer.fitProfile.sustainabilityPreference - item.sustainabilityScore);

      const confidence = Math.round(
        budgetFit * 0.24 +
          formFactorFit * 0.24 +
          comfortFit * 0.22 +
          sustainabilityFit * 0.16 +
          (100 - item.returnRisk) * 0.14,
      );

      return {
        ...item,
        confidence,
        recommendation:
          confidence >= 90
            ? "Best low-return match"
            : confidence >= 84
              ? "Good fit with one tradeoff"
              : "Review before buying",
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
}
