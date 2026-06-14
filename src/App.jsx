import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Home,
  Leaf,
  LogIn,
  LogOut,
  PackageCheck,
  PackageOpen,
  ReceiptText,
  Recycle,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Upload,
  X,
} from "lucide-react";
import { initializeAuth, signIn, signOut } from "./services/auth";
import {
  checkoutC2CListing,
  createC2CListing,
  evaluateC2CListingUpload,
  fetchC2CMarketplace,
  fetchC2COrders,
} from "./services/returnResolutionApi";
import { conditionPresets } from "./data/c2cCommerce";
import { formatMarketplaceCurrency } from "./lib/c2cCommerce";

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

function Sidebar({
  activeView,
  auth,
  collapsed,
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
          <small>Seller keeps item at home until buyer checkout.</small>
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
          detail="Fake Amazon history for demo authenticity"
          Icon={PackageCheck}
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
            <small>See proof, scorecard, seller-at-home logistics, and checkout split.</small>
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

function ConditionSelector({ value, onChange }) {
  return (
    <div className="condition-selector" aria-label="Declared item condition">
      {Object.values(conditionPresets).map((preset) => (
        <button
          className={value === preset.id ? "active" : ""}
          key={preset.id}
          type="button"
          onClick={() => onChange(preset.id)}
        >
          {preset.label}
        </button>
      ))}
    </div>
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

function EvaluationPanel({ evaluation, isPublishing, onPublish }) {
  if (!evaluation?.listingPreview) {
    return (
      <section className="panel evaluation-panel empty">
        <SparkleLine />
        <h2>AI grade appears here after upload</h2>
        <p>
          Upload the real item photo. AWS Rekognition checks identity evidence and
          NexTurn's deterministic scorecard calculates the resale grade and price.
        </p>
      </section>
    );
  }

  const listing = evaluation.listingPreview;

  return (
    <section className="panel evaluation-panel">
      <div className="evaluation-heading">
        <div>
          <span>AI grading complete</span>
          <strong>{listing.grade.grade}</strong>
          <small>{listing.grade.summary}</small>
        </div>
        <Badge tone={listing.grade.grade === "C" ? "amber" : "green"}>
          {listing.grade.confidence}
        </Badge>
      </div>
      <div className="price-split">
        <span>Auto discounted price</span>
        <strong>{formatMarketplaceCurrency(listing.price)}</strong>
        <small>
          {listing.discountPercent}% below original {formatMarketplaceCurrency(listing.item.originalPrice)}
        </small>
      </div>
      <div className="scorecard-grid">
        <ScoreBar label="Functional" value={listing.scorecard.functionalScore} />
        <ScoreBar label="Cosmetic" value={listing.scorecard.cosmeticScore} />
        <ScoreBar label="Packaging" value={listing.scorecard.packagingScore} />
        <ScoreBar label="Accessories" value={listing.scorecard.accessoryCompleteness} />
      </div>
      {listing.scorecard.damageFlags.length > 0 && (
        <p className="damage-note">
          Damage flags: {listing.scorecard.damageFlags.join(", ")}
        </p>
      )}
      <p className="seller-hold-note">
        You keep the item at your house. Once a buyer pays, an Amazon delivery partner
        checks quality at pickup and delivers it to the buyer.
      </p>
      <button
        className="primary-action"
        type="button"
        disabled={isPublishing}
        onClick={onPublish}
      >
        <Store size={17} /> {isPublishing ? "Publishing..." : "List on NexTurn Marketplace"}
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
  onConditionChange,
  onEvaluate,
  onFileSelected,
  onPublish,
  onSelectOrder,
  orders,
  selectedOrder,
  sellerCondition,
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

  return (
    <main className="studio workspace-page c2c-workspace">
      <PageHeader
        eyebrow="Sell / Return items"
        title="Choose a verified Amazon purchase"
        description="The order history below is hardcoded for the prototype and acts as the proof-of-authenticity anchor."
      />

      <div className="sell-grid">
        <section className="panel order-history-panel">
          <div className="panel-heading">
            <h2>Fake Amazon order history</h2>
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
          <ConditionSelector
            value={sellerCondition.preset}
            onChange={(preset) => onConditionChange({ preset })}
          />
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

function HeroListingCard({ listing, onOpen }) {
  return (
    <button className="hero-listing-card" type="button" onClick={() => onOpen(listing)}>
      <img src={listing.image} alt="" />
      <span className="listing-badge">{listing.badge}</span>
      <div>
        <strong>{listing.item.title}</strong>
        <small>
          {listing.grade.grade} · {listing.grade.label} · {listing.discountPercent}% off
        </small>
      </div>
      <footer>
        <b>{formatMarketplaceCurrency(listing.price)}</b>
        <em>Seller keeps item until purchase</em>
      </footer>
    </button>
  );
}

function GenericItemCard({ item, onOpen }) {
  return (
    <button className="generic-item-card" type="button" onClick={() => onOpen(item)}>
      <img src={item.image} alt="" />
      <span>
        <strong>{item.title}</strong>
        <small>{item.category}</small>
      </span>
      <b>{formatMarketplaceCurrency(item.price)}</b>
    </button>
  );
}

function MarketplaceView({
  isLoading,
  marketplace,
  onOpenListing,
  onSearch,
  searchTerm,
}) {
  const filteredGeneric = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return marketplace.genericItems;

    return marketplace.genericItems.filter((item) =>
      `${item.title} ${item.category}`.toLowerCase().includes(query),
    );
  }, [marketplace.genericItems, searchTerm]);

  return (
    <main className="studio workspace-page c2c-workspace marketplace-page">
      <PageHeader
        eyebrow="Buy / Marketplace"
        title="Second-life items with proof you can inspect"
        description="AI-graded listings are injected above the public API product feed so judges can see the working C2C inventory."
        action={
          <label className="market-search">
            <Search size={16} />
            <input
              type="search"
              value={searchTerm}
              placeholder="Search marketplace"
              onChange={(event) => onSearch(event.target.value)}
            />
          </label>
        }
      />

      <section className="hero-market-section">
        <div className="section-heading">
          <h2>AI Graded & Amazon Verified</h2>
          <Badge>{marketplace.heroListings.length} live listings</Badge>
        </div>
        <div className="hero-listing-grid">
          {marketplace.heroListings.map((listing) => (
            <HeroListingCard key={listing.id} listing={listing} onOpen={onOpenListing} />
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
          {filteredGeneric.map((item) => (
            <GenericItemCard key={item.id} item={item} onOpen={onOpenListing} />
          ))}
        </div>
      </section>
    </main>
  );
}

function MyListingsView({ listings, onOpenListing }) {
  return (
    <main className="studio workspace-page c2c-workspace">
      <PageHeader
        eyebrow="My listings"
        title="Items you are holding at home"
        description="NexTurn only coordinates pickup after a buyer pays. Until then, the product remains with the seller."
      />
      {listings.length ? (
        <div className="hero-listing-grid compact">
          {listings.map((listing) => (
            <HeroListingCard key={listing.id} listing={listing} onOpen={onOpenListing} />
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

function ImpactView() {
  return (
    <main className="studio workspace-page c2c-workspace">
      <PageHeader
        eyebrow="Impact"
        title="Why the direct C2C model matters"
        description="Keeping items with sellers until purchase avoids warehouse hops, reduces unnecessary handling, and gives buyers transparent proof before checkout."
      />
      <div className="metric-grid">
        <MetricCard
          label="Warehouse hops"
          value="0"
          detail="No centralized return warehouse in this flow"
          Icon={PackageCheck}
        />
        <MetricCard
          label="Trust signal"
          value="Order proof"
          detail="Fake Amazon order metadata anchors authenticity"
          Icon={ShieldCheck}
        />
        <MetricCard
          label="Buyer confidence"
          value="Scorecard"
          detail="Functional, cosmetic, packaging, and accessory scores"
          Icon={BadgeCheck}
        />
      </div>
    </main>
  );
}

function SettingsView() {
  return (
    <main className="studio workspace-page c2c-workspace">
      <PageHeader
        eyebrow="Settings"
        title="Prototype transparency"
        description="This demo uses AWS Rekognition for image evidence, a deterministic scorecard for grade, DynamoDB for listings, and a mock payment success state."
      />
      <section className="panel settings-panel c2c-settings">
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
            <small>Mock checkout only. Item payment routes to seller, delivery fee to Amazon.</small>
          </span>
          <Badge tone="neutral">Simulated</Badge>
        </div>
      </section>
    </main>
  );
}

function ListingDrawer({
  checkoutState,
  isSignedIn,
  listing,
  onBuy,
  onClose,
  signedInCustomerId,
}) {
  if (!listing) return null;

  const isHero = listing.source === "nexturn-ai-graded";
  const isOwnListing = isHero && listing.sellerId === signedInCustomerId;

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
                Original {formatMarketplaceCurrency(listing.item.originalPrice)} ·{" "}
                {listing.discountPercent}% off
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
              <h3>Transparent scorecard</h3>
              <ScoreBar label="Functional" value={listing.scorecard.functionalScore} />
              <ScoreBar label="Cosmetic" value={listing.scorecard.cosmeticScore} />
              <ScoreBar label="Packaging" value={listing.scorecard.packagingScore} />
              <ScoreBar label="Accessories" value={listing.scorecard.accessoryCompleteness} />
              <p>
                Grade {listing.grade.grade}: {listing.grade.summary}
              </p>
            </section>
            <section className="checkout-split">
              <h3>Checkout split</h3>
              <div>
                <span>Item payment to seller</span>
                <b>{formatMarketplaceCurrency(listing.price)}</b>
              </div>
              <div>
                <span>Amazon Delivery Fee</span>
                <b>{formatMarketplaceCurrency(listing.deliveryFee)}</b>
              </div>
              <div>
                <span>Total mock payment</span>
                <b>{formatMarketplaceCurrency(listing.price + listing.deliveryFee)}</b>
              </div>
            </section>
            <p className="seller-hold-note">{listing.logistics}</p>
            {checkoutState?.receipt?.listingId === listing.id ? (
              <section className="payment-success">
                <BadgeCheck size={22} />
                <strong>Payment done</strong>
                <span>
                  Receipt {checkoutState.receipt.id} · pickup scheduled from seller home.
                </span>
              </section>
            ) : (
              <button
                className="primary-action"
                type="button"
                disabled={!isSignedIn || isOwnListing || checkoutState?.status === "loading"}
                onClick={() => onBuy(listing)}
              >
                <CircleDollarSign size={17} />
                {!isSignedIn
                  ? "Sign in to buy"
                  : isOwnListing
                    ? "Your own listing"
                    : checkoutState?.status === "loading"
                      ? "Processing..."
                      : "Buy now"}
              </button>
            )}
            {checkoutState?.error && <p className="auth-error">{checkoutState.error}</p>}
          </div>
        ) : (
          <div className="drawer-body">
            <img className="drawer-hero-image" src={listing.image} alt="" />
            <div className="listing-price-block">
              <span>Public API marketplace item</span>
              <strong>{formatMarketplaceCurrency(listing.price)}</strong>
              <small>{listing.category}</small>
            </div>
            <p className="drawer-copy">
              This item fills the marketplace background from a public API. The full
              proof, AI grading, and C2C checkout flow is available on NexTurn hero listings.
            </p>
          </div>
        )}
      </aside>
    </div>
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
  const [checkoutState, setCheckoutState] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isLoadingMarketplace, setLoadingMarketplace] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [listingMessage, setListingMessage] = useState("");
  const [marketplace, setMarketplace] = useState({
    heroListings: [],
    genericItems: [],
  });
  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedListing, setSelectedListing] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sellerCondition, setSellerCondition] = useState({ preset: "pristine" });

  const isSignedIn = Boolean(auth.session);
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
    if (!isSignedIn) {
      setOrders([]);
      setSelectedOrder(null);
      return;
    }

    fetchC2COrders()
      .then((payload) => {
        setOrders(payload.orders ?? []);
        setSelectedOrder((current) => current ?? payload.orders?.[0] ?? null);
      })
      .catch((error) => {
        setListingMessage(error.message);
      });
  }, [isSignedIn]);

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
    setListingMessage("Running AWS AI evidence and deterministic scorecard...");
    try {
      const result = await evaluateC2CListingUpload(
        selectedFile,
        selectedOrder.id,
        sellerCondition,
      );
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
      const result = await createC2CListing(selectedFile, selectedOrder.id, sellerCondition);
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

  async function handleBuy(listing) {
    setCheckoutState({ status: "loading" });
    try {
      const result = await checkoutC2CListing(listing.id);
      setCheckoutState({
        status: "success",
        receipt: result.receipt,
        message: result.customerMessage,
      });
      await refreshMarketplace();
    } catch (error) {
      setCheckoutState({
        status: "error",
        error: error.message,
      });
    }
  }

  function handleOpenListing(listing) {
    setCheckoutState(null);
    setSelectedListing(listing);
  }

  function handleConditionChange(nextCondition) {
    setSellerCondition(nextCondition);
    setEvaluation(null);
    if (selectedFile) {
      setListingMessage("Condition changed. Re-run AI grade before publishing.");
    }
  }

  return (
    <div className={`app-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        activeView={activeView}
        auth={auth}
        collapsed={isSidebarCollapsed}
        onGoogleSignIn={() => handleSignIn("Google")}
        onNavigate={navigate}
        onSignIn={() => handleSignIn()}
        onSignOut={handleSignOut}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
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
          onConditionChange={handleConditionChange}
          onEvaluate={handleEvaluate}
          onFileSelected={handleFileSelected}
          onPublish={handlePublish}
          onSelectOrder={handleSelectOrder}
          orders={orders}
          selectedOrder={selectedOrder}
          sellerCondition={sellerCondition}
        />
      )}
      {activeView === "marketplace" && (
        <MarketplaceView
          isLoading={isLoadingMarketplace}
          marketplace={marketplace}
          onOpenListing={handleOpenListing}
          onSearch={setSearchTerm}
          searchTerm={searchTerm}
        />
      )}
      {activeView === "listings" && (
        <MyListingsView listings={myListings} onOpenListing={handleOpenListing} />
      )}
      {activeView === "impact" && <ImpactView />}
      {activeView === "settings" && <SettingsView />}

      <ListingDrawer
        checkoutState={checkoutState}
        isSignedIn={isSignedIn}
        listing={selectedListing}
        onBuy={handleBuy}
        onClose={() => setSelectedListing(null)}
        signedInCustomerId={signedInCustomerId}
      />
    </div>
  );
}
