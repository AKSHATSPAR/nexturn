import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Home,
  Leaf,
  LogIn,
  LogOut,
  MapPin,
  Moon,
  PackageCheck,
  PackageOpen,
  ReceiptText,
  Recycle,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { initializeAuth, signIn, signOut } from "./services/auth";
import {
  createC2CListing,
  evaluateC2CListingUpload,
  fetchC2CMarketplace,
  fetchC2COrders,
  fetchC2CProfile,
  joinC2CInterestQueue,
  saveC2CProfile,
} from "./services/returnResolutionApi";
import { defaultBuyerLocation, indianServiceLocations } from "./data/c2cCommerce";
import { calculateDeliveryFee, formatMarketplaceCurrency, normalizeCustomerProfile } from "./lib/c2cCommerce";

const navItems = [
  { id: "home", label: "Overview", Icon: Home },
  { id: "sell", label: "Return items", Icon: PackageOpen },
  { id: "marketplace", label: "Second-life shop", Icon: Store },
  { id: "listings", label: "My listings", Icon: ReceiptText },
  { id: "impact", label: "Impact", Icon: Leaf },
  { id: "settings", label: "Profile", Icon: Settings },
];

const greenCreditCashbackFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatGreenCashback(points = 0) {
  return greenCreditCashbackFormatter.format(Number(points ?? 0) / 2);
}

const gradeRank = {
  A: 5,
  "A-": 4,
  "B+": 3,
  B: 2,
  C: 1,
  Mismatch: 0,
};

function queueLabelForListing(listing, signedInCustomerId) {
  if (!listing?.queueFilled) return "Open queue";
  return listing.queueBuyerId && listing.queueBuyerId === signedInCustomerId
    ? "Joined queue"
    : "Queue filled";
}

function sellerUploadImageForListing(listing) {
  return listing?.uploadedImagePreview || listing?.uploadedImage || listing?.image;
}

