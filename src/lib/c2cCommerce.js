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

export function normalizeCustomerProfile(profile = {}) {
  const address = profile.address ?? profile;
  const serviceLocation = normalizeIndiaLocation(address);
  const addressLine = String(address.addressLine ?? address.line1 ?? "").trim();
  const pincode = String(address.pincode ?? address.postalCode ?? "").trim();

  if (!serviceLocation || !addressLine || !pincode) {
    return {
      complete: false,
      address: null,
      message: "Add an India delivery address before buying or selling.",
    };
  }

  return {
    complete: true,
    address: {
      addressLine,
      city: serviceLocation.city,
      state: serviceLocation.state,
      country: "IN",
      pincode,
      lat: serviceLocation.lat,
      lon: serviceLocation.lon,
      zone: serviceLocation.zone,
    },
    message: "Profile address ready.",
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

  if (comparison.colorMismatch || comparison.colorComparison?.status === "mismatch") {
    detectedFlags.push("color_mismatch");
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
  const hasColorMismatch = damageFlags.includes("color_mismatch");
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

  if (hasColorMismatch) {
    cosmeticScore = Math.min(cosmeticScore, 62);
    packagingScore = Math.min(packagingScore, 70);
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
    reviewSignals: {
      productMatchScore: identityScore,
      colorStatus: comparison.colorComparison?.status ?? "unknown",
      colorMismatch: hasColorMismatch,
      referenceSimilarity: Number(comparison.referenceSimilarity ?? 0),
      manualPickupReviewRequired: true,
    },
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
  const hasColorMismatch = scorecard.damageFlags.includes("color_mismatch");
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

  if (hasColorMismatch) {
    return {
      grade: "B",
      label: "Variant review needed",
      score: Math.min(score, 76),
      confidence: "Manual pickup review",
      summary:
        "The product type matches, but the uploaded color or variant differs from the order proof. Final price waits for pickup review.",
    };
  }

  if (score >= 92) {
    return {
      grade: "A",
      label: "Like new",
      score,
      confidence: "Preliminary high confidence",
      summary: "Preliminary visual match is strong. Final payout still depends on pickup review.",
    };
  }

  if (score >= 86) {
    return {
      grade: "A-",
      label: "Excellent",
      score,
      confidence: "Preliminary high confidence",
      summary: "Preliminary visual match is strong. Final payout still depends on pickup review.",
    };
  }

  if (score >= 78) {
    return {
      grade: "B+",
      label: "Very good",
      score,
      confidence: "Preliminary confidence",
      summary: "Preliminary visual review passed. Final payout waits for pickup review.",
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

export function calculateGreenCredits({ listing, order, grade, discountPercent } = {}) {
  const sourceOrder = order ?? listing?.item ?? {};
  const weightKg = Number(sourceOrder.estimatedWeightKg ?? 0.4);
  const gradeValue = grade?.grade ?? listing?.grade?.grade ?? "B";
  const discount = Number(discountPercent ?? listing?.discountPercent ?? 0);
  const gradeBoost = ["A", "A-", "B+"].includes(gradeValue) ? 3 : gradeValue === "B" ? 2 : 1;
  const circularityBoost = discount >= 40 ? 2 : 1;
  const sellerListing = Math.max(6, Math.round(7 + weightKg * 5 + gradeBoost + circularityBoost));
  const buyerQueue = Math.max(3, Math.round(3 + weightKg * 3 + circularityBoost));
  const estimatedCo2eKg = Number(Math.max(1, weightKg * 18).toFixed(1));

  return {
    sellerListing,
    buyerQueue,
    estimatedCo2eKg,
    status: "pending_pickup_review",
    reason: "Credits reward keeping a usable product in circulation without a warehouse return hop.",
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
  const greenCredits = calculateGreenCredits({
    order,
    grade,
    discountPercent: pricing.discountPercent,
  });
  const publishable = aiAnalysis?.identityStatus !== "mismatch";
  const now = new Date().toISOString();
  const listingId = `nt_${order.id.replace(/[^0-9]/g, "")}_${Date.now().toString(36)}`;
  const sellerLocation =
    normalizeIndiaLocation(identity.address ?? identity.location) ??
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
    queueFilled: false,
    queueStatus: "open",
    interestCount: 0,
    createdAt: now,
    source: "nexturn-ai-graded",
    item: order,
    category: order.marketplaceCategory ?? productMarketplaceCategory(order.category),
    image: order.image,
    uploadedImagePreview,
    grade,
    greenCredits,
    scorecard,
    review: {
      status: "preliminary_ai_review",
      paymentUnlocked: false,
      manualPickupReviewRequired: true,
      paymentNote:
        "Buyers can join the queue now. Payment unlocks only after an Amazon delivery partner verifies the item during pickup.",
      finalPriceNote:
        "The displayed resale value is preliminary and can change after manual pickup review.",
      productMatchScore: scorecard.reviewSignals.productMatchScore,
      colorStatus: scorecard.reviewSignals.colorStatus,
      referenceSimilarity: scorecard.reviewSignals.referenceSimilarity,
    },
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
      "No warehouse involved. Seller keeps the item at home. Buyers can join the queue; payment opens only after an Amazon delivery partner checks quality at pickup.",
    settlement: {
      preliminaryItemValue: pricing.price,
      deliveryFeeToAmazon: delivery.allowed ? delivery.fee : pricing.deliveryFee,
      buyerTotal: Number((pricing.price + (delivery.allowed ? delivery.fee : pricing.deliveryFee)).toFixed(2)),
      paymentStatus: "locked_until_pickup_review",
    },
  };
}

export function createInterestQueueEntry({
  buyerIdentity = {},
  buyerProfile = {},
  listing,
}) {
  const queuedAt = new Date().toISOString();
  const profile = normalizeCustomerProfile(buyerProfile);
  const delivery = calculateDeliveryFee({
    buyerLocation: profile.address,
    sellerLocation: listing.sellerLocation,
    weightKg: listing.item?.estimatedWeightKg,
  });
  const deliveryFee = Number(delivery.allowed ? delivery.fee : listing.deliveryFee ?? DEFAULT_DELIVERY_FEE_INR);
  const preliminaryItemValue = Number(listing.price ?? 0);
  const greenCreditsPending = Number(listing.greenCredits?.buyerQueue ?? calculateGreenCredits({ listing }).buyerQueue);

  return {
    id: `interest_${listing.id}_${Date.now().toString(36)}`,
    listingId: listing.id,
    queuedAt,
    status: "queued_for_pickup_review",
    paymentStatus: "locked_until_pickup_review",
    buyerId: buyerIdentity.customerId,
    buyerEmail: buyerIdentity.email,
    buyerName: buyerIdentity.name,
    buyerAddress: profile.address,
    sellerId: listing.sellerId,
    sellerName: listing.sellerName,
    sellerLocation: listing.sellerLocation,
    itemTitle: listing.item?.title ?? listing.title,
    preliminaryItemValue,
    estimatedDeliveryFee: deliveryFee,
    estimatedTotalAfterReview: Number((preliminaryItemValue + deliveryFee).toFixed(2)),
    greenCreditsPending,
    greenCreditStatus: "pending_pickup_review",
    deliveryEstimate: delivery,
    paymentUnlockRule:
      "Payment opens only after the pickup partner manually verifies item identity, color/variant, and visible condition.",
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
  if (!listing) return {};

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
  const interestCount = Number(listing.interestCount ?? 0);
  const queueFilled = Boolean(listing.queueFilled || listing.queueStatus === "filled" || interestCount > 0);
  const greenCredits = listing.greenCredits ?? calculateGreenCredits({
    listing: {
      ...listing,
      item,
      price,
      discountPercent:
        repriced?.discountPercent ??
        listing.discountPercent ??
        (item?.originalPrice ? Math.round((1 - price / Number(item.originalPrice)) * 100) : 0),
    },
  });

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
    queueFilled,
    queueStatus: queueFilled ? "filled" : listing.queueStatus ?? "open",
    queueBuyerId: listing.queueBuyerId,
    queueInterestId: listing.queueInterestId,
    interestCount,
    price,
    discountPercent:
      repriced?.discountPercent ??
      listing.discountPercent ??
      (item?.originalPrice ? Math.round((1 - price / Number(item.originalPrice)) * 100) : 0),
    deliveryFee,
    greenCredits,
    deliveryEstimate: listing.deliveryEstimate ?? delivery,
    logistics:
      listing.logistics && !/after purchase/i.test(listing.logistics)
        ? listing.logistics
        : "Seller keeps the item at home. Buyers join the queue; payment opens only after pickup verification.",
    review: listing.review ?? {
      status: "preliminary_ai_review",
      paymentUnlocked: false,
      manualPickupReviewRequired: true,
      paymentNote:
        "Buyers can join the queue now. Payment unlocks only after pickup verification.",
      finalPriceNote: "Displayed resale value is preliminary.",
      productMatchScore: listing.scorecard?.reviewSignals?.productMatchScore ?? listing.scorecard?.identityScore ?? 0,
      colorStatus: listing.scorecard?.reviewSignals?.colorStatus ?? "unknown",
      referenceSimilarity: listing.scorecard?.reviewSignals?.referenceSimilarity ?? 0,
    },
    settlement: {
      ...(listing.settlement ?? {}),
      preliminaryItemValue: price,
      deliveryFeeToAmazon: deliveryFee,
      buyerTotal: Number((price + deliveryFee).toFixed(2)),
      paymentStatus: listing.settlement?.paymentStatus ?? "locked_until_pickup_review",
    },
  };
}

export function buildFallbackMarketplace() {
  return {
    heroListings: seedC2CListings.map((listing) => normalizeMarketplaceListing(listing)),
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

  [...seedC2CListings, ...persistedListings].forEach((listing) => {
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
