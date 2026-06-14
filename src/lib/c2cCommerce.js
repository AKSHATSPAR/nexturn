import { conditionPresets, fakeOrderHistory, seedC2CListings } from "../data/c2cCommerce.js";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const damageTerms = [
  "broken",
  "crack",
  "cracked",
  "damage",
  "damaged",
  "dent",
  "scratch",
  "scratched",
  "shatter",
  "shattered",
  "tear",
];

export const DELIVERY_FEE = 3.99;

export function formatMarketplaceCurrency(value) {
  return currency.format(Number(value ?? 0));
}

export function ordersForCustomer(identity = {}) {
  const customerId = identity.customerId ?? "demo_customer";

  return fakeOrderHistory.map((order, index) => ({
    ...order,
    ownerId: customerId,
    ownerEmail: identity.email ?? "demo@nexturn.local",
    isListable: index < 5,
    authenticity: {
      source: "Fake Amazon order history",
      orderId: order.id,
      asin: order.asin,
      purchasedNew: true,
      customerMatchesSignedInAccount: Boolean(identity.isAuthenticated),
    },
  }));
}

export function findCustomerOrder(orderId, identity = {}) {
  return ordersForCustomer(identity).find((order) => order.id === orderId);
}

function clampScore(value, fallback = 85) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, parsed));
}