function Badge({ children, tone = "green" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function AuthCard({ auth, onGoogleSignIn, onSignIn, onSignOut }) {
  if (auth.status === "loading") {
    return (
      <section className="auth-card" aria-label="Customer account">
        <span>Unified account</span>
        <strong>Checking session</strong>
      </section>
    );
  }

  if (auth.session) {
    return (
      <section className="auth-card signed-in" aria-label="Customer account">
        <span>Unified account</span>
        <strong>{auth.session.user.name}</strong>
        <small>{auth.session.user.email}</small>
        <button type="button" onClick={onSignOut}>
          <LogOut size={14} /> Sign out
        </button>
      </section>
    );
  }

  return (
    <section className="auth-card" aria-label="Customer account">
      <div className="auth-hero-mark">
        <ShieldCheck size={18} />
      </div>
      <span>{auth.config?.enabled ? "NexTurn account" : "Auth unavailable"}</span>
      <strong>Sign in</strong>
      {auth.error && <small className="auth-error">{auth.error}</small>}
      <button type="button" disabled={!auth.config?.enabled} onClick={onSignIn}>
        <LogIn size={14} /> Sign in
      </button>
      <button
        className="google-button"
        type="button"
        disabled={!auth.config?.googleEnabled}
        onClick={onGoogleSignIn}
      >
        <span className="google-mark">G</span> Google
      </button>
    </section>
  );
}

function TopCommandBar({
  cartCount,
  location,
  onCartOpen,
  onThemeToggle,
  theme,
}) {
  return (
    <div className="top-command-bar" aria-label="Workspace controls">
      <span className="location-chip">
        <MapPin size={15} />
        {location.city}, {location.state}
      </span>
      <button type="button" aria-label="Open saved items" onClick={onCartOpen}>
        <ShoppingCart size={17} />
        <span>{cartCount}</span>
      </button>
      <button type="button" aria-label="Toggle dark mode" onClick={onThemeToggle}>
        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </div>
  );
}

function Sidebar({
  activeView,
  auth,
  collapsed,
  greenCredits,
  location,
  onGoogleSignIn,
  onNavigate,
  onSignIn,
  onSignOut,
  onToggleCollapse,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button className="brand brand-button" type="button" onClick={() => onNavigate("home")}>
          <div className="brand-mark">
            <Recycle size={22} strokeWidth={2.7} />
          </div>
          <span>NexTurn</span>
        </button>
        <button
          className="sidebar-toggle"
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapse}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      <nav className="nav-list" aria-label="Primary navigation">
        {navItems.map(({ id, label, Icon }) => (
          <button
            className={`nav-item ${activeView === id ? "active" : ""}`}
            key={id}
            title={collapsed ? label : undefined}
            type="button"
            onClick={() => onNavigate(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <AuthCard
          auth={auth}
          onGoogleSignIn={onGoogleSignIn}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
        />
        <section className="credit-card">
          <span>C2C rule</span>
          <strong>
            <PackageCheck size={22} /> No warehouse
          </strong>
          <small>Seller keeps item at home until pickup review.</small>
        </section>
        <section className="credit-card service-card">
          <span>Delivery location</span>
          <strong>
            <MapPin size={22} /> India only
          </strong>
          <small>
            Buyer route starts at {location.city}, {location.state}.
          </small>
        </section>
        <section className="credit-card service-card">
          <span>Green credits</span>
          <strong>
            <Leaf size={22} /> {greenCredits}
          </strong>
          <small>{formatGreenCashback(greenCredits)} Amazon Wallet value after pickup review.</small>
        </section>
      </div>
    </aside>
  );
}

function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="c2c-page-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function MetricCard({ label, value, detail, Icon = BadgeCheck }) {
  return (
    <section className="panel c2c-metric">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}

function SignInGate({ title, detail }) {
  return (
    <section className="panel sign-in-gate">
      <ShieldCheck size={24} />
      <h2>{title}</h2>
      <p>{detail}</p>
      <small>One account unlocks return, queue, and profile actions.</small>
    </section>
  );
}

function ProfileGate({ onOpenSettings }) {
  return (
    <section className="panel sign-in-gate profile-gate">
      <MapPin size={24} />
      <h2>Complete your address first</h2>
      <p>
        NexTurn needs a saved India address before you can sell or join a buyer
        queue. Delivery fee estimates use the seller and buyer addresses, not
        live location.
      </p>
      <button className="primary-action" type="button" onClick={onOpenSettings}>
        <Settings size={17} /> Profile
      </button>
    </section>
  );
}

function OverviewView({ isSignedIn, marketplace, onNavigate, orders }) {
  const activeHeroCount = marketplace.heroListings.length;

  return (
    <main className="studio workspace-page c2c-workspace">
      <PageHeader
        eyebrow="C2C commerce"
        title="Second-life commerce"
        description="Order proof, AI review, pickup verification, and no warehouse hop."
      />
      <div className="metric-grid">
        <MetricCard
          label="Unified account"
          value={isSignedIn ? "Active" : "Locked"}
          detail="One profile to return, list, browse, and queue"
          Icon={ShieldCheck}
        />
        <MetricCard
          label="Order proof"
          value={`${orders.length || 5} items`}
          detail="Order history anchors authenticity"
          Icon={Boxes}
        />
        <MetricCard
          label="Shop"
          value={`${activeHeroCount} verified`}
          detail="AI-graded listings lead the catalog"
          Icon={Store}
        />
      </div>
      <div className="c2c-journey">
        <button type="button" onClick={() => onNavigate("sell")}>
          <PackageOpen size={24} />
          <span>
            <strong>Return item</strong>
            <small>Pick an order, upload the item, receive value.</small>
          </span>
          <ChevronRight size={18} />
        </button>
        <button type="button" onClick={() => onNavigate("marketplace")}>
          <ShoppingBag size={24} />
          <span>
            <strong>Shop proofed deals</strong>
            <small>Compare photos, location, queue, and credits.</small>
          </span>
          <ChevronRight size={18} />
        </button>
      </div>
    </main>
  );
}

function OrderCard({ isSelected, onSelect, order }) {
  return (
    <button
      className={`order-proof-card ${isSelected ? "selected" : ""}`}
      type="button"
      onClick={() => onSelect(order)}
    >
      <img src={order.image} alt="" />
      <span>
        <strong>{order.title}</strong>
        <small>
          Order # {order.id} · {order.purchaseDate}
        </small>
        <em>{order.proofNote}</em>
      </span>
      <b>{formatMarketplaceCurrency(order.originalPrice)}</b>
    </button>
  );
}

function ScoreBar({ label, value }) {
  return (
    <div className="score-bar">
      <span>
        {label}
        <b>{Math.round(value)}%</b>
      </span>
      <i>
        <em style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </i>
    </div>
  );
}

function AiEvidenceSummary({ aiAnalysis }) {
  const comparison = aiAnalysis?.identityComparison ?? {};
  const referenceCompared = Boolean(comparison.referenceImageCompared);
  const productMatch = Math.round(comparison.topRelevantConfidence ?? 0);
  const photoSimilarity = Math.round(comparison.referenceSimilarity ?? 0);
  const colorStatus = comparison.colorComparison?.status ?? "unknown";
  const risk =
    aiAnalysis?.identityStatus === "mismatch"
      ? "Wrong item"
      : comparison.colorMismatch
        ? "Variant review"
        : comparison.weakProductEvidence || comparison.dominantUnrelatedEvidence
        ? "Condition risk"
        : "Clear match";

  return (
    <div className="ai-evidence-grid" aria-label="AI comparison evidence">
      <span>
        <small>Product match</small>
        <strong>{productMatch ? `${productMatch}%` : "Review"}</strong>
      </span>
      <span>
        <small>Order-photo compare</small>
        <strong>{referenceCompared ? `${photoSimilarity}%` : "Metadata"}</strong>
      </span>
      <span>
        <small>Colour / variant</small>
        <strong>{colorStatus === "matched" ? "Matched" : colorStatus === "mismatch" ? "Review" : "Unknown"}</strong>
      </span>
      <span>
        <small>AI decision</small>
        <strong>{risk}</strong>
      </span>
    </div>
  );
}

function EvaluationPanel({ evaluation, isPublishing, onPublish }) {
  if (!evaluation?.listingPreview) {
    return (
      <section className="panel evaluation-panel empty">
        <SparkleLine />
        <h2>Grade appears here</h2>
        <p>
          Upload the item photo. NexTurn calculates preliminary value before pickup review.
        </p>
      </section>
    );
  }

  const listing = evaluation.listingPreview;
  const isBlocked = listing.publishable === false;

  return (
    <section className={`panel evaluation-panel ${isBlocked ? "blocked" : ""}`}>
      <div className="evaluation-heading">
        <div>
          <span>{isBlocked ? "Identity mismatch" : "AI review"}</span>
          <strong>{listing.grade.grade}</strong>
          <small>{listing.grade.summary}</small>
        </div>
        <Badge tone={isBlocked ? "danger" : listing.grade.grade === "C" ? "amber" : "green"}>
          {listing.grade.confidence}
        </Badge>
      </div>
      {isBlocked && (
        <p className="identity-block-note">
          {listing.blockingReason} NexTurn will not list this until the upload
          matches the selected order.
        </p>
      )}
      <AiEvidenceSummary aiAnalysis={evaluation.aiAnalysis} />
      {evaluation.aiAnalysis?.summary && <p className="ai-summary-note">{evaluation.aiAnalysis.summary}</p>}
      <div className="price-split">
        <span>{isBlocked ? "Status" : "Preliminary value"}</span>
        <strong>{isBlocked ? "Blocked" : formatMarketplaceCurrency(listing.price)}</strong>
        <small>
          {isBlocked
            ? "Wrong-product uploads are stopped."
            : "Payment opens after pickup review."}
        </small>
      </div>
      <p className="seller-hold-note">
        Preliminary grade. You keep the item until pickup review.
      </p>
      <button
        className="primary-action"
        type="button"
        disabled={isPublishing || isBlocked}
        onClick={onPublish}
      >
        <Store size={17} />{" "}
        {isBlocked
          ? "Blocked"
          : isPublishing
            ? "Listing..."
            : "List"}
      </button>
    </section>
  );
}

function SparkleLine() {
  return (
    <div className="sparkle-line" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function ListingImagePair({ listing }) {
  const originalImage = listing.item?.image ?? listing.image;
  const uploadedImage = sellerUploadImageForListing(listing);

  return (
    <div className="listing-image-pair">
      <figure>
        <img src={originalImage} alt="" />
        <figcaption>Original order photo</figcaption>
      </figure>
      <figure>
        <img src={uploadedImage} alt="" />
        <figcaption>Seller upload</figcaption>
      </figure>
    </div>
  );
}

function SellHubView({
  evaluation,
  filePreview,
  isSignedIn,
  isUploading,
  listingMessage,
  onEvaluate,
  onFileSelected,
  onOpenProfile,
  onPublish,
  onSelectOrder,
  orders,
  profileComplete,
  selectedOrder,
}) {
  if (!isSignedIn) {
    return (
      <main className="studio workspace-page c2c-workspace">
        <PageHeader
          eyebrow="Return items"
          title="Sign in before returning an item"
          description="A verified account ties returns to order proof and seller identity."
        />
        <SignInGate
          title="Seller actions are locked"
          detail="You can browse the shop without sign-in. Returning needs an account."
        />
      </main>
    );
  }

  if (!profileComplete) {
    return (
      <main className="studio workspace-page c2c-workspace">
        <PageHeader
          eyebrow="Return items"
          title="Address required before listing"
          description="Pickup and delivery estimates use your saved India address."
        />
        <ProfileGate onOpenSettings={onOpenProfile} />
      </main>
    );
  }

  return (
    <main className="studio workspace-page c2c-workspace">
      <PageHeader
        eyebrow="Return items"
        title="Choose an order"
        description="Upload today’s item photo for preliminary value before pickup review."
      />

      <div className="sell-grid">
        <section className="panel order-history-panel">
          <div className="panel-heading">
            <h2>Connected Amazon order history</h2>
            <Badge>Proof anchor</Badge>
          </div>
          <div className="order-proof-list">
            {orders.map((order) => (
              <OrderCard
                isSelected={selectedOrder?.id === order.id}
                key={order.id}
                onSelect={onSelectOrder}
                order={order}
              />
            ))}
          </div>
        </section>

        <section className="panel seller-upload-panel">
          <div className="panel-heading">
            <h2>Real item scan</h2>
            <Badge tone="neutral">AWS AI evidence</Badge>
          </div>
          {selectedOrder ? (
            <div className="selected-order-summary">
              <img src={selectedOrder.image} alt="" />
              <span>
                <strong>{selectedOrder.title}</strong>
                <small>
                  Original price {formatMarketplaceCurrency(selectedOrder.originalPrice)}
                </small>
              </span>
            </div>
          ) : (
            <p className="muted-copy">Select an order before uploading the resale photo.</p>
          )}
          <p className="condition-hint-copy">
            NexTurn compares the upload with order proof, metadata, and colour evidence.
          </p>
          <label className="upload-dropzone">
            <input
              type="file"
              accept="image/png,image/jpeg"
              disabled={!selectedOrder || isUploading}
              onChange={(event) => onFileSelected(event.target.files?.[0])}
            />
            {filePreview ? (
              <img src={filePreview} alt="Uploaded item preview" />
            ) : (
              <span>
                <Upload size={26} />
                Upload photo
              </span>
            )}
          </label>
          <button
            className="secondary-action"
            type="button"
            disabled={!selectedOrder || isUploading}
            onClick={onEvaluate}
          >
            {isUploading ? "Scanning..." : "Run grade"}
          </button>
          {listingMessage && <p className="status-copy">{listingMessage}</p>}
        </section>

        <EvaluationPanel
          evaluation={evaluation}
          isPublishing={isUploading}
          onPublish={onPublish}
        />
      </div>
    </main>
  );
}

function HeroListingCard({ listing, onAddToCart, onOpen, signedInCustomerId }) {
  const queueLabel = queueLabelForListing(listing, signedInCustomerId);
  const queueTone = listing.queueFilled ? "amber" : "green";
  const buyerCredits = Number(listing.greenCredits?.buyerQueue ?? 0);

  return (
    <article className={`hero-listing-card ${listing.queueFilled ? "queue-filled" : ""}`}>
      <button className="listing-image-button" type="button" onClick={() => onOpen(listing)}>
        <ListingImagePair listing={listing} />
      </button>
      <span className="listing-badge">Verified proof</span>
      <span className="queue-status-badge">
        <Badge tone={queueTone}>{queueLabel}</Badge>
      </span>
      <div>
        <strong>{listing.item.title}</strong>
        <small>
          {listing.grade.grade} · {listing.grade.label} · {listing.discountPercent}% off
        </small>
        <small>
          Seller: {listing.sellerName} · {listing.sellerCity}, {listing.sellerState}
        </small>
        <small>Purchased {listing.item.purchaseDate}</small>
        <small>
          {buyerCredits} green credits = {formatGreenCashback(buyerCredits)} cashback
        </small>
      </div>
      <footer>
        <span>
          <b>{formatMarketplaceCurrency(listing.price)}</b>
          <em>{listing.category ?? listing.item.marketplaceCategory ?? "Electronics"}</em>
        </span>
        <button type="button" onClick={() => onAddToCart(listing)}>
          <ShoppingCart size={15} /> Save
        </button>
      </footer>
    </article>
  );
}

function GenericItemCard({ item, onAddToCart, onOpen }) {
  return (
    <article className="generic-item-card">
      <button type="button" onClick={() => onOpen(item)}>
        <img src={item.image} alt="" />
      </button>
      <span>
        <strong>{item.title}</strong>
        <small>
          {item.category} · {item.sellerCity}, {item.sellerState}
        </small>
      </span>
      <footer>
        <b>{formatMarketplaceCurrency(item.price)}</b>
        <button type="button" onClick={() => onAddToCart(item)}>
          <ShoppingCart size={14} /> Add
        </button>
      </footer>
    </article>
  );
}

function MarketplaceView({
  categoryFilter,
  gradeFilter,
  isLoading,
  marketplace,
  onAddToCart,
  onCategoryChange,
  onGradeChange,
  onOpenListing,
  onPageChange,
  onPageSizeChange,
  onQueueFilterChange,
  onSearch,
  onSortChange,
  page,
  pageSize,
  queueFilter,
  searchTerm,
  signedInCustomerId,
  sortOption,
}) {
  const allCategories = useMemo(() => {
    const categories = new Set([
      ...marketplace.heroListings.map((listing) => listing.category ?? listing.item?.marketplaceCategory),
      ...marketplace.genericItems.map((item) => item.category),
    ]);
    return ["All categories", ...[...categories].filter(Boolean).sort()];
  }, [marketplace.genericItems, marketplace.heroListings]);

  const filteredGeneric = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const matches = (item) => {
      const matchesSearch =
        !query ||
        `${item.title} ${item.category} ${item.sellerCity ?? ""} ${item.sellerState ?? ""}`
          .toLowerCase()
          .includes(query);
      const matchesCategory =
        categoryFilter === "All categories" || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    };

    const items = marketplace.genericItems.filter(matches);
    return [...items].sort((a, b) => {
      if (sortOption === "Price: low to high") return Number(a.price ?? 0) - Number(b.price ?? 0);
      if (sortOption === "Price: high to low") return Number(b.price ?? 0) - Number(a.price ?? 0);
      if (sortOption === "Category") return String(a.category).localeCompare(String(b.category));
      return String(a.title).localeCompare(String(b.title));
    });
  }, [categoryFilter, marketplace.genericItems, searchTerm, sortOption]);

  const filteredHero = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const listings = marketplace.heroListings.filter((listing) => {
      const category = listing.category ?? listing.item?.marketplaceCategory ?? "Electronics";
      const matchesSearch =
        !query ||
        `${listing.item.title} ${category} ${listing.sellerName} ${listing.sellerCity ?? ""}`
          .toLowerCase()
          .includes(query);
      const matchesCategory = categoryFilter === "All categories" || category === categoryFilter;
      const matchesGrade = gradeFilter === "All grades" || listing.grade?.grade === gradeFilter;
      const matchesQueue =
        queueFilter === "All queues" ||
        (queueFilter === "Open queue" && !listing.queueFilled) ||
        (queueFilter === "Queue filled" && listing.queueFilled);
      return matchesSearch && matchesCategory && matchesGrade && matchesQueue;
    });
    return [...listings].sort((a, b) => {
      if (sortOption === "Newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortOption === "Price: low to high") return Number(a.price ?? 0) - Number(b.price ?? 0);
      if (sortOption === "Price: high to low") return Number(b.price ?? 0) - Number(a.price ?? 0);
      if (sortOption === "Grade") {
        return (gradeRank[b.grade?.grade] ?? 0) - (gradeRank[a.grade?.grade] ?? 0);
      }
      if (sortOption === "Green credits") {
        return Number(b.greenCredits?.buyerQueue ?? 0) - Number(a.greenCredits?.buyerQueue ?? 0);
      }
      if (sortOption === "Queue: open first") {
        return Number(a.queueFilled) - Number(b.queueFilled);
      }
      return String(a.item?.title ?? "").localeCompare(String(b.item?.title ?? ""));
    });
  }, [categoryFilter, gradeFilter, marketplace.heroListings, queueFilter, searchTerm, sortOption]);

  const pageCount = Math.max(1, Math.ceil(filteredGeneric.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedGeneric = filteredGeneric.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <main className="studio workspace-page c2c-workspace marketplace-page">
      <PageHeader
        eyebrow="Second-life shop"
        title="Verified finds"
        description="Browse verified listings. Queue first; pay after pickup review."
        action={
          <div className="market-toolbar">
            <label className="market-search">
              <Search size={16} />
              <input
                type="search"
                value={searchTerm}
                placeholder="Search second-life shop"
                onChange={(event) => onSearch(event.target.value)}
              />
            </label>
            <label className="filter-control">
              <SlidersHorizontal size={15} />
              <select value={categoryFilter} onChange={(event) => onCategoryChange(event.target.value)}>
                {allCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-control">
              <span>Grade</span>
              <select value={gradeFilter} onChange={(event) => onGradeChange(event.target.value)}>
                {["All grades", "A", "A-", "B+", "B", "C"].map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-control">
              <span>Queue</span>
              <select value={queueFilter} onChange={(event) => onQueueFilterChange(event.target.value)}>
                {["All queues", "Open queue", "Queue filled"].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-control">
              <span>Sort</span>
              <select value={sortOption} onChange={(event) => onSortChange(event.target.value)}>
                {[
                  "Newest",
                  "Price: low to high",
                  "Price: high to low",
                  "Grade",
                  "Green credits",
                  "Queue: open first",
                  "Category",
                ].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      />

      <section className="hero-market-section">
        <div className="section-heading">
          <h2>AI graded</h2>
          <Badge>{filteredHero.length} live listings</Badge>
        </div>
        <div className="hero-listing-grid">
          {filteredHero.map((listing) => (
            <HeroListingCard
              key={listing.id}
              listing={listing}
              onAddToCart={onAddToCart}
              onOpen={onOpenListing}
              signedInCustomerId={signedInCustomerId}
            />
          ))}
        </div>
      </section>

      <section className="generic-market-section">
        <div className="section-heading">
          <h2>Catalog</h2>
          <Badge tone="neutral">
            {isLoading ? "Loading" : `${filteredGeneric.length} public API items`}
          </Badge>
        </div>
        <div className="generic-grid">
          {pagedGeneric.map((item) => (
            <GenericItemCard
              key={item.id}
              item={item}
              onAddToCart={onAddToCart}
              onOpen={onOpenListing}
            />
          ))}
        </div>
        <footer className="pagination-bar">
          <span>
            Page {safePage} of {pageCount}
          </span>
          <label>
            Show
            <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div>
            <button type="button" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
              <ChevronLeft size={16} /> Prev
            </button>
            <button type="button" disabled={safePage >= pageCount} onClick={() => onPageChange(safePage + 1)}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}

function MyListingsView({ listings, onAddToCart, onOpenListing, signedInCustomerId }) {
  return (
    <main className="studio workspace-page c2c-workspace">
      <PageHeader
        eyebrow="My listings"
        title="Held at home"
        description="Pickup starts after a buyer queues and review is ready."
      />
      {listings.length ? (
        <div className="hero-listing-grid compact">
          {listings.map((listing) => (
            <HeroListingCard
              key={listing.id}
              listing={listing}
              onAddToCart={onAddToCart}
              onOpen={onOpenListing}
              signedInCustomerId={signedInCustomerId}
            />
          ))}
        </div>
      ) : (
        <section className="panel sign-in-gate">
          <PackageOpen size={24} />
          <h2>No active listings yet</h2>
          <p>Publish an item from Return items and it will appear here.</p>
        </section>
      )}
    </main>
  );
}

function ImpactView({ marketplace, queueItems }) {
  const verifiedListings = marketplace.heroListings.length;
  const queuedCount = queueItems.length;
  const queuedListings = marketplace.heroListings.filter((listing) => listing.queueFilled).length;
  const estimatedWeightKg = marketplace.heroListings.reduce(
    (sum, listing) => sum + Number(listing.item?.estimatedWeightKg ?? 0.4),
    0,
  );
  const avoidedHandlingEvents = verifiedListings + queuedCount;
  const estimatedEmissionsSaved = Math.max(0, Math.round(estimatedWeightKg * 18 + queuedCount * 1.5));
  const greenCreditsInPlay = marketplace.heroListings.reduce(
    (sum, listing) =>
      sum +
      Number(listing.greenCredits?.sellerListing ?? 0) +
      (listing.queueFilled ? Number(listing.greenCredits?.buyerQueue ?? 0) : 0),
    0,
  );
  const greenCreditCashback = formatGreenCashback(greenCreditsInPlay);

  return (
    <main className="studio workspace-page c2c-workspace">
      <PageHeader
        eyebrow="Impact"
        title="Second-life impact"
        description="Credits update when items are listed, queued, and reused."
      />
      <div className="metric-grid">
        <MetricCard
          label="Warehouse hops"
          value="0"
          detail={`${avoidedHandlingEvents} listing or queue events avoid a central return warehouse`}
          Icon={PackageCheck}
        />
        <MetricCard
          label="Buyer queues"
          value={queuedCount || queuedListings}
          detail="Payment intent without charging before pickup review"
          Icon={ShieldCheck}
        />
        <MetricCard
          label="Green credits"
          value={`${greenCreditsInPlay} credits`}
          detail={`${greenCreditCashback} Amazon Wallet value after pickup review`}
          Icon={Leaf}
        />
        <MetricCard
          label="Estimated CO2e saved"
          value={`${estimatedEmissionsSaved} kg`}
          detail="Estimated from item weight and avoided return handling"
          Icon={BadgeCheck}
        />
      </div>
      <section className="panel impact-explainer">
        <h2>What changes these numbers?</h2>
        <p>
          A seller listing adds verified inventory. A buyer queue claim signals
          demand without charging the buyer. Green credits convert at 2 credits =
          ₹1 Amazon Wallet cashback once pickup review confirms the item is
          actually reused.
        </p>
      </section>
    </main>
  );
}

function SettingsView({
  greenCredits,
  isSavingProfile,
  onProfileChange,
  onProfileSave,
  onThemeToggle,
  profileComplete,
  profileDraft,
  profileMessage,
  theme,
}) {
  const selectedLocationValue = `${profileDraft.address?.city ?? defaultBuyerLocation.city}|${profileDraft.address?.state ?? defaultBuyerLocation.state}`;
  const greenCreditCashback = formatGreenCashback(greenCredits);

  return (
    <main className="studio workspace-page c2c-workspace">
      <PageHeader
        eyebrow="Profile"
        title="Profile"
        description="Save an India address to return, queue, and estimate delivery."
      />
      <section className="profile-credit-card" aria-label="Green credits balance">
        <span>
          <Leaf size={22} />
          Green credits
        </span>
        <strong>{greenCredits} credits</strong>
        <p>{greenCreditCashback} Amazon Wallet value after pickup review.</p>
        <small>2 credits = ₹1 cashback once a second-life transaction is verified.</small>
      </section>
      <section className="panel settings-panel c2c-settings">
        <div className="settings-row">
          <span>
            <strong>Address line</strong>
            <small>Required before listing or joining a buyer queue.</small>
          </span>
          <input
            className="settings-input"
            value={profileDraft.address?.addressLine ?? ""}
            placeholder="Flat / house, street, area"
            onChange={(event) =>
              onProfileChange({
                address: {
                  ...(profileDraft.address ?? {}),
                  addressLine: event.target.value,
                },
              })
            }
          />
        </div>
        <div className="settings-row">
          <span>
            <strong>City and state</strong>
            <small>Used with seller address for route-based delivery fee.</small>
          </span>
          <select
            className="settings-select"
            value={selectedLocationValue}
            onChange={(event) => {
              const [city, state] = event.target.value.split("|");
              const next = indianServiceLocations.find(
                (location) => location.city === city && location.state === state,
              );
              if (next) {
                onProfileChange({
                  address: {
                    ...(profileDraft.address ?? {}),
                    city: next.city,
                    state: next.state,
                    country: "IN",
                  },
                });
              }
            }}
          >
            {indianServiceLocations.map((location) => (
              <option key={`${location.city}-${location.state}`} value={`${location.city}|${location.state}`}>
                {location.city}, {location.state}
              </option>
            ))}
          </select>
        </div>
        <div className="settings-row">
          <span>
            <strong>PIN code</strong>
            <small>Required for profile completeness.</small>
          </span>
          <input
            className="settings-input"
            value={profileDraft.address?.pincode ?? ""}
            placeholder="390001"
            onChange={(event) =>
              onProfileChange({
                address: {
                  ...(profileDraft.address ?? {}),
                  pincode: event.target.value,
                  country: "IN",
                },
              })
            }
          />
        </div>
        <div className="settings-row">
          <span>
            <strong>Profile status</strong>
            <small>{profileMessage || "Save an address to unlock queues and listings."}</small>
          </span>
          <button className="settings-button" type="button" onClick={onProfileSave} disabled={isSavingProfile}>
            <MapPin size={16} />
            {isSavingProfile ? "Saving..." : profileComplete ? "Update profile" : "Save profile"}
          </button>
        </div>
        <div className="settings-row">
          <span>
            <strong>Theme</strong>
            <small>Switch between light and dark dashboard modes.</small>
          </span>
          <button className="settings-button" type="button" onClick={onThemeToggle}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
        <div className="settings-row">
          <span>
            <strong>Warehouse involvement</strong>
            <small>Disabled by product rule. Seller holds item until pickup review.</small>
          </span>
          <Badge>No warehouse</Badge>
        </div>
        <div className="settings-row">
          <span>
            <strong>Payment</strong>
            <small>Locked until pickup partner verifies identity, colour/variant, and condition.</small>
          </span>
          <Badge tone="neutral">Manual review first</Badge>
        </div>
      </section>
    </main>
  );
}

function ListingDrawer({
  buyerLocation,
  isSignedIn,
  listing,
  onAddToCart,
  onClose,
  onJoinQueue,
  profileComplete,
  queueState,
  signedInCustomerId,
}) {
  if (!listing) return null;

  const isHero = listing.source === "nexturn-ai-graded";
  const isOwnListing = isHero && listing.sellerId === signedInCustomerId;
  const localJoinedQueue = queueState?.interest?.listingId === listing.id;
  const joinedQueue =
    localJoinedQueue ||
    (isHero && listing.queueFilled && listing.queueBuyerId === signedInCustomerId);
  const queueFilledByOther = isHero && listing.queueFilled && !joinedQueue;
  const delivery = calculateDeliveryFee({
    buyerLocation,
    sellerLocation: listing.sellerLocation,
    weightKg: listing.item?.estimatedWeightKg,
  });
  const deliveryFee = delivery.allowed ? delivery.fee : Number(listing.deliveryFee ?? 0);
  const queueActionLabel = !isSignedIn
    ? "Sign in"
    : !profileComplete
      ? "Add address"
      : isOwnListing
        ? "Your listing"
        : queueFilledByOther
          ? "Queue filled"
          : queueState?.status === "loading"
            ? "Joining..."
            : "Join queue";

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="drawer-panel listing-detail-drawer"
        aria-label={isHero ? listing.item.title : listing.title}
        aria-modal="true"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{isHero ? listing.item.title : listing.title}</h2>
          <button type="button" aria-label="Close panel" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        {isHero ? (
          <div className="drawer-body">
            <ListingImagePair listing={listing} />
            <div className="listing-price-block">
              <span>{listing.badge}</span>
              <strong>{formatMarketplaceCurrency(listing.price)}</strong>
              <small>
                Preliminary value · original {formatMarketplaceCurrency(listing.item.originalPrice)}
              </small>
            </div>
            <section className="proof-box">
              <h3>Original Amazon proof</h3>
              <p>
                Order # {listing.item.id} · Purchased {listing.item.purchaseDate} · ASIN{" "}
                {listing.item.asin}
              </p>
              <p>{listing.item.proofNote}</p>
            </section>
            <section className="proof-box green-credit-proof">
              <h3>Green credit incentive</h3>
              <p>
                Seller earns {listing.greenCredits?.sellerListing ?? 0} credits for
                listing a verified second-life item. Buyer earns{" "}
                {listing.greenCredits?.buyerQueue ?? 0} credits after pickup review.
                Credits convert at 2 credits = ₹1 Amazon Wallet cashback.
              </p>
              <p>
                Buyer cashback value: {formatGreenCashback(listing.greenCredits?.buyerQueue ?? 0)}.
                Estimated avoided impact: {listing.greenCredits?.estimatedCo2eKg ?? 0} kg CO2e.
              </p>
            </section>
            <section className="proof-box">
              <h3>Seller and delivery route</h3>
              <p>
                Seller: {listing.sellerName} · {listing.sellerCity}, {listing.sellerState}
              </p>
              <p>
                Buyer: {buyerLocation.city}, {buyerLocation.state} ·{" "}
                {delivery.distanceKm ? `${delivery.distanceKm} km route estimate` : delivery.message}
              </p>
            </section>
            <section className="proof-box">
              <h3>Preliminary AI check</h3>
              <div className="ai-evidence-grid compact">
                <span>
                  <small>Product match</small>
                  <strong>{Math.round(listing.review?.productMatchScore ?? listing.scorecard?.identityScore ?? 0)}%</strong>
                </span>
                <span>
                  <small>Colour / variant</small>
                  <strong>{listing.review?.colorStatus === "mismatch" ? "Review" : "Checked"}</strong>
                </span>
                <span>
                  <small>Payment</small>
                  <strong>Locked</strong>
                </span>
              </div>
              <p>
                Preliminary grade {listing.grade.grade}: {listing.grade.summary}
              </p>
            </section>
            <section className="checkout-split">
              <h3>Payment unlock preview</h3>
              <div>
                <span>Preliminary item value</span>
                <b>{formatMarketplaceCurrency(listing.price)}</b>
              </div>
              <div>
                <span>Estimated delivery fee</span>
                <b>{formatMarketplaceCurrency(deliveryFee)}</b>
              </div>
              <div>
                <span>Estimated total after review</span>
                <b>{formatMarketplaceCurrency(listing.price + deliveryFee)}</b>
              </div>
            </section>
            <p className="seller-hold-note">
              The AI grade is preliminary and may change. Payment opens only after
              the delivery partner manually verifies the item during seller pickup.
            </p>
            <p className="seller-hold-note">{listing.logistics}</p>
            {joinedQueue ? (
              <section className="payment-success">
                <BadgeCheck size={22} />
                <strong>Joined buyer queue</strong>
                <span>
                  Payment is locked until pickup verification.
                  {queueState?.interest?.id ? ` Queue ID ${queueState.interest.id}.` : ""}
                </span>
              </section>
            ) : queueFilledByOther ? (
              <section className="payment-success queue-closed">
                <ShieldCheck size={22} />
                <strong>Queue filled</strong>
                <span>
              Another buyer is first in line. Use the queue filter to find listings
                  still open for review priority.
                </span>
              </section>
            ) : (
              <div className="drawer-actions">
                <button className="secondary-action" type="button" onClick={() => onAddToCart(listing)}>
                  <ShoppingCart size={17} /> Save
                </button>
                <button
                  className="primary-action"
                  type="button"
                  disabled={
                    !isSignedIn ||
                    !profileComplete ||
                    isOwnListing ||
                    queueFilledByOther ||
                    queueState?.status === "loading" ||
                    !delivery.allowed
                  }
                  onClick={() => onJoinQueue(listing)}
                >
                  <CircleDollarSign size={17} />
                  {queueActionLabel}
                </button>
              </div>
            )}
            {queueState?.error && <p className="auth-error">{queueState.error}</p>}
          </div>
        ) : (
          <div className="drawer-body">
            <img className="drawer-hero-image" src={listing.image} alt="" />
            <div className="listing-price-block">
              <span>Catalog item</span>
              <strong>{formatMarketplaceCurrency(listing.price)}</strong>
              <small>
                {listing.category} · {listing.sellerCity}, {listing.sellerState}
              </small>
            </div>
            <p className="drawer-copy">
              This item fills the broader shop catalog from a public API. It can be
              added to cart for browsing, while full order proof and AI grading are
              available on NexTurn verified listings.
            </p>
            <button className="secondary-action" type="button" onClick={() => onAddToCart(listing)}>
              <ShoppingCart size={17} /> Save
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function CartDrawer({ buyerLocation, cartItems, onClose, onOpenListing, onRemove }) {
  if (!cartItems) return null;

  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price ?? 0), 0);
  const deliveryTotal = cartItems.reduce((sum, item) => {
    const delivery = calculateDeliveryFee({
      buyerLocation,
      sellerLocation: item.sellerLocation,
      weightKg: item.item?.estimatedWeightKg,
    });
    return sum + (delivery.allowed ? delivery.fee : 0);
  }, 0);

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="drawer-panel cart-drawer"
        aria-label="Cart"
        aria-modal="true"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
        <h2>Saved items</h2>
          <button type="button" aria-label="Close cart" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="drawer-body">
          {cartItems.length ? (
            cartItems.map((item) => {
              const isHero = item.source === "nexturn-ai-graded";
              const title = isHero ? item.item.title : item.title;
              const delivery = calculateDeliveryFee({
                buyerLocation,
                sellerLocation: item.sellerLocation,
                weightKg: item.item?.estimatedWeightKg,
              });

              return (
                <section className="cart-row" key={item.id}>
                  <img src={item.image} alt="" />
                  <span>
                    <strong>{title}</strong>
                    <small>
                      {item.sellerCity}, {item.sellerState} ·{" "}
                      {delivery.allowed ? formatMarketplaceCurrency(delivery.fee) : "Not deliverable"}
                    </small>
                    <b>{formatMarketplaceCurrency(item.price)}</b>
                  </span>
                  <div>
                    <button type="button" onClick={() => onOpenListing(item)}>
                      View
                    </button>
                    <button type="button" onClick={() => onRemove(item.id)}>
                      Remove
                    </button>
                  </div>
                </section>
              );
            })
          ) : (
            <section className="panel sign-in-gate empty-cart">
              <ShoppingCart size={24} />
              <h2>Your cart is empty</h2>
              <p>Add verified listings or catalog items while browsing.</p>
            </section>
          )}
          <section className="checkout-split">
            <h3>Saved estimate</h3>
            <div>
              <span>Item subtotal</span>
              <b>{formatMarketplaceCurrency(subtotal)}</b>
            </div>
            <div>
              <span>Estimated delivery fees</span>
              <b>{formatMarketplaceCurrency(deliveryTotal)}</b>
            </div>
            <div>
              <span>Total</span>
              <b>{formatMarketplaceCurrency(subtotal + deliveryTotal)}</b>
            </div>
          </section>
          <p className="seller-hold-note">
            Saving does not reserve or charge anything. Open a verified listing and
            join the buyer queue when you want pickup-review priority.
          </p>
        </div>
      </aside>
    </div>
  );
}

function CompanyFooter() {
  return (
    <footer className="company-footer">
      <span>NexTurn Sustainable Commerce Labs</span>
      <span>India C2C network · Built for Amazon-integrated return workflows</span>
      <a href="mailto:support@nexturn.example">support@nexturn.example</a>
      <span>© 2026 NexTurn. Payment capture stays locked until pickup review.</span>
    </footer>
  );
}

export function App() {
  const [activeView, setActiveView] = useState("marketplace");
  const [auth, setAuth] = useState({
    status: "loading",
    config: null,
    session: null,
    error: null,
  });
  const [buyerLocation, setBuyerLocation] = useState(defaultBuyerLocation);
  const [cartItems, setCartItems] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [evaluation, setEvaluation] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [gradeFilter, setGradeFilter] = useState("All grades");
  const [isCartOpen, setCartOpen] = useState(false);
  const [isLoadingMarketplace, setLoadingMarketplace] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [listingMessage, setListingMessage] = useState("");
  const [marketplace, setMarketplace] = useState({
    heroListings: [],
    genericItems: [],
  });
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [profileDraft, setProfileDraft] = useState({
    address: {
      addressLine: "",
      city: defaultBuyerLocation.city,
      state: defaultBuyerLocation.state,
      country: "IN",
      pincode: "",
    },
  });
  const [profileMessage, setProfileMessage] = useState("");
  const [isSavingProfile, setSavingProfile] = useState(false);
  const [queueItems, setQueueItems] = useState([]);
  const [queueFilter, setQueueFilter] = useState("All queues");
  const [queueState, setQueueState] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedListing, setSelectedListing] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sortOption, setSortOption] = useState("Newest");
  const [theme, setTheme] = useState("light");

  const isSignedIn = Boolean(auth.session);
  const normalizedProfile = normalizeCustomerProfile(profileDraft);
  const profileComplete = isSignedIn && normalizedProfile.complete;
  const signedInCustomerId = auth.session?.user?.subject
    ? `cognito#${auth.session.user.subject}`
    : undefined;
  const myListings = useMemo(
    () =>
      marketplace.heroListings.filter(
        (listing) => listing.sellerId && listing.sellerId === signedInCustomerId,
      ),
    [marketplace.heroListings, signedInCustomerId],
  );
  const greenCreditBalance = useMemo(() => {
    const sellerCredits = myListings.reduce(
      (sum, listing) => sum + Number(listing.greenCredits?.sellerListing ?? 0),
      0,
    );
    const buyerCredits = queueItems.reduce(
      (sum, item) => sum + Number(item.greenCreditsPending ?? 0),
      0,
    );
    return sellerCredits + buyerCredits;
  }, [myListings, queueItems]);

  useEffect(() => {
    let isMounted = true;
    initializeAuth().then((result) => {
      if (!isMounted) return;
      setAuth({
        status: "ready",
        config: result.config,
        session: result.session,
        error: result.error,
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    refreshMarketplace();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, gradeFilter, pageSize, queueFilter, searchTerm, sortOption]);

  useEffect(() => {
    if (!isSignedIn) {
      setOrders([]);
      setSelectedOrder(null);
      setProfileMessage("");
      return;
    }

    fetchC2CProfile()
      .then((payload) => {
        if (payload.profile?.address) {
          setProfileDraft({ address: payload.profile.address });
          setBuyerLocation(payload.profile.address);
          setProfileMessage("Profile address loaded.");
        }
      })
      .catch((error) => {
        setProfileMessage(error.message);
      });

    fetchC2COrders()
      .then((payload) => {
        setOrders(payload.orders ?? []);
        setSelectedOrder((current) => current ?? payload.orders?.[0] ?? null);
      })
      .catch((error) => {
        setListingMessage(error.message);
      });
  }, [isSignedIn]);

  useEffect(() => {
    if (normalizedProfile.address) {
      setBuyerLocation(normalizedProfile.address);
    }
  }, [
    normalizedProfile.address?.addressLine,
    normalizedProfile.address?.city,
    normalizedProfile.address?.pincode,
    normalizedProfile.address?.state,
  ]);

  async function refreshMarketplace() {
    setLoadingMarketplace(true);
    try {
      const payload = await fetchC2CMarketplace();
      setMarketplace({
        heroListings: payload.heroListings ?? [],
        genericItems: payload.genericItems ?? [],
      });
    } catch (error) {
      setListingMessage(error.message);
    } finally {
      setLoadingMarketplace(false);
    }
  }

  function navigate(view) {
    setActiveView(view);
    setSelectedListing(null);
    setCartOpen(false);
  }

  async function handleSignIn(provider) {
    try {
      await signIn(auth.config, provider);
    } catch (error) {
      setAuth((current) => ({
        ...current,
        status: "ready",
        error: error.message,
      }));
    }
  }

  function handleSignOut() {
    signOut(auth.config);
  }

  function handleSelectOrder(order) {
    setSelectedOrder(order);
    setEvaluation(null);
    setListingMessage("");
  }

  function handleFileSelected(file) {
    if (!file) return;
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
    setEvaluation(null);
    setListingMessage("Photo ready. Run grade.");
  }

  async function handleEvaluate() {
    if (!selectedOrder || !selectedFile) {
      setListingMessage("Select an order and upload the real item photo first.");
      return;
    }

    setUploading(true);
    setListingMessage("Running AWS AI visual and colour/variant evidence...");
    try {
      const result = await evaluateC2CListingUpload(selectedFile, selectedOrder.id, normalizedProfile);
      setEvaluation(result);
      setListingMessage(result.customerMessage ?? "AI grade ready.");
    } catch (error) {
      setListingMessage(error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handlePublish() {
    if (!selectedOrder || !selectedFile) {
      setListingMessage("Upload and grade the item before listing.");
      return;
    }

    setUploading(true);
    setListingMessage("Listing in the second-life shop...");
    try {
      const result = await createC2CListing(selectedFile, selectedOrder.id, normalizedProfile);
      setListingMessage(result.customerMessage ?? "Listing published.");
      await refreshMarketplace();
      setSelectedListing(result.listing);
      setActiveView("marketplace");
    } catch (error) {
      setListingMessage(error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleJoinQueue(listing) {
    if (!profileComplete) {
      setQueueState({
        status: "error",
        error: "Add your profile address before joining a buyer queue.",
      });
      setActiveView("settings");
      return;
    }

    setQueueState({ status: "loading" });
    try {
      const result = await joinC2CInterestQueue(listing.id, normalizedProfile);
      const queuedListing = result.listing ?? {
        ...listing,
        queueFilled: true,
        queueStatus: "filled",
        queueBuyerId: signedInCustomerId,
        queueInterestId: result.interest?.id,
        interestCount: 1,
      };
      setQueueState({
        status: "success",
        interest: result.interest,
        message: result.customerMessage,
      });
      setQueueItems((current) =>
        !result.interest || current.some((item) => item.id === result.interest.id)
          ? current
          : [...current, result.interest],
      );
      setSelectedListing(queuedListing);
      setMarketplace((current) => ({
        ...current,
        heroListings: current.heroListings.map((item) =>
          item.id === queuedListing.id ? queuedListing : item,
        ),
      }));
      await refreshMarketplace();
    } catch (error) {
      setQueueState({
        status: "error",
        error: error.message,
      });
    }
  }

  function handleOpenListing(listing) {
    setQueueState(null);
    setSelectedListing(listing);
    setCartOpen(false);
  }

  function handleAddToCart(item) {
    if (!isSignedIn) {
      setListingMessage("Sign in before saving or queuing shop items.");
      return;
    }
    setCartItems((current) =>
      current.some((cartItem) => cartItem.id === item.id) ? current : [...current, item],
    );
    setListingMessage(`${item.item?.title ?? item.title} saved.`);
  }

  function handleRemoveFromCart(itemId) {
    setCartItems((current) => current.filter((item) => item.id !== itemId));
  }

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function updateProfileDraft(patch) {
    setProfileDraft((current) => ({
      ...current,
      ...patch,
      address: {
        ...(current.address ?? {}),
        ...(patch.address ?? {}),
      },
    }));
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileMessage("Saving profile address...");
    try {
      const result = await saveC2CProfile(profileDraft);
      setProfileDraft({ address: result.profile.address });
      setBuyerLocation(result.profile.address);
      setProfileMessage(result.customerMessage ?? "Profile address saved.");
    } catch (error) {
      setProfileMessage(error.message);
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className={`app-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        activeView={activeView}
        auth={auth}
        collapsed={isSidebarCollapsed}
        greenCredits={greenCreditBalance}
        location={buyerLocation}
        onGoogleSignIn={() => handleSignIn("Google")}
        onNavigate={navigate}
        onSignIn={() => handleSignIn()}
        onSignOut={handleSignOut}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
      />
      <TopCommandBar
        cartCount={cartItems.length}
        location={buyerLocation}
        onCartOpen={() => {
          setSelectedListing(null);
          setCartOpen(true);
        }}
        onThemeToggle={toggleTheme}
        theme={theme}
      />

      {activeView === "home" && (
        <OverviewView
          isSignedIn={isSignedIn}
          marketplace={marketplace}
          onNavigate={navigate}
          orders={orders}
        />
      )}
      {activeView === "sell" && (
        <SellHubView
          evaluation={evaluation}
          filePreview={filePreview}
          isSignedIn={isSignedIn}
          isUploading={isUploading}
          listingMessage={listingMessage}
          onEvaluate={handleEvaluate}
          onFileSelected={handleFileSelected}
          onOpenProfile={() => setActiveView("settings")}
          onPublish={handlePublish}
          onSelectOrder={handleSelectOrder}
          orders={orders}
          profileComplete={profileComplete}
          selectedOrder={selectedOrder}
        />
      )}
      {activeView === "marketplace" && (
        <MarketplaceView
          categoryFilter={categoryFilter}
          gradeFilter={gradeFilter}
          isLoading={isLoadingMarketplace}
          marketplace={marketplace}
          onAddToCart={handleAddToCart}
          onCategoryChange={setCategoryFilter}
          onGradeChange={setGradeFilter}
          onOpenListing={handleOpenListing}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onQueueFilterChange={setQueueFilter}
          onSearch={setSearchTerm}
          onSortChange={setSortOption}
          page={page}
          pageSize={pageSize}
          queueFilter={queueFilter}
          searchTerm={searchTerm}
          signedInCustomerId={signedInCustomerId}
          sortOption={sortOption}
        />
      )}
      {activeView === "listings" && (
        <MyListingsView
          listings={myListings}
          onAddToCart={handleAddToCart}
          onOpenListing={handleOpenListing}
          signedInCustomerId={signedInCustomerId}
        />
      )}
      {activeView === "impact" && <ImpactView marketplace={marketplace} queueItems={queueItems} />}
      {activeView === "settings" && (
        <SettingsView
          greenCredits={greenCreditBalance}
          isSavingProfile={isSavingProfile}
          onProfileChange={updateProfileDraft}
          onProfileSave={handleSaveProfile}
          onThemeToggle={toggleTheme}
          profileComplete={profileComplete}
          profileDraft={profileDraft}
          profileMessage={profileMessage}
          theme={theme}
        />
      )}
      <CompanyFooter />

      <ListingDrawer
        buyerLocation={buyerLocation}
        isSignedIn={isSignedIn}
        listing={selectedListing}
        onAddToCart={handleAddToCart}
        onClose={() => setSelectedListing(null)}
        onJoinQueue={handleJoinQueue}
        profileComplete={profileComplete}
        queueState={queueState}
        signedInCustomerId={signedInCustomerId}
      />
      <CartDrawer
        buyerLocation={buyerLocation}
        cartItems={isCartOpen ? cartItems : null}
        onClose={() => setCartOpen(false)}
        onOpenListing={handleOpenListing}
        onRemove={handleRemoveFromCart}
      />
    </div>
  );
}
