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
  { id: "sell", label: "Sell / Return items", Icon: PackageOpen },
  { id: "marketplace", label: "Buy / Marketplace", Icon: Store },
  { id: "listings", label: "My listings", Icon: ReceiptText },
  { id: "impact", label: "Impact", Icon: Leaf },
  { id: "settings", label: "Settings", Icon: Settings },
];

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
        <span>Buyer and seller</span>
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
      <span>{auth.config?.enabled ? "Unified account" : "Auth unavailable"}</span>
      <strong>Sign in to buy or sell</strong>
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
        G Google
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
      <small>Google sign-in or email sign-in unlocks the same Buyer + Seller account.</small>
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
        <Settings size={17} /> Open profile
      </button>
    </section>
  );
}

function OverviewView({ isSignedIn, marketplace, onNavigate, orders }) {
  const activeHeroCount = marketplace.heroListings.length;

  return (
    <main className="studio workspace-page c2c-workspace">
      <PageHeader
        eyebrow="Direct customer-to-customer commerce"
        title="Returned items stay with people, not warehouses"
        description="NexTurn uses Amazon order history as authenticity proof, grades the real item photo with AWS AI evidence, then lists it directly for another customer."
      />
      <div className="metric-grid">
        <MetricCard
          label="Unified account"
          value={isSignedIn ? "Active" : "Locked"}
          detail="One account can sell and buy"
          Icon={ShieldCheck}
        />
        <MetricCard
          label="Order proof"
          value={`${orders.length || 5} items`}
          detail="Connected order history anchors authenticity"
          Icon={Boxes}
        />
        <MetricCard
          label="Marketplace"
          value={`${activeHeroCount}+ hero`}
          detail="AI graded listings injected above generic feed"
          Icon={Store}
        />
      </div>
      <div className="c2c-journey">
        <button type="button" onClick={() => onNavigate("sell")}>
          <PackageOpen size={24} />
          <span>
            <strong>Sell from order history</strong>
            <small>Pick a verified purchase, upload the real item, get grade and price.</small>
          </span>
          <ChevronRight size={18} />
        </button>
        <button type="button" onClick={() => onNavigate("marketplace")}>
          <ShoppingBag size={24} />
          <span>
            <strong>Buy AI-graded second-life items</strong>
            <small>See proof, preliminary AI review, seller location, and queue rules.</small>
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
        <h2>AI grade appears here after upload</h2>
        <p>
          Upload the real item photo. AWS Rekognition checks identity evidence and
          NexTurn calculates a preliminary grade and value before pickup review.
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
          <span>{isBlocked ? "Product identity mismatch" : "Preliminary AI review"}</span>
          <strong>{listing.grade.grade}</strong>
          <small>{listing.grade.summary}</small>
        </div>
        <Badge tone={isBlocked ? "danger" : listing.grade.grade === "C" ? "amber" : "green"}>
          {listing.grade.confidence}
        </Badge>
      </div>
      {isBlocked && (
        <p className="identity-block-note">
          {listing.blockingReason} NexTurn will not list this item until the uploaded
          photo matches the selected Amazon order.
        </p>
      )}
      <AiEvidenceSummary aiAnalysis={evaluation.aiAnalysis} />
      {evaluation.aiAnalysis?.summary && <p className="ai-summary-note">{evaluation.aiAnalysis.summary}</p>}
      <div className="price-split">
        <span>{isBlocked ? "Listing status" : "Preliminary resale value"}</span>
        <strong>{isBlocked ? "Blocked" : formatMarketplaceCurrency(listing.price)}</strong>
        <small>
          {isBlocked
            ? "Wrong-product uploads are stopped before marketplace publishing."
            : "Final payable value opens only after manual pickup review."}
        </small>
      </div>
      <p className="seller-hold-note">
        This AI grade is preliminary and can change. You keep the item at your
        house; buyers join a queue, and payment unlocks only after pickup review.
      </p>
      <button
        className="primary-action"
        type="button"
        disabled={isPublishing || isBlocked}
        onClick={onPublish}
      >
        <Store size={17} />{" "}
        {isBlocked
          ? "Cannot list mismatched item"
          : isPublishing
            ? "Publishing..."
            : "List on NexTurn Marketplace"}
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
          eyebrow="Sell / Return items"
          title="Sign in before listing a product"
          description="Selling requires a verified NexTurn account so the item can be tied to order history and a seller identity."
        />
        <SignInGate
          title="Seller actions are locked"
          detail="A public visitor can browse the marketplace, but listing an item requires authentication."
        />
      </main>
    );
  }

  if (!profileComplete) {
    return (
      <main className="studio workspace-page c2c-workspace">
        <PageHeader
          eyebrow="Sell / Return items"
          title="Address required before listing"
          description="Seller pickup fees and buyer delivery estimates depend on the address saved in your NexTurn profile."
        />
        <ProfileGate onOpenSettings={onOpenProfile} />
      </main>
    );
  }

  return (
    <main className="studio workspace-page c2c-workspace">
      <PageHeader
        eyebrow="Sell / Return items"
        title="Choose a verified Amazon purchase"
        description="The connected order history below acts as the proof-of-authenticity anchor. The uploaded item photo is compared against this order proof before pricing."
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
            No manual condition labels are used. NexTurn compares the uploaded photo
            against the order proof image, product metadata, and colour/variant evidence.
            The grade is preliminary until pickup review.
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
                Upload real-time item photo
              </span>
            )}
          </label>
          <button
            className="secondary-action"
            type="button"
            disabled={!selectedOrder || isUploading}
            onClick={onEvaluate}
          >
            {isUploading ? "Running AI grade..." : "Run AI grade"}
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

