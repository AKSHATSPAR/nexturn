import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  ExternalLink,
  Home,
  Leaf,
  MessageCircle,
  Package,
  RefreshCcw,
  Repeat2,
  Recycle,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Upload,
  WalletCards,
} from "lucide-react";
import {
  buyerMatches,
  refurbishedAlternatives,
  returnCase,
} from "./data/returnCase";
import {
  buildRouteOptions,
  formatCurrency,
  summarizeDecision,
} from "./lib/decisionEngine";
import { rankPurchaseFit } from "./lib/purchaseFit";
import { lockRoute } from "./services/returnResolutionApi";

const navItems = [
  { id: "home", label: "Home", Icon: Home },
  { id: "orders", label: "Orders", Icon: ShoppingBag },
  { id: "returns", label: "Returns hub", Icon: RefreshCcw },
  { id: "resale", label: "Resale dashboard", Icon: Store },
  { id: "impact", label: "Green impact", Icon: Leaf },
  { id: "wallet", label: "Credits wallet", Icon: WalletCards },
  { id: "messages", label: "Messages", Icon: MessageCircle },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

const orderHistory = [
  {
    id: returnCase.order.id,
    title: returnCase.item.title,
    status: "Return in review",
    value: returnCase.order.subtotal,
    date: returnCase.order.orderedOn,
    action: "Open return",
  },
  {
    id: "114-2231189-4501924",
    title: "Ergo travel backpack",
    status: "Delivered",
    value: 74.99,
    date: "May 03, 2026",
    action: "Check resale value",
  },
  {
    id: "113-4412039-7701182",
    title: "Smart desk lamp",
    status: "Exchange eligible",
    value: 42.5,
    date: "Apr 26, 2026",
    action: "Compare fit",
  },
];

const creditEvents = [
  ["Route preview", "+4.50", "Resell route selected for headphones"],
  ["Lower-risk purchase", "+2.00", "Chose refurbished item with 9% return risk"],
  ["Donation impact", "+6.50", "Available if item is donated safely"],
];

const messages = [
  ["Return scan complete", "AI-assisted grade is A- with high confidence."],
  ["Buyer match ready", "Rahul S. can pay $98.00 with pickup nearby."],
  ["Fit prevention alert", "QuietPlus Fold 45 is a 97% low-return match."],
];

function Badge({ children, tone = "green" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function StatusIcon({ tone = "green" }) {
  return (
    <span className={`status-icon ${tone}`}>
      <Check size={13} strokeWidth={2.4} />
    </span>
  );
}

function Sidebar({ activeView, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Recycle size={22} strokeWidth={2.7} />
        </div>
        <span>NexTurn</span>
      </div>

      <nav className="nav-list" aria-label="Primary navigation">
        {navItems.map(({ id, label, Icon }, index) => (
          <button
            className={`nav-item ${activeView === id ? "active" : ""} ${
              index === 6 ? "nav-spaced" : ""
            }`}
            key={label}
            type="button"
            onClick={() => onNavigate(id)}
          >
            <Icon size={18} strokeWidth={2.05} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="credit-card">
        <span>Green credits balance</span>
        <strong>
          <Leaf size={24} /> {returnCase.customer.creditsBalance}
        </strong>
        <small>~ {formatCurrency(returnCase.customer.creditsValue)} value</small>
        <button type="button" onClick={() => onNavigate("wallet")}>
          View activity
        </button>
      </div>

      <div className="profile-card">
        <img src="/assets/avatars/buyer-rahul.png" alt="" />
        <div>
          <strong>{returnCase.customer.name}</strong>
          <span>{returnCase.customer.email}</span>
        </div>
        <ChevronRight size={17} />
      </div>
    </aside>
  );
}

function ConnectedOrder({ onOpenOrders }) {
  return (
    <section className="connected-order" aria-label="Connected order">
      <div className="order-icon">
        <Package size={20} />
      </div>
      <div className="order-copy">
        <strong>{returnCase.order.channel}</strong>
        <span>
          Order # {returnCase.order.id} <i /> {returnCase.order.orderedOn} <i />{" "}
          {returnCase.order.itemCount} item <i />{" "}
          {formatCurrency(returnCase.order.subtotal)}
        </span>
      </div>
      <button type="button" onClick={onOpenOrders}>
        View order <ExternalLink size={15} />
      </button>
    </section>
  );
}

function ReturnHeader({ onBack }) {
  return (
    <header className="return-header">
      <div>
        <button className="back-link" type="button" onClick={onBack}>
          <ArrowLeft size={16} /> Back to returns hub
        </button>
        <h1>{returnCase.item.title}</h1>
        <p>
          {returnCase.item.brandLine} <span /> {returnCase.item.variant}
        </p>
        <strong>{formatCurrency(returnCase.item.originalPrice)}</strong>
      </div>
      <div className="return-status">
        <Badge>{returnCase.status}</Badge>
        <span>
          Return window closes in {returnCase.returnWindowDays} days{" "}
          <CircleHelp size={15} />
        </span>
      </div>
    </header>
  );
}

function ReturnScan({ scanStep, setScanStep }) {
  const steps = ["Received", "Scanning", "Review", "Passport"];

  return (
    <section className="panel scan-panel">
      <div className="panel-heading">
        <h2>Return scan</h2>
        <button type="button">
          <Upload size={16} /> Upload
        </button>
      </div>

      <div className="product-frame">
        <img src={returnCase.item.image} alt={returnCase.item.title} />
      </div>

      <div className="thumb-row">
        {returnCase.item.gallery.map((image, index) => (
          <button
            className={index === 0 ? "selected" : ""}
            key={image}
            type="button"
            onClick={() => setScanStep(Math.min(steps.length - 1, index + 1))}
          >
            <img src={image} alt="" />
          </button>
        ))}
        <button type="button" onClick={() => setScanStep(2)}>
          <img src={returnCase.item.image} alt="" />
          <span className="play-dot">0:18</span>
        </button>
      </div>

      <div className="scan-timeline" aria-label="Scan progress">
        {steps.map((step, index) => (
          <button
            className={index <= scanStep ? "done" : ""}
            key={step}
            type="button"
            onClick={() => setScanStep(index)}
          >
            <span />
            {step}
          </button>
        ))}
      </div>
    </section>
  );
}

function GradePanel({ decision }) {
  return (
    <section className="panel grade-panel">
      <div className="panel-heading">
        <h2>
          AI condition grade <CircleHelp size={15} />
        </h2>
        <Badge>{decision.grade.confidence}</Badge>
      </div>
      <div className="grade-body">
        <div>
          <strong>{decision.grade.grade}</strong>
          <span>{decision.grade.label}</span>
          <p>{decision.grade.summary}</p>
        </div>
      </div>
      <div className="grade-scale">
        <span>D</span>
        <span>C</span>
        <span>B</span>
        <span>A</span>
        <span>A+</span>
        <b style={{ left: `${decision.grade.score - 8}%` }}>{decision.grade.grade}</b>
      </div>
    </section>
  );
}

function SignalCards() {
  return (
    <div className="signal-grid">
      <section className="panel mini-panel">
        <h3>Defects</h3>
        <p>
          <StatusIcon /> No major defects found
        </p>
        <span>Very light wear on ear cushions.</span>
      </section>
      <section className="panel mini-panel">
        <h3>Accessories</h3>
        <p>3 of 3 included</p>
        {["USB-C charging cable", "Audio cable", "Carrying case"].map((item) => (
          <span className="check-row" key={item}>
            <StatusIcon /> {item}
          </span>
        ))}
      </section>
    </div>
  );
}

function RouteCard({ route, isActive, onSelect }) {
  const iconMap = {
    resell: Leaf,
    exchange: Repeat2,
    donate: ShieldCheck,
    recycle: Recycle,
  };
  const Icon = iconMap[route.id] ?? Sparkles;

  return (
    <button
      className={`route-card ${isActive ? "active" : ""}`}
      data-testid={`route-${route.id}`}
      aria-pressed={isActive}
      type="button"
      onClick={() => onSelect(route.id)}
    >
      <div className="route-title">
        <span>
          <Icon size={18} /> {route.title}
        </span>
        {route.isRecommended && <Badge>Recommended</Badge>}
      </div>
      <p>{route.description}</p>
      <strong>
        {route.payout > 0 ? formatCurrency(route.payout) : "--"}
        {route.greenCredits > 0 && <em>+ {route.greenCredits.toFixed(2)} credits</em>}
      </strong>
      <small>{route.paymentTime} payment path</small>
      <span className="route-reason">{route.customerReason}</span>
      <span className="route-cta">{route.cta}</span>
    </button>
  );
}

function NextBestAction({ routes, selectedRouteId, onSelect }) {
  return (
    <section className="panel next-action">
      <div className="panel-heading">
        <h2>
          <Sparkles size={18} /> Next best action
        </h2>
      </div>
      <div className="route-grid">
        {routes.map((route) => (
          <RouteCard
            isActive={route.id === selectedRouteId}
            key={route.id}
            onSelect={onSelect}
            route={route}
          />
        ))}
      </div>
    </section>
  );
}

function RouteComparison({ routes, selectedRouteId, onSelect }) {
  return (
    <section className="panel comparison">
      <h2>Route comparison</h2>
      <div className="comparison-table" role="table" aria-label="Route comparison">
        <div className="comparison-row header" role="row">
          <span>Option</span>
          <span>Payout / Value</span>
          <span>Green credits</span>
          <span>Payment time</span>
          <span>Convenience</span>
          <span>Impact</span>
        </div>
        {routes.map((route) => (
          <button
            className={`comparison-row ${route.id === selectedRouteId ? "selected" : ""}`}
            data-testid={`comparison-${route.id}`}
            aria-pressed={route.id === selectedRouteId}
            key={route.id}
            type="button"
            onClick={() => onSelect(route.id)}
          >
            <span>
              <i /> {route.title}
            </span>
            <span>{route.payout > 0 ? formatCurrency(route.payout) : "--"}</span>
            <span>
              {route.greenCredits > 0 ? route.greenCredits.toFixed(2) : "--"}
            </span>
            <span>{route.paymentTime}</span>
            <span>{route.convenience}</span>
            <span>
              {route.impact} <Leaf size={13} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function MatchRail({ selectedRouteId }) {
  const fitRanking = rankPurchaseFit(refurbishedAlternatives, returnCase.customer);

  return (
    <aside className="right-rail">
      <section className="panel match-panel">
        <div className="panel-heading">
          <h2>
            <Search size={17} /> Best matches for your item
          </h2>
        </div>
        <div className="match-list">
          {buyerMatches.map((buyer, index) => (
            <button className={index === 0 ? "selected" : ""} key={buyer.id} type="button">
              <img src={buyer.avatar} alt="" />
              <span>
                <strong>{buyer.name}</strong>
                <small>
                  {buyer.positiveRate}% positive · {buyer.reviews.toLocaleString()} reviews
                </small>
                <em>{buyer.reason}</em>
              </span>
              <b>
                {formatCurrency(buyer.offer)}
                <small>+ {formatCurrency(buyer.credits)} credits</small>
              </b>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
        <button className="text-button" type="button">
          View more buyers (8+) <ChevronDown size={15} />
        </button>
      </section>

      <section className="panel alternatives-panel">
        <div className="panel-heading">
          <h2>
            <RefreshCcw size={17} /> Refurbished alternatives
          </h2>
        </div>
        {refurbishedAlternatives.map((item) => (
          <button className="alternative-row" key={item.id} type="button">
            <img src={item.image} alt="" />
            <span>
              <strong>{item.name}</strong>
              <small>{item.label}</small>
            </span>
            <b>
              {formatCurrency(item.price)}
              <small>{item.condition}</small>
            </b>
            <ChevronRight size={16} />
          </button>
        ))}
        <button className="text-button" type="button">
          View more alternatives <ChevronRight size={15} />
        </button>
      </section>

      <PurchaseFitPanel fitRanking={fitRanking} />

      <TrustPassport selectedRouteId={selectedRouteId} />
    </aside>
  );
}

function PurchaseFitPanel({ fitRanking }) {
  const bestFit = fitRanking[0];

  return (
    <section className="panel fit-panel">
      <div className="panel-heading">
        <h2>
          <ClipboardCheck size={18} /> Purchase fit check
        </h2>
      </div>
      <div className="fit-score">
        <strong>{bestFit.confidence}%</strong>
        <span>{bestFit.recommendation}</span>
      </div>
      <p>
        {bestFit.name} stays under budget, matches over-ear preference, and has{" "}
        {bestFit.returnRisk}% predicted return risk.
      </p>
      <button type="button">Compare with new</button>
    </section>
  );
}

function TrustPassport({ selectedRouteId }) {
  const decision = summarizeDecision(returnCase);
  const activeRoute =
    buildRouteOptions(returnCase).find((route) => route.id === selectedRouteId) ??
    decision.recommended;

  return (
    <section className="panel passport-panel">
      <div className="panel-heading">
        <h2>
          <ShieldCheck size={18} /> Trust Passport
        </h2>
      </div>
      <p>Verified return</p>
      <div className="passport-checks">
        {decision.passportChecks.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              {value} <StatusIcon tone={value === "Not applicable" ? "gray" : "green"} />
            </strong>
          </div>
        ))}
      </div>
      <div className="passport-result">
        <span>Route locked</span>
        <strong>{activeRoute.shortLabel}</strong>
      </div>
      <footer>
        <span>ID: {returnCase.trustPassport.id}</span>
        <button type="button">
          View details <ExternalLink size={14} />
        </button>
      </footer>
    </section>
  );
}

function ImpactBar({ decision, selectedRoute, syncState }) {
  return (
    <section className="impact-bar">
      <span>
        <Leaf size={17} />
        You are earning {selectedRoute.greenCredits.toFixed(2)} green credits with this
        route.
      </span>
      <span>
        {decision.impact.emissionsKgSaved} kg CO2e saved ·{" "}
        {decision.impact.landfillAvoidedGrams} g kept out of disposal ·{" "}
        {decision.impact.nextOwnerMatchRate}% match confidence
      </span>
      <span className={`sync-state ${syncState.status}`}>{syncState.message}</span>
    </section>
  );
}

function TopActions() {
  return (
    <div className="top-actions" aria-label="Notifications">
      <Bell size={18} />
      <CircleHelp size={18} />
    </div>
  );
}

function PageHeader({ eyebrow, title, description }) {
  return (
    <header className="page-header">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <section className="panel metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}

function HomeView({ decision, onNavigate }) {
  const bestFit = rankPurchaseFit(refurbishedAlternatives, returnCase.customer)[0];

  return (
    <main className="studio workspace-page">
      <TopActions />
      <PageHeader
        eyebrow="Customer command center"
        title={`Welcome back, ${returnCase.customer.name.split(" ")[0]}`}
        description="Your open return, second-life options, and low-return recommendations are ready."
      />
      <div className="metric-grid">
        <MetricCard
          label="Open return"
          value={decision.recommended.shortLabel}
          detail={`${decision.grade.grade} grade · ${decision.recommended.greenCredits.toFixed(2)} credits`}
        />
        <MetricCard
          label="Best buyer offer"
          value={formatCurrency(buyerMatches[0].offer)}
          detail={`${buyerMatches[0].positiveRate}% positive nearby match`}
        />
        <MetricCard
          label="Next purchase fit"
          value={`${bestFit.confidence}%`}
          detail={`${bestFit.name} · ${bestFit.returnRisk}% return risk`}
        />
      </div>
      <div className="workspace-grid">
        <section className="panel action-panel">
          <h2>Priority actions</h2>
          <button type="button" onClick={() => onNavigate("returns")}>
            Resolve headphone return <ChevronRight size={16} />
          </button>
          <button type="button" onClick={() => onNavigate("resale")}>
            Review buyer matches <ChevronRight size={16} />
          </button>
          <button type="button" onClick={() => onNavigate("wallet")}>
            Open green credits wallet <ChevronRight size={16} />
          </button>
        </section>
        <section className="panel list-panel">
          <h2>Return prevention</h2>
          {rankPurchaseFit(refurbishedAlternatives, returnCase.customer).map((item) => (
            <div className="list-row" key={item.id}>
              <img src={item.image} alt="" />
              <span>
                <strong>{item.name}</strong>
                <small>{item.recommendation}</small>
              </span>
              <b>{item.confidence}%</b>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function OrdersView({ onNavigate }) {
  return (
    <main className="studio workspace-page">
      <TopActions />
      <PageHeader
        eyebrow="Orders"
        title="Connected purchases"
        description="Recent orders with return, resale, and fit-prevention actions."
      />
      <section className="panel table-panel">
        {orderHistory.map((order) => (
          <button
            className="order-row"
            key={order.id}
            type="button"
            onClick={() => onNavigate(order.id === returnCase.order.id ? "returns" : "home")}
          >
            <span>
              <strong>{order.title}</strong>
              <small>Order # {order.id}</small>
            </span>
            <span>{order.date}</span>
            <Badge tone={order.status === "Delivered" ? "neutral" : "green"}>
              {order.status}
            </Badge>
            <b>{formatCurrency(order.value)}</b>
            <em>{order.action}</em>
          </button>
        ))}
      </section>
    </main>
  );
}

function ResaleDashboardView() {
  return (
    <main className="studio workspace-page">
      <TopActions />
      <PageHeader
        eyebrow="Resale dashboard"
        title="Second-life demand queue"
        description="Buyer demand, trust status, and route readiness for usable returned items."
      />
      <div className="metric-grid">
        <MetricCard label="Ready to resell" value="1 item" detail="A- grade · high confidence" />
        <MetricCard label="Top offer" value={formatCurrency(buyerMatches[0].offer)} detail="2-3 day payout" />
        <MetricCard label="Trust passport" value="Verified" detail="90-day warranty signal" />
      </div>
      <section className="panel list-panel">
        <h2>Buyer matches</h2>
        {buyerMatches.map((buyer) => (
          <div className="list-row" key={buyer.id}>
            <img src={buyer.avatar} alt="" />
            <span>
              <strong>{buyer.name}</strong>
              <small>{buyer.reason}</small>
            </span>
            <b>{formatCurrency(buyer.offer)}</b>
          </div>
        ))}
      </section>
    </main>
  );
}

function GreenImpactView({ decision }) {
  return (
    <main className="studio workspace-page">
      <TopActions />
      <PageHeader
        eyebrow="Green impact"
        title="Customer impact ledger"
        description="A practical sustainability view tied to decisions the customer can actually make."
      />
      <div className="metric-grid">
        <MetricCard label="CO2e avoided" value={`${decision.impact.emissionsKgSaved} kg`} detail="From resale route estimate" />
        <MetricCard label="Waste avoided" value={`${decision.impact.landfillAvoidedGrams} g`} detail="Kept out of disposal" />
        <MetricCard label="Match confidence" value={`${decision.impact.nextOwnerMatchRate}%`} detail="Demand-backed second life" />
      </div>
      <section className="panel route-impact-panel">
        <h2>Impact by route</h2>
        {decision.routes.map((route) => (
          <div className="impact-row" key={route.id}>
            <span>
              <strong>{route.title}</strong>
              <small>{route.customerReason}</small>
            </span>
            <b>{route.greenCredits.toFixed(2)} credits</b>
            <em>{route.impact} impact</em>
          </div>
        ))}
      </section>
    </main>
  );
}

function CreditsWalletView() {
  return (
    <main className="studio workspace-page">
      <TopActions />
      <PageHeader
        eyebrow="Credits wallet"
        title={`${returnCase.customer.creditsBalance} green credits`}
        description={`Estimated value ${formatCurrency(returnCase.customer.creditsValue)} from verified lower-waste choices.`}
      />
      <section className="panel list-panel">
        <h2>Recent credit activity</h2>
        {creditEvents.map(([title, amount, detail]) => (
          <div className="credit-row" key={title}>
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
            <b>{amount}</b>
          </div>
        ))}
      </section>
    </main>
  );
}

function MessagesView() {
  return (
    <main className="studio workspace-page">
      <TopActions />
      <PageHeader
        eyebrow="Messages"
        title="Return updates"
        description="Customer-facing status messages generated by the return resolution flow."
      />
      <section className="panel list-panel">
        {messages.map(([title, detail]) => (
          <div className="message-row" key={title}>
            <MessageCircle size={18} />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}

function SettingsView() {
  return (
    <main className="studio workspace-page">
      <TopActions />
      <PageHeader
        eyebrow="Settings"
        title="Trust and AI transparency"
        description="Controls and model status for an explainable return-resolution prototype."
      />
      <div className="workspace-grid">
        <section className="panel settings-panel">
          <h2>AI status</h2>
          <div className="settings-row">
            <span>
              <strong>Custom trained model</strong>
              <small>Not trained for this prototype. The demo uses explainable scoring with AWS-ready adapters.</small>
            </span>
            <Badge tone="neutral">Prototype</Badge>
          </div>
          <div className="settings-row">
            <span>
              <strong>Quality signal source</strong>
              <small>Seeded scan signals now; Rekognition-style image checks can feed the same engine.</small>
            </span>
            <Badge>Adapter ready</Badge>
          </div>
          <div className="settings-row">
            <span>
              <strong>Customer decision layer</strong>
              <small>Deterministic route scoring keeps payout, trust, and impact explainable.</small>
            </span>
            <Badge>Active</Badge>
          </div>
        </section>
        <section className="panel settings-panel">
          <h2>Privacy controls</h2>
          {["Use order history for fit scoring", "Store trust passport after route lock", "Allow green-credit ledger updates"].map((item) => (
            <div className="toggle-row" key={item}>
              <span>{item}</span>
              <b>On</b>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function ReturnsView({
  decision,
  selectedRoute,
  selectedRouteId,
  scanStep,
  setScanStep,
  syncState,
  onNavigate,
  onRouteSelect,
}) {
  return (
    <main className="studio">
      <TopActions />
      <ConnectedOrder onOpenOrders={() => onNavigate("orders")} />
      <ReturnHeader onBack={() => onNavigate("home")} />

      <div className="studio-grid">
        <section className="primary-column">
          <div className="analysis-grid">
            <ReturnScan scanStep={scanStep} setScanStep={setScanStep} />
            <div className="analysis-stack">
              <GradePanel decision={decision} />
              <SignalCards />
            </div>
          </div>

          <NextBestAction
            onSelect={onRouteSelect}
            routes={decision.routes}
            selectedRouteId={selectedRouteId}
          />
          <RouteComparison
            onSelect={onRouteSelect}
            routes={decision.routes}
            selectedRouteId={selectedRouteId}
          />
        </section>

        <MatchRail selectedRouteId={selectedRouteId} />
      </div>

      <ImpactBar
        decision={decision}
        selectedRoute={selectedRoute}
        syncState={syncState}
      />
    </main>
  );
}

export function App() {
  const decision = useMemo(() => summarizeDecision(returnCase), []);
  const [activeView, setActiveView] = useState("returns");
  const [selectedRouteId, setSelectedRouteId] = useState(decision.recommended.id);
  const [scanStep, setScanStep] = useState(1);
  const [syncState, setSyncState] = useState({
    status: "idle",
    message: "Local decision ready",
  });

  const selectedRoute =
    decision.routes.find((route) => route.id === selectedRouteId) ??
    decision.recommended;

  async function handleRouteSelect(routeId) {
    setSelectedRouteId(routeId);
    setSyncState({ status: "syncing", message: "Syncing route..." });

    try {
      const result = await lockRoute(routeId);
      setSyncState({
        status: result.persisted ? "synced" : "idle",
        message: result.persisted ? "Synced to AWS route ledger" : result.message,
      });
    } catch {
      setSyncState({
        status: "error",
        message: "API unavailable. Decision kept locally.",
      });
    }
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      {activeView === "home" && <HomeView decision={decision} onNavigate={setActiveView} />}
      {activeView === "orders" && <OrdersView onNavigate={setActiveView} />}
      {activeView === "returns" && (
        <ReturnsView
          decision={decision}
          onNavigate={setActiveView}
          onRouteSelect={handleRouteSelect}
          scanStep={scanStep}
          selectedRoute={selectedRoute}
          selectedRouteId={selectedRouteId}
          setScanStep={setScanStep}
          syncState={syncState}
        />
      )}
      {activeView === "resale" && <ResaleDashboardView />}
      {activeView === "impact" && <GreenImpactView decision={decision} />}
      {activeView === "wallet" && <CreditsWalletView />}
      {activeView === "messages" && <MessagesView />}
      {activeView === "settings" && <SettingsView />}
    </div>
  );
}
