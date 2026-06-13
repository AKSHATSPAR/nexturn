const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCurrency(value) {
  return currency.format(value);
}

export function gradeReturn(scan) {
  const conditionScore =
    scan.functionalScore * 0.42 +
    (100 - scan.cosmeticWear) * 0.24 +
    scan.accessoryCompleteness * 0.16 +
    scan.hygieneScore * 0.12 +
    scan.packagingScore * 0.06 -
    scan.fraudRisk * 0.25;

  if (conditionScore >= 93) {
    return {
      grade: "A-",
      label: "Excellent",
      confidence: "High confidence",
      score: Math.round(conditionScore),
      summary: "Minimal wear. Fully functional.",
    };
  }

  if (conditionScore >= 84) {
    return {
      grade: "B+",
      label: "Very good",
      confidence: "High confidence",
      score: Math.round(conditionScore),
      summary: "Light wear. Functional tests passed.",
    };
  }

  if (conditionScore >= 72) {
    return {
      grade: "B",
      label: "Good",
      confidence: "Medium confidence",
      score: Math.round(conditionScore),
      summary: "Usable with visible wear.",
    };
  }

  return {
    grade: "C",
    label: "Needs review",
    confidence: "Manual review",
    score: Math.round(conditionScore),
    summary: "Route to human inspection before resale.",
  };
}

export function buildRouteOptions(returnCase) {
  const { scan, item } = returnCase;
  const grade = gradeReturn(scan);
  const resaleValue = Math.round(item.originalPrice * scan.priceRetention);
  const exchangeValue = item.originalPrice;
  const customerConvenienceBoost = scan.accessoryCompleteness === 100 ? 8 : 0;

  const routes = [
    {
      id: "resell",
      title: "Resell now",
      shortLabel: "Resell",
      description: "Get paid by a trusted buyer quickly.",
      payout: resaleValue,
      greenCredits: 4.5,
      paymentTime: "2-3 days",
      convenience: "High",
      impact: "High",
      score:
        scan.demandScore * 0.42 +
        grade.score * 0.28 +
        scan.priceRetention * 100 * 0.2 +
        customerConvenienceBoost,
      customerReason:
        "Best customer value because demand is high and the item can avoid warehouse liquidation.",
      cta: "Resell now",
    },
    {
      id: "exchange",
      title: "Exchange match",
      shortLabel: "Exchange",
      description: "Upgrade or switch to a better-fit item.",
      payout: exchangeValue,
      greenCredits: 0,
      paymentTime: "Instant",
      convenience: "Medium",
      impact: "Medium",
      score: 76 + (100 - scan.demandScore) * 0.1,
      customerReason:
        "Useful if the customer still needs headphones and wants the fastest replacement path.",
      cta: "See matches",
    },
    {
      id: "donate",
      title: "Donate safely",
      shortLabel: "Donate",
      description: "Support people and planet.",
      payout: 0,
      greenCredits: 6.5,
      paymentTime: "Instant",
      convenience: "High",
      impact: "High",
      score: 70 + scan.functionalScore * 0.15 + scan.hygieneScore * 0.1,
      customerReason:
        "Meaningful when payout is less important than a verified donation receipt and social impact.",
      cta: "Donate item",
    },
    {
      id: "recycle",
      title: "Recycle responsibly",
      shortLabel: "Recycle",
      description: "Ensure proper material recovery.",
      payout: 0,
      greenCredits: 3,
      paymentTime: "Instant",
      convenience: "High",
      impact: "Medium",
      score: 55 + scan.fraudRisk * 0.5,
      customerReason:
        "Fallback route for damaged or low-trust items so materials are recovered instead of discarded.",
      cta: "Recycle item",
    },
  ];

  return routes
    .map((route) => ({
      ...route,
      score: Math.round(route.score),
      isRecommended: false,
    }))
    .sort((a, b) => b.score - a.score)
    .map((route, index) => ({
      ...route,
      isRecommended: index === 0,
      rank: index + 1,
    }));
}

export function summarizeDecision(returnCase) {
  const grade = gradeReturn(returnCase.scan);
  const routes = buildRouteOptions(returnCase);
  const recommended = routes[0];
  const emissionsKgSaved = Math.round(
    returnCase.item.estimatedWeightKg * 21 + returnCase.scan.demandScore * 0.06,
  );
  const landfillAvoidedGrams = Math.round(returnCase.item.estimatedWeightKg * 1000);

  return {
    grade,
    routes,
    recommended,
    impact: {
      emissionsKgSaved,
      landfillAvoidedGrams,
      nextOwnerMatchRate: returnCase.scan.demandScore,
    },
    passportChecks: [
      ["Item authenticity", returnCase.trustPassport.authenticity],
      ["Functionality test", returnCase.trustPassport.functionality],
      ["Data wiped", returnCase.trustPassport.dataWipe],
      ["Cleaned and sanitized", returnCase.trustPassport.cleaned],
    ],
  };
}
