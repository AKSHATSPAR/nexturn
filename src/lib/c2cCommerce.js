import {
  defaultBuyerLocation,
  indianServiceLocations,
  orderProofHistory,
  seedC2CListings,
} from "../data/c2cCommerce.js";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
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

export const DEFAULT_DELIVERY_FEE_INR = 149;
export const DELIVERY_FEE = DEFAULT_DELIVERY_FEE_INR;

const marketplaceCategoryByProductCategory = {
  audio: "Electronics",
  camera: "Electronics",
  laptop: "Electronics",
  phone: "Electronics",
  tablet: "Electronics",
  wearable: "Electronics",
};

const fallbackSellerLocations = [
  indianServiceLocations.find((location) => location.city === "Bengaluru"),
  indianServiceLocations.find((location) => location.city === "Gurugram"),
  indianServiceLocations.find((location) => location.city === "Mumbai"),
  indianServiceLocations.find((location) => location.city === "Guwahati"),
].filter(Boolean);

function fallbackSellerLocationForKey(key = "") {
  const checksum = [...String(key)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return fallbackSellerLocations[checksum % fallbackSellerLocations.length] ?? defaultBuyerLocation;
}

export function formatMarketplaceCurrency(value) {
  return currency.format(Number(value ?? 0));
}

export function productMarketplaceCategory(category) {
  return marketplaceCategoryByProductCategory[category] ?? "Lifestyle";
}

export function normalizeIndiaLocation(location = defaultBuyerLocation) {
  const city = location?.city;
  const state = location?.state;
  const country = location?.country ?? "IN";
  if (country !== "IN") return null;

  return (
    indianServiceLocations.find(
      (candidate) =>
        candidate.city.toLowerCase() === String(city ?? "").toLowerCase() &&
        candidate.state.toLowerCase() === String(state ?? "").toLowerCase(),
    ) ??
    indianServiceLocations.find(
      (candidate) => candidate.city.toLowerCase() === String(city ?? "").toLowerCase(),
    ) ??
    null
  );
}

function radians(value) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceKm(origin, destination) {
  const from = normalizeIndiaLocation(origin);
  const to = normalizeIndiaLocation(destination);
  if (!from || !to) return null;

  const earthRadiusKm = 6371;
  const deltaLat = radians(to.lat - from.lat);
  const deltaLon = radians(to.lon - from.lon);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(deltaLon / 2) ** 2;

  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function calculateDeliveryFee({
  buyerLocation = defaultBuyerLocation,
  sellerLocation = fallbackSellerLocations[0],
  weightKg = 0.5,
} = {}) {
  const buyer = normalizeIndiaLocation(buyerLocation);
  const seller = normalizeIndiaLocation(sellerLocation);
  if (!buyer || !seller) {
    return {
      allowed: false,
      fee: 0,
      distanceKm: null,
      band: "outside_india",
      message: "NexTurn C2C delivery is currently available only for Indian addresses.",
    };
  }

  const distanceKm = calculateDistanceKm(seller, buyer);
  const weightSurcharge = Math.max(0, Math.ceil(Number(weightKg ?? 0.5) - 0.5) * 35);
  let fee = 149;
  let band = "same_city";

  if (seller.city === buyer.city) {
    fee = 79;
  } else if (seller.state === buyer.state) {
    fee = 119;
    band = "same_state";
  } else if (distanceKm <= 800) {
    fee = 189;
    band = "regional";
  } else if (distanceKm <= 1800) {
    fee = 249;
    band = "national";
  } else {
    fee = 329;
    band = "long_distance";
  }

  return {
    allowed: true,
    fee: fee + weightSurcharge,
    distanceKm,
    band,
    buyerLocation: buyer,
    sellerLocation: seller,
    message:
      seller.city === buyer.city
        ? "Same-city pickup and delivery"
        : `${seller.city}, ${seller.state} to ${buyer.city}, ${buyer.state}`,
  };
}

export function ordersForCustomer(identity = {}) {
  const customerId = identity.customerId ?? "demo_customer";

  return orderProofHistory.map((order, index) => ({
    ...order,
    ownerId: customerId,
    ownerEmail: identity.email ?? "demo@nexturn.local",
    isListable: index < 5,
    authenticity: {
      source: "Connected Amazon order history",
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

function labelText(label) {
  return [
    label.name ?? label.Name,
    ...(label.parents ?? label.Parents?.map((parent) => parent.Name) ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function detectDamageFlags({ aiAnalysis, fileName = "" }) {
  const labels = [
    ...(aiAnalysis?.labels ?? []),
    ...(aiAnalysis?.ignoredLabels ?? []),
    ...(aiAnalysis?.rawLabels ?? []),
  ];
  const labelBlob = labels.map(labelText).join(" ");
  const fileBlob = String(fileName).toLowerCase();
  const detectedFlags = [];

  if (damageTerms.some((term) => labelBlob.includes(term) || fileBlob.includes(term))) {
    detectedFlags.push("visual_damage_detected");
  }

  if (/(screen|display|glass)/.test(labelBlob) && /(crack|broken|shatter|damage)/.test(labelBlob)) {
    detectedFlags.push("broken_screen");
  }

  if (/(crack|broken|shatter|damage|torn|split|parts|repair)/.test(fileBlob)) {
    detectedFlags.push("severe_visual_damage");
  }

  if (/(screen|display|glass|phone|tablet)/.test(fileBlob) && /(crack|broken|shatter|damage)/.test(fileBlob)) {
    detectedFlags.push("broken_screen");
  }

  const comparison = aiAnalysis?.identityComparison ?? {};
  const relevantConfidence = Number(comparison.topRelevantConfidence ?? 0);
  const unrelatedConfidence = Number(comparison.topIgnoredConfidence ?? 0);
  const referenceSimilarity = Number(comparison.referenceSimilarity ?? 0);
  const hasLowRelevantMatch = relevantConfidence > 0 && relevantConfidence < 72;
  const hasDominantUnrelatedEvidence =
    unrelatedConfidence >= 80 && unrelatedConfidence - relevantConfidence >= 18;
  const hasLowReferenceOverlap =
    comparison.referenceImageCompared && referenceSimilarity > 0 && referenceSimilarity < 35;

  if (hasLowRelevantMatch || hasDominantUnrelatedEvidence || hasLowReferenceOverlap) {
    detectedFlags.push("visual_condition_risk");
  }

  return [...new Set(detectedFlags)];
}

export function buildConditionScorecard({
  aiAnalysis,
  fileName,
  order,
} = {}) {
  const identityScore =
    aiAnalysis?.identityStatus === "mismatch"
      ? 25
      : aiAnalysis?.identityStatus === "unknown"
        ? 82
        : 100;
  const damageFlags = detectDamageFlags({ aiAnalysis, fileName });
  const hasBrokenScreen = damageFlags.includes("broken_screen");
  const hasSevereDamage = damageFlags.includes("severe_visual_damage");
  const hasVisualDamage = damageFlags.includes("visual_damage_detected");
  const hasVisualConditionRisk = damageFlags.includes("visual_condition_risk");
  const comparison = aiAnalysis?.identityComparison ?? {};
  const topRelevantConfidence = Number(comparison.topRelevantConfidence ?? 0);

  let functionalScore = 92;
  let cosmeticScore = 88;
  let packagingScore = 82;
  let accessoryCompleteness = 88;

  if (topRelevantConfidence >= 90 && !hasVisualConditionRisk) {
    functionalScore = 96;
    cosmeticScore = 92;
    accessoryCompleteness = 94;
  }

  if (hasVisualDamage) {
    cosmeticScore = Math.min(cosmeticScore, 58);
  }

  if (hasVisualConditionRisk) {
    functionalScore = Math.min(functionalScore, 68);
    cosmeticScore = Math.min(cosmeticScore, 42);
    packagingScore = Math.min(packagingScore, 58);
    accessoryCompleteness = Math.min(accessoryCompleteness, 72);
  }

  if (hasBrokenScreen || hasSevereDamage) {
    functionalScore = Math.min(functionalScore, 58);
    cosmeticScore = Math.min(cosmeticScore, 28);
    packagingScore = Math.min(packagingScore, 52);
    accessoryCompleteness = Math.min(accessoryCompleteness, 68);
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
  const hasSevereDamage = scorecard.damageFlags.includes("severe_visual_damage");
  const hasVisualConditionRisk = scorecard.damageFlags.includes("visual_condition_risk");
  const identityMismatch = scorecard.identityScore < 50;
  const score = Math.round(rawScore);

  if (identityMismatch) {
    return {
      grade: "Mismatch",
      label: "Wrong item",
      score: Math.min(score, 55),
      confidence: "Manual review",
      summary: "Uploaded photo does not match the selected Amazon order item.",
    };
  }

  if (hasBrokenScreen || hasSevereDamage || hasVisualConditionRisk) {
    return {
      grade: "C",
      label: hasVisualConditionRisk ? "Needs pickup verification" : "Damaged",
      score: Math.min(score, 54),
      confidence: "Low confidence",
      summary:
        "The uploaded photo differs materially from the order proof, so NexTurn applies a low resale grade until pickup verification.",
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
  if (grade.grade === "Mismatch") {
    return {
      price: 0,
      discountPercent: 100,
      deliveryFee: DELIVERY_FEE,
      buyerTotal: 0,
    };
  }

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
    deliveryFee: DEFAULT_DELIVERY_FEE_INR,
    buyerTotal: Number((price + DEFAULT_DELIVERY_FEE_INR).toFixed(2)),
  };
}

export function createListingFromEvaluation({
  aiAnalysis,
  identity = {},
  media,
  order,
  uploadContext,
  uploadedImagePreview,
} = {}) {
  const scorecard = buildConditionScorecard({
    aiAnalysis,
    fileName: uploadContext?.fileName,
    order,
  });
  const grade = gradeScorecard(scorecard);
  const pricing = calculateDiscountedPrice(order.originalPrice, grade);
  const publishable = aiAnalysis?.identityStatus !== "mismatch";
  const now = new Date().toISOString();
  const listingId = `nt_${order.id.replace(/[^0-9]/g, "")}_${Date.now().toString(36)}`;
  const sellerLocation =
    normalizeIndiaLocation(identity.location) ??
    fallbackSellerLocations[Math.abs((identity.customerId ?? listingId).length) % fallbackSellerLocations.length] ??
    defaultBuyerLocation;
  const delivery = calculateDeliveryFee({
    sellerLocation,
    buyerLocation: defaultBuyerLocation,
    weightKg: order.estimatedWeightKg,
  });

  return {
    id: listingId,
    sellerId: identity.customerId,
    sellerName: identity.name ?? "NexTurn seller",
    sellerEmail: identity.email,
    sellerNeighborhood: identity.neighborhood ?? sellerLocation.city,
    sellerCity: sellerLocation.city,
    sellerState: sellerLocation.state,
    sellerLocation,
    status: publishable ? "active" : "blocked_identity_mismatch",
    createdAt: now,
    source: "nexturn-ai-graded",
    item: order,
    category: order.marketplaceCategory ?? productMarketplaceCategory(order.category),
    image: order.image,
    uploadedImagePreview,
    grade,
    scorecard,
    aiAnalysis,
    media,
    price: pricing.price,
    discountPercent: pricing.discountPercent,
    deliveryFee: delivery.allowed ? delivery.fee : pricing.deliveryFee,
    deliveryEstimate: delivery,
    badge: publishable ? "AI Graded & Amazon Verified" : "Photo does not match order",
    publishable,
    blockingReason: publishable
      ? null
      : "The uploaded photo appears to be a different product than the selected Amazon order item.",
    logistics:
      "No warehouse involved. Seller keeps the item at home until a buyer pays; Amazon delivery partner checks quality at pickup and delivers to the buyer.",
    settlement: {
      itemPaymentToSeller: pricing.price,
      deliveryFeeToAmazon: delivery.allowed ? delivery.fee : pricing.deliveryFee,
      buyerTotal: Number((pricing.price + (delivery.allowed ? delivery.fee : pricing.deliveryFee)).toFixed(2)),
    },
  };
}

export function createCheckoutReceipt({ buyerIdentity = {}, buyerLocation = defaultBuyerLocation, listing }) {
  const paidAt = new Date().toISOString();
  const itemPayment = Number(listing.price ?? 0);
  const delivery = calculateDeliveryFee({
    buyerLocation,
    sellerLocation: listing.sellerLocation,
    weightKg: listing.item?.estimatedWeightKg,
  });
  const deliveryFee = Number(delivery.allowed ? delivery.fee : listing.deliveryFee ?? DEFAULT_DELIVERY_FEE_INR);

  return {
    id: `checkout_${listing.id}_${Date.now().toString(36)}`,
    listingId: listing.id,
    paidAt,
    status: "payment_simulated",
    buyerId: buyerIdentity.customerId,
    buyerEmail: buyerIdentity.email,
    buyerLocation: delivery.buyerLocation ?? buyerLocation,
    sellerId: listing.sellerId,
    sellerName: listing.sellerName,
    sellerLocation: delivery.sellerLocation ?? listing.sellerLocation,
    itemTitle: listing.item.title,
    itemPayment,
    deliveryFee,
    totalPaid: Number((itemPayment + deliveryFee).toFixed(2)),
    logisticsStatus: "pickup_scheduled",
    deliveryEstimate: delivery,
    logistics:
      "Amazon facilitates local C2C delivery: pickup from seller home, condition check by delivery partner, drop at buyer address.",
  };
}

export function normalizeMarketplaceListing(listing = {}) {
  const proofOrder =
    orderProofHistory.find((order) => order.id === listing.item?.id || order.asin === listing.item?.asin) ??
    orderProofHistory.find((order) => order.title === listing.item?.title) ??
    listing.item;
  const item = proofOrder
    ? {
        ...listing.item,
        ...proofOrder,
      }
    : listing.item;
  const sellerLocation =
    normalizeIndiaLocation(listing.sellerLocation) ??
    normalizeIndiaLocation({ city: listing.sellerCity, state: listing.sellerState, country: "IN" }) ??
    fallbackSellerLocationForKey(listing.sellerId ?? listing.id);
  const hasLegacyUsdPrice = Number(listing.price ?? 0) > 0 && Number(listing.price ?? 0) < 1000;
  const hasLegacyUsdOriginal =
    Number(listing.item?.originalPrice ?? 0) > 0 && Number(listing.item?.originalPrice ?? 0) < 5000;
  const shouldReprice = hasLegacyUsdPrice || hasLegacyUsdOriginal;
  const repriced = shouldReprice && item?.originalPrice
    ? calculateDiscountedPrice(item.originalPrice, listing.grade ?? { grade: "B" })
    : null;
  const delivery = calculateDeliveryFee({
    sellerLocation,
    buyerLocation: defaultBuyerLocation,
    weightKg: item?.estimatedWeightKg,
  });
  const price = repriced?.price ?? Number(listing.price ?? 0);
  const deliveryFee = delivery.allowed ? delivery.fee : Number(listing.deliveryFee ?? DEFAULT_DELIVERY_FEE_INR);

  return {
    ...listing,
    item,
    image: listing.image ?? item?.image,
    category: listing.category ?? item?.marketplaceCategory ?? productMarketplaceCategory(item?.category),
    sellerName: listing.sellerName ?? "NexTurn seller",
    sellerCity: sellerLocation.city,
    sellerState: sellerLocation.state,
    sellerLocation,
    sellerNeighborhood: listing.sellerNeighborhood ?? sellerLocation.city,
    price,
    discountPercent:
      repriced?.discountPercent ??
      listing.discountPercent ??
      (item?.originalPrice ? Math.round((1 - price / Number(item.originalPrice)) * 100) : 0),
    deliveryFee,
    deliveryEstimate: listing.deliveryEstimate ?? delivery,
    settlement: {
      ...(listing.settlement ?? {}),
      itemPaymentToSeller: price,
      deliveryFeeToAmazon: deliveryFee,
      buyerTotal: Number((price + deliveryFee).toFixed(2)),
    },
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

export function buildGenericFallbackItems(count = 180) {
  const categories = ["Electronics", "Beauty", "Home", "Fashion", "Food", "Books", "Sports"];

  return Array.from({ length: count }, (_, index) => {
    const category = categories[index % categories.length];
    const price = 399 + ((index * 431) % 42000);
    const sellerLocation = fallbackSellerLocations[index % fallbackSellerLocations.length];
    return {
      id: `generic_${index + 1}`,
      source: "generic-background",
      title: `${category} marketplace item ${index + 1}`,
      category,
      price,
      image: seedC2CListings[index % seedC2CListings.length].image,
      rating: Number((3.8 + ((index % 12) * 0.08)).toFixed(1)),
      badge: "Marketplace item",
      sellerName: "Dummy seller",
      sellerCity: sellerLocation.city,
      sellerState: sellerLocation.state,
      sellerLocation,
    };
  });
}

export function mergeMarketplaceListings(persistedListings = [], genericItems = []) {
  const listingMap = new Map();

  [...persistedListings, ...seedC2CListings].forEach((listing) => {
    const normalized = normalizeMarketplaceListing(listing);
    if (normalized.status === "active") {
      listingMap.set(normalized.id, normalized);
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