function labelText(label) {
  return [
    label.name ?? label.Name,
    ...(label.parents ?? label.Parents?.map((parent) => parent.Name) ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function detectDamageFlags({ aiAnalysis, fileName = "", sellerCondition = {} }) {
  const labels = [
    ...(aiAnalysis?.labels ?? []),
    ...(aiAnalysis?.ignoredLabels ?? []),
    ...(aiAnalysis?.rawLabels ?? []),
  ];
  const labelBlob = labels.map(labelText).join(" ");
  const fileBlob = String(fileName).toLowerCase();
  const presetFlags =
    conditionPresets[sellerCondition.preset]?.damageFlags ??
    sellerCondition.damageFlags ??
    [];
  const detectedFlags = [];

  if (damageTerms.some((term) => labelBlob.includes(term) || fileBlob.includes(term))) {
    detectedFlags.push("visual_damage_detected");
  }

  if (/(screen|display|glass)/.test(labelBlob) && /(crack|broken|shatter|damage)/.test(labelBlob)) {
    detectedFlags.push("broken_screen");
  }

  if (/(crack|broken|shatter|damage)/.test(fileBlob)) {
    detectedFlags.push("broken_screen");
  }

  return [...new Set([...presetFlags, ...detectedFlags])];
}

export function buildConditionScorecard({
  aiAnalysis,
  fileName,
  order,
  sellerCondition = {},
} = {}) {
  const preset = conditionPresets[sellerCondition.preset] ?? conditionPresets.pristine;
  const identityScore =
    aiAnalysis?.identityStatus === "mismatch"
      ? 25
      : aiAnalysis?.identityStatus === "unknown"
        ? 82
        : 100;
  const damageFlags = detectDamageFlags({ aiAnalysis, fileName, sellerCondition });
  const hasBrokenScreen = damageFlags.includes("broken_screen");
  const hasVisualDamage = damageFlags.includes("visual_damage_detected");

  let functionalScore = clampScore(sellerCondition.functionalScore, preset.functionalScore);
  let cosmeticScore = clampScore(sellerCondition.cosmeticScore, preset.cosmeticScore);
  let packagingScore = clampScore(sellerCondition.packagingScore, preset.packagingScore);
  let accessoryCompleteness = clampScore(
    sellerCondition.accessoryCompleteness,
    preset.accessoryCompleteness,
  );

  if (hasVisualDamage) {
    cosmeticScore = Math.min(cosmeticScore, 58);
  }

  if (hasBrokenScreen && ["phone", "tablet", "wearable"].includes(order?.category)) {
    functionalScore = Math.min(functionalScore, 68);
    cosmeticScore = Math.min(cosmeticScore, 38);
    packagingScore = Math.min(packagingScore, 60);
  }

  if (aiAnalysis?.identityStatus === "mismatch") {
    functionalScore = Math.min(functionalScore, 62);
    cosmeticScore = Math.min(cosmeticScore, 50);
  }

  return {
    functionalScore,
    cosmeticScore,
    packagingScore,
    accessoryCompleteness,
    identityScore,
    damageFlags,
    aiProvider: aiAnalysis?.provider ?? "rules-engine",
    aiMode: aiAnalysis?.mode ?? "no-upload",
  };
}

export function gradeScorecard(scorecard) {
  const rawScore =
    scorecard.functionalScore * 0.36 +
    scorecard.cosmeticScore * 0.3 +
    scorecard.accessoryCompleteness * 0.12 +
    scorecard.packagingScore * 0.12 +
    scorecard.identityScore * 0.1;
  const hasBrokenScreen = scorecard.damageFlags.includes("broken_screen");
  const identityMismatch = scorecard.identityScore < 50;
  const score = Math.round(rawScore);

  if (identityMismatch) {
    return {
      grade: "C",
      label: "Manual review",
      score: Math.min(score, 55),
      confidence: "Manual review",
      summary: "Uploaded evidence does not match the Amazon order metadata.",
    };
  }

  if (hasBrokenScreen) {
    return {
      grade: "C",
      label: "Damaged",
      score: Math.min(score, 54),
      confidence: "Low confidence",
      summary: "Broken or cracked screen evidence forces a low resale grade.",
    };
  }

  if (score >= 92) {
    return {
      grade: "A",
      label: "Like new",
      score,
      confidence: "High confidence",
      summary: "Near-pristine condition with complete accessories.",
    };
  }

  if (score >= 86) {
    return {
      grade: "A-",
      label: "Excellent",
      score,
      confidence: "High confidence",
      summary: "Minimal wear and strong functional evidence.",
    };
  }

  if (score >= 78) {
    return {
      grade: "B+",
      label: "Very good",
      score,
      confidence: "High confidence",
      summary: "Light visible wear with core functions intact.",
    };
  }

  if (score >= 68) {
    return {
      grade: "B",
      label: "Good",
      score,
      confidence: "Medium confidence",
      summary: "Usable item with visible wear or missing packaging.",
    };
  }

  return {
    grade: "C",
    label: "Needs repair/review",
    score,
    confidence: "Manual review",
    summary: "Condition risk is high, so resale requires partner verification.",
  };
}

export function calculateDiscountedPrice(originalPrice, grade) {
  const depreciationByGrade = {
    A: 0.74,
    "A-": 0.68,
    "B+": 0.58,
    B: 0.48,
    C: 0.28,
  };
  const retention = depreciationByGrade[grade.grade] ?? 0.35;
  const price = Math.max(9, Math.round(Number(originalPrice) * retention) - 0.01);
  const discountPercent = Math.round((1 - price / Number(originalPrice)) * 100);

  return {
    price: Number(price.toFixed(2)),
    discountPercent,
    deliveryFee: DELIVERY_FEE,
    buyerTotal: Number((price + DELIVERY_FEE).toFixed(2)),
  };
}

export function createListingFromEvaluation({
  aiAnalysis,
  identity = {},
  media,
  order,
  sellerCondition,
  uploadedImagePreview,
} = {}) {
  const scorecard = buildConditionScorecard({
    aiAnalysis,
    fileName: sellerCondition?.fileName,
    order,
    sellerCondition,
  });
  const grade = gradeScorecard(scorecard);
  const pricing = calculateDiscountedPrice(order.originalPrice, grade);
  const now = new Date().toISOString();
  const listingId = `nt_${order.id.replace(/[^0-9]/g, "")}_${Date.now().toString(36)}`;

  return {
    id: listingId,
    sellerId: identity.customerId,
    sellerName: identity.name ?? "NexTurn seller",
    sellerEmail: identity.email,
    sellerNeighborhood: identity.neighborhood ?? "Local pickup zone",
    status: "active",
    createdAt: now,
    source: "nexturn-ai-graded",
    item: order,
    image: order.image,
    uploadedImagePreview,
    grade,
    scorecard,
    aiAnalysis,
    media,
    price: pricing.price,
    discountPercent: pricing.discountPercent,
    deliveryFee: pricing.deliveryFee,
    badge: "AI Graded & Amazon Verified",
    logistics:
      "No warehouse involved. Seller keeps the item at home until a buyer pays; Amazon delivery partner checks quality at pickup and delivers to the buyer.",
    settlement: {
      itemPaymentToSeller: pricing.price,
      deliveryFeeToAmazon: pricing.deliveryFee,
      buyerTotal: pricing.buyerTotal,
    },
  };
}

export function createCheckoutReceipt({ buyerIdentity = {}, listing }) {
  const paidAt = new Date().toISOString();
  const itemPayment = Number(listing.price ?? 0);
  const deliveryFee = Number(listing.deliveryFee ?? DELIVERY_FEE);

  return {
    id: `checkout_${listing.id}_${Date.now().toString(36)}`,
    listingId: listing.id,
    paidAt,
    status: "payment_simulated",
    buyerId: buyerIdentity.customerId,
    buyerEmail: buyerIdentity.email,
    sellerId: listing.sellerId,
    sellerName: listing.sellerName,
    itemTitle: listing.item.title,
    itemPayment,
    deliveryFee,
    totalPaid: Number((itemPayment + deliveryFee).toFixed(2)),
    logisticsStatus: "pickup_scheduled",
    logistics:
      "Amazon facilitates local C2C delivery: pickup from seller home, condition check by delivery partner, drop at buyer address.",
  };
}

export function buildFallbackMarketplace() {
  return {
    heroListings: seedC2CListings,
    genericItems: buildGenericFallbackItems(),
    generatedAt: new Date().toISOString(),
    source: "local-fallback",
  };
}

export function buildGenericFallbackItems(count = 120) {
  const categories = ["Audio", "Wearables", "Tablets", "Cameras", "Home tech", "Accessories"];

  return Array.from({ length: count }, (_, index) => {
    const category = categories[index % categories.length];
    const price = 24 + ((index * 11) % 420);
    return {
      id: `generic_${index + 1}`,
      source: "generic-background",
      title: `${category} marketplace item ${index + 1}`,
      category,
      price,
      image: seedC2CListings[index % seedC2CListings.length].image,
      rating: Number((3.8 + ((index % 12) * 0.08)).toFixed(1)),
      badge: "Marketplace item",
    };
  });
}

export function mergeMarketplaceListings(persistedListings = [], genericItems = []) {
  const listingMap = new Map();

  [...persistedListings, ...seedC2CListings].forEach((listing) => {
    if (listing.status === "active") {
      listingMap.set(listing.id, listing);
    }
  });

  return {
    heroListings: [...listingMap.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    genericItems,
    generatedAt: new Date().toISOString(),
    source: "nexturn-c2c",
  };
}