function HeroListingCard({ listing, onAddToCart, onOpen }) {
  return (
    <article className="hero-listing-card">
      <button className="listing-image-button" type="button" onClick={() => onOpen(listing)}>
        <img src={listing.image} alt="" />
      </button>
      <span className="listing-badge">{listing.badge}</span>
      <div>
        <strong>{listing.item.title}</strong>
        <small>
          {listing.grade.grade} · {listing.grade.label} · {listing.discountPercent}% off
        </small>
        <small>
          Seller: {listing.sellerName} · {listing.sellerCity}, {listing.sellerState}
        </small>
        <small>Purchased {listing.item.purchaseDate}</small>
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
  onSearch,
  page,
  pageSize,
  searchTerm,
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

    return marketplace.genericItems.filter(matches);
  }, [categoryFilter, marketplace.genericItems, searchTerm]);

  const filteredHero = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return marketplace.heroListings.filter((listing) => {
      const category = listing.category ?? listing.item?.marketplaceCategory ?? "Electronics";
      const matchesSearch =
        !query ||
        `${listing.item.title} ${category} ${listing.sellerName} ${listing.sellerCity ?? ""}`
          .toLowerCase()
          .includes(query);
      const matchesCategory = categoryFilter === "All categories" || category === categoryFilter;
      const matchesGrade = gradeFilter === "All grades" || listing.grade?.grade === gradeFilter;
      return matchesSearch && matchesCategory && matchesGrade;
    });
  }, [categoryFilter, gradeFilter, marketplace.heroListings, searchTerm]);

  const pageCount = Math.max(1, Math.ceil(filteredGeneric.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedGeneric = filteredGeneric.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <main className="studio workspace-page c2c-workspace marketplace-page">
      <PageHeader
        eyebrow="Buy / Marketplace"
        title="Second-life items with proof you can inspect"
        description="Join the buyer queue for AI-reviewed listings. Actual payment unlocks only after pickup verification confirms item identity, colour, and condition."
        action={
          <div className="market-toolbar">
            <label className="market-search">
              <Search size={16} />
              <input
                type="search"
                value={searchTerm}
                placeholder="Search marketplace"
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
          </div>
        }
      />

      <section className="hero-market-section">
        <div className="section-heading">
          <h2>AI Graded & Amazon Verified</h2>
          <Badge>{filteredHero.length} live listings</Badge>
        </div>
        <div className="hero-listing-grid">
          {filteredHero.map((listing) => (
            <HeroListingCard
              key={listing.id}
              listing={listing}
              onAddToCart={onAddToCart}
              onOpen={onOpenListing}
            />
          ))}
        </div>
      </section>

      <section className="generic-market-section">
        <div className="section-heading">
          <h2>Marketplace background feed</h2>
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
              <ChevronLeft size={16} /> Previous
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

function MyListingsView({ listings, onAddToCart, onOpenListing }) {
  return (
    <main className="studio workspace-page c2c-workspace">
      <PageHeader
        eyebrow="My listings"
        title="Items you are holding at home"
        description="NexTurn coordinates pickup after a buyer joins the queue and pickup verification is ready. Until then, the product remains with the seller."
      />
      {listings.length ? (
        <div className="hero-listing-grid compact">
          {listings.map((listing) => (
            <HeroListingCard
              key={listing.id}
              listing={listing}
              onAddToCart={onAddToCart}
              onOpen={onOpenListing}
            />
          ))}
        </div>
      ) : (
        <section className="panel sign-in-gate">
          <PackageOpen size={24} />
          <h2>No active listings yet</h2>
          <p>Publish an item from the Sell / Return hub and it will appear here.</p>
        </section>
      )}
    </main>
  );
}

function ImpactView({ marketplace, queueItems }) {
  const verifiedListings = marketplace.heroListings.length;
  const queuedCount = queueItems.length;
  const estimatedWeightKg = marketplace.heroListings.reduce(
    (sum, listing) => sum + Number(listing.item?.estimatedWeightKg ?? 0.4),
    0,
  );
  const avoidedHandlingEvents = verifiedListings + queuedCount;
  const estimatedEmissionsSaved = Math.max(0, Math.round(estimatedWeightKg * 18 + queuedCount * 1.5));

  return (
    <main className="studio workspace-page c2c-workspace">
      <PageHeader
        eyebrow="Impact"
        title="Impact updates from real marketplace events"
        description="The impact tab is useful only if it reflects actions: listings created from order proof, buyers joining queues, pickup reviews, and warehouse hops avoided."
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
          value={queuedCount}
          detail="Payment intent without charging before pickup review"
          Icon={ShieldCheck}
        />
        <MetricCard
          label="Estimated CO2e saved"
          value={`${estimatedEmissionsSaved} kg`}
          detail="Prototype estimate from item weight and avoided handling"
          Icon={BadgeCheck}
        />
      </div>
      <section className="panel impact-explainer">
        <h2>What changes these numbers?</h2>
        <p>
          A seller listing increases order-proof inventory. A buyer joining the
          queue increases demand without collecting payment. Pickup verification
          would unlock payment and confirm the final item value. In production,
          these events would be written to a ledger and recalculated from actual
          pickup, delivery, and resale outcomes.
        </p>
      </section>
    </main>
  );
}

function SettingsView({
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

  return (
    <main className="studio workspace-page c2c-workspace">
      <PageHeader
        eyebrow="Profile"
        title="Address unlocks buying and selling"
        description="NexTurn uses saved buyer and seller addresses to estimate delivery fees. No live location is required, and India-only addresses are accepted in this prototype."
      />
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
            <small>Disabled by product rule. Seller holds item until sale.</small>
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
  const delivery = calculateDeliveryFee({
    buyerLocation,
    sellerLocation: listing.sellerLocation,
    weightKg: listing.item?.estimatedWeightKg,
  });
  const deliveryFee = delivery.allowed ? delivery.fee : Number(listing.deliveryFee ?? 0);

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
            <img className="drawer-hero-image" src={listing.image} alt="" />
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
            {queueState?.interest?.listingId === listing.id ? (
              <section className="payment-success">
                <BadgeCheck size={22} />
                <strong>Added to buyer queue</strong>
                <span>
                  Payment is locked until pickup verification. Queue ID {queueState.interest.id}.
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
                    queueState?.status === "loading" ||
                    !delivery.allowed
                  }
                  onClick={() => onJoinQueue(listing)}
                >
                  <CircleDollarSign size={17} />
                  {!isSignedIn
                    ? "Sign in to queue"
                    : !profileComplete
                      ? "Add address first"
                    : isOwnListing
                      ? "Your own listing"
                      : queueState?.status === "loading"
                        ? "Joining queue..."
                        : "Join buyer queue"}
                </button>
              </div>
            )}
            {queueState?.error && <p className="auth-error">{queueState.error}</p>}
          </div>
        ) : (
          <div className="drawer-body">
            <img className="drawer-hero-image" src={listing.image} alt="" />
            <div className="listing-price-block">
              <span>Public API marketplace item</span>
              <strong>{formatMarketplaceCurrency(listing.price)}</strong>
              <small>
                {listing.category} · {listing.sellerCity}, {listing.sellerState}
              </small>
            </div>
            <p className="drawer-copy">
              This item fills the marketplace background from a public API. It can be
              added to cart for browsing, while full order proof and AI grading are
              available on NexTurn verified listings.
            </p>
            <button className="secondary-action" type="button" onClick={() => onAddToCart(listing)}>
              <ShoppingCart size={17} /> Add to cart
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
              <p>Add verified listings or marketplace items while browsing.</p>
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
      <span>India C2C prototype · Built for Amazon-integrated resale workflows</span>
      <a href="mailto:support@nexturn.example">support@nexturn.example</a>
      <span>© 2026 NexTurn. Demo marketplace, no real payments.</span>
    </footer>
  );
}

export function App() {
  const [activeView, setActiveView] = useState("sell");
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
  const [queueState, setQueueState] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedListing, setSelectedListing] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
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
  }, [categoryFilter, gradeFilter, pageSize, searchTerm]);

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
    setListingMessage("Photo ready. Run AI grade to evaluate condition and price.");
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
    setListingMessage("Publishing listing to the global NexTurn marketplace...");
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
      setQueueState({
        status: "success",
        interest: result.interest,
        message: result.customerMessage,
      });
      setQueueItems((current) =>
        current.some((item) => item.id === result.interest.id)
          ? current
          : [...current, result.interest],
      );
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
      setListingMessage("Sign in before saving or queuing marketplace items.");
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
          onSearch={setSearchTerm}
          page={page}
          pageSize={pageSize}
          searchTerm={searchTerm}
        />
      )}
      {activeView === "listings" && (
        <MyListingsView
          listings={myListings}
          onAddToCart={handleAddToCart}
          onOpenListing={handleOpenListing}
        />
      )}
      {activeView === "impact" && <ImpactView marketplace={marketplace} queueItems={queueItems} />}
      {activeView === "settings" && (
        <SettingsView
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
