import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
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
  X,
} from "lucide-react";
import {
  buyerMatches,
  creditEvents,
  customerMessages,
  orderHistory,
  refurbishedAlternatives,
  returnCase,
} from "./data/returnCase";
import { formatCurrency, summarizeDecision } from "./lib/decisionEngine";
import { rankPurchaseFit } from "./lib/purchaseFit";
import { evaluateScanUpload, lockRoute } from "./services/returnResolutionApi";

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

function Sidebar({
  activeView,
  collapsed,
  onNavigate,
  onOpenProfile,
  onToggleCollapse,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-mark">
            <Recycle size={22} strokeWidth={2.7} />
          </div>
          <span>NexTurn</span>
        </div>
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
        {navItems.map(({ id, label, Icon }, index) => (
          <button
            className={`nav-item ${activeView === id ? "active" : ""} ${
              index === 6 ? "nav-spaced" : ""
            }`}
            key={label}
            title={collapsed ? label : undefined}
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

      <button
        className="profile-card"
        type="button"
        aria-label={`Open profile for ${returnCase.customer.name}`}
        onClick={onOpenProfile}
      >
        <img src="/assets/avatars/buyer-rahul.png" alt="" />
        <div>
          <strong>{returnCase.customer.name}</strong>
          <span>{returnCase.customer.email}</span>
        </div>
        <ChevronRight size={17} />
      </button>
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

function ReturnHeader({ onBack, onExplainWindow }) {
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
        <button className="inline-help" type="button" onClick={onExplainWindow}>
          Return window closes in {returnCase.returnWindowDays} days{" "}
          <CircleHelp size={15} />
        </button>
      </div>
    </header>
  );
}

function ReturnScan({
  activeCase,
  selectedImage,
  scanStep,
  setScanStep,
  onImageSelect,
  onUpload,
  uploadState,
}) {
  const fileInputRef = useRef(null);
  const steps = ["Received", "Scanning", "Review", "Passport"];

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (file) onUpload(file);
    event.target.value = "";
  }

  return (
    <section className="panel scan-panel">
      <div className="panel-heading">
        <h2>Return scan</h2>
        <button
          type="button"
          disabled={uploadState.status === "syncing"}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={16} />
          {uploadState.status === "syncing" ? "Analyzing" : "Upload"}
        </button>
        <input
          ref={fileInputRef}
          className="scan-upload-input"
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFileChange}
        />
      </div>

      <div className="product-frame">
        <img src={selectedImage} alt={activeCase.item.title} />
      </div>

      <div className="thumb-row">
        {activeCase.item.gallery.map((image, index) => (
          <button
            className={selectedImage === image ? "selected" : ""}
            key={image}
            type="button"
            onClick={() => {
              onImageSelect(image);
              setScanStep(Math.min(steps.length - 1, index + 1));
            }}
          >
            <img src={image} alt="" />
          </button>
        ))}
        <button type="button" onClick={() => setScanStep(2)}>
          <img src={activeCase.item.image} alt="" />
          <span className="play-dot">0:18</span>
        </button>
      </div>

      <div className="upload-state" data-state={uploadState.status}>
        <strong>{uploadState.title}</strong>
        <span>{uploadState.message}</span>
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

function GradePanel({ decision, onExplainAi }) {
  return (
    <section className="panel grade-panel">
      <div className="panel-heading">
        <h2>
          AI condition grade
          <button className="mini-icon-button" type="button" onClick={onExplainAi}>
            <CircleHelp size={15} />
          </button>
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
        <b style={{ left: `${Math.max(6, Math.min(94, decision.grade.score - 8))}%` }}>
          {decision.grade.grade}
        </b>
      </div>
    </section>
  );
}

function AiAnalysisPanel({ aiAnalysis, media }) {
  const isLive = aiAnalysis?.usedAws;
  const labels = aiAnalysis?.labels ?? [];

  return (
    <section className="panel ai-panel">
      <div className="panel-heading">
        <h2>
          <Sparkles size={17} /> AI evidence
        </h2>
        <Badge tone={isLive ? "green" : "neutral"}>
          {isLive ? "AWS AI live" : aiAnalysis?.mode ?? "Ready"}
        </Badge>
      </div>
      <p>{aiAnalysis?.summary ?? "Upload a return photo to run AWS Rekognition."}</p>
      {labels.length > 0 && (
        <div className="label-chips" aria-label="Detected image labels">
          {labels.slice(0, 6).map((label) => (
            <span key={`${label.name}-${label.confidence}`}>
              {label.name} {Math.round(label.confidence)}%
            </span>
          ))}
        </div>
      )}
      <small>
        {media?.persisted
          ? `Image stored in S3 object ${media.objectKey}`
          : media?.message ?? "No scan image has been persisted yet."}
      </small>
    </section>
  );
}

function SignalCards({ scan }) {
  const visibleSignals = scan.inspectionSignals.slice(0, 4);

  return (
    <div className="signal-grid">
      <section className="panel mini-panel">
        <h3>Defects</h3>
        <p>
          <StatusIcon /> No major defects found
        </p>
        {visibleSignals.slice(0, 2).map((signal) => (
          <span key={signal}>{signal}</span>
        ))}
      </section>
      <section className="panel mini-panel">
        <h3>Accessories</h3>
        <p>{scan.accessoryCompleteness === 100 ? "3 of 3 included" : "Needs check"}</p>
        {["USB-C charging cable", "Audio cable", "Carrying case"].map((item) => (
          <span className="check-row" key={item}>
            <StatusIcon /> {item}
          </span>
        ))}
      </section>
    </div>
  );
}

function RouteCard({ route, isActive, onSelect, onOpenDetails }) {
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
      onClick={() => {
        onSelect(route.id);
        onOpenDetails(route);
      }}
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

function NextBestAction({ routes, selectedRouteId, onSelect, onOpenRoute }) {
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
            onOpenDetails={onOpenRoute}
            onSelect={onSelect}
            route={route}
          />
        ))}
      </div>
    </section>
  );
}

function RouteComparison({ routes, selectedRouteId, onSelect, onOpenRoute }) {
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
            onClick={() => {
              onSelect(route.id);
              onOpenRoute(route);
            }}
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

function MatchRail({
  decision,
  selectedRouteId,
  onCompare,
  onOpenAlternative,
  onOpenBuyer,
  onOpenBuyerList,
  onOpenPassport,
}) {
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
          {buyerMatches.slice(0, 3).map((buyer, index) => (
            <button
              className={index === 0 ? "selected" : ""}
              key={buyer.id}
              type="button"
              onClick={() => onOpenBuyer(buyer)}
            >
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
        <button className="text-button" type="button" onClick={onOpenBuyerList}>
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
          <button
            className="alternative-row"
            key={item.id}
            type="button"
            onClick={() => onOpenAlternative(item)}
          >
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
        <button
          className="text-button"
          type="button"
          onClick={() => onOpenAlternative(refurbishedAlternatives[0])}
        >
          View more alternatives <ChevronRight size={15} />
        </button>
      </section>

      <PurchaseFitPanel fitRanking={fitRanking} onCompare={onCompare} />

      <TrustPassport
        decision={decision}
        onOpenPassport={onOpenPassport}
        selectedRouteId={selectedRouteId}
      />
    </aside>
  );
}

function PurchaseFitPanel({ fitRanking, onCompare }) {
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
      <button type="button" onClick={onCompare}>
        Compare with new
      </button>
    </section>
  );
}

function TrustPassport({ decision, selectedRouteId, onOpenPassport }) {
  const activeRoute =
    decision.routes.find((route) => route.id === selectedRouteId) ?? decision.recommended;

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
        <button type="button" onClick={onOpenPassport}>
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

function TopActions({ onNavigate, onOpenHelp, onOpenNotifications }) {
  return (
    <div className="top-actions" aria-label="Notifications and help">
      <button type="button" aria-label="Open messages" onClick={onOpenNotifications}>
        <Bell size={18} />
      </button>
      <button type="button" aria-label="Open AI help" onClick={onOpenHelp}>
        <CircleHelp size={18} />
      </button>
      <button type="button" aria-label="Open settings" onClick={() => onNavigate("settings")}>
        <SettingsIcon size={18} />
      </button>
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

function HomeView({ decision, onNavigate, onOpenAlternative, onOpenHelp, onOpenNotifications }) {
  const fitRanking = rankPurchaseFit(refurbishedAlternatives, returnCase.customer);
  const bestFit = fitRanking[0];

  return (
    <main className="studio workspace-page">
      <TopActions
        onNavigate={onNavigate}
        onOpenHelp={onOpenHelp}
        onOpenNotifications={onOpenNotifications}
      />
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
          {fitRanking.map((item) => (
            <button
              className="list-row list-row-button"
              key={item.id}
              type="button"
              onClick={() => onOpenAlternative(item)}
            >
              <img src={item.image} alt="" />
              <span>
                <strong>{item.name}</strong>
                <small>{item.recommendation}</small>
              </span>
              <b>{item.confidence}%</b>
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}

function OrdersView({ onNavigate, onOpenOrder, onOpenHelp, onOpenNotifications }) {
  return (
    <main className="studio workspace-page">
      <TopActions
        onNavigate={onNavigate}
        onOpenHelp={onOpenHelp}
        onOpenNotifications={onOpenNotifications}
      />
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
            onClick={() => {
              if (order.id === returnCase.order.id) {
                onNavigate("returns");
              } else {
                onOpenOrder(order);
              }
            }}
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

function ResaleDashboardView({
  onNavigate,
  onOpenBuyer,
  onOpenHelp,
  onOpenNotifications,
}) {
  return (
    <main className="studio workspace-page">
      <TopActions
        onNavigate={onNavigate}
        onOpenHelp={onOpenHelp}
        onOpenNotifications={onOpenNotifications}
      />
      <PageHeader
        eyebrow="Resale dashboard"
        title="Second-life demand queue"
        description="Buyer demand, trust status, and route readiness for usable returned items."
      />
      <div className="metric-grid">
        <MetricCard label="Ready to resell" value="1 item" detail="A- grade · high confidence" />
        <MetricCard
          label="Top offer"
          value={formatCurrency(buyerMatches[0].offer)}
          detail="2-3 day payout"
        />
        <MetricCard label="Trust passport" value="Verified" detail="90-day warranty signal" />
      </div>
      <section className="panel list-panel">
        <h2>Buyer matches</h2>
        {buyerMatches.map((buyer) => (
          <button
            className="list-row list-row-button"
            key={buyer.id}
            type="button"
            onClick={() => onOpenBuyer(buyer)}
          >
            <img src={buyer.avatar} alt="" />
            <span>
              <strong>{buyer.name}</strong>
              <small>{buyer.reason}</small>
            </span>
            <b>{formatCurrency(buyer.offer)}</b>
          </button>
        ))}
      </section>
    </main>
  );
}

function GreenImpactView({
  decision,
  onNavigate,
  onOpenHelp,
  onOpenNotifications,
  onOpenRoute,
}) {
  return (
    <main className="studio workspace-page">
      <TopActions
        onNavigate={onNavigate}
        onOpenHelp={onOpenHelp}
        onOpenNotifications={onOpenNotifications}
      />
      <PageHeader
        eyebrow="Green impact"
        title="Customer impact ledger"
        description="A practical sustainability view tied to decisions the customer can actually make."
      />
      <div className="metric-grid">
        <MetricCard
          label="CO2e avoided"
          value={`${decision.impact.emissionsKgSaved} kg`}
          detail="From resale route estimate"
        />
        <MetricCard
          label="Waste avoided"
          value={`${decision.impact.landfillAvoidedGrams} g`}
          detail="Kept out of disposal"
        />
        <MetricCard
          label="Match confidence"
          value={`${decision.impact.nextOwnerMatchRate}%`}
          detail="Demand-backed second life"
        />
      </div>
      <section className="panel route-impact-panel">
        <h2>Impact by route</h2>
        {decision.routes.map((route) => (
          <button
            className="impact-row impact-row-button"
            key={route.id}
            type="button"
            onClick={() => onOpenRoute(route)}
          >
            <span>
              <strong>{route.title}</strong>
              <small>{route.customerReason}</small>
            </span>
            <b>{route.greenCredits.toFixed(2)} credits</b>
            <em>{route.impact} impact</em>
          </button>
        ))}
      </section>
    </main>
  );
}

function CreditsWalletView({ onNavigate, onOpenCredit, onOpenHelp, onOpenNotifications }) {
  return (
    <main className="studio workspace-page">
      <TopActions
        onNavigate={onNavigate}
        onOpenHelp={onOpenHelp}
        onOpenNotifications={onOpenNotifications}
      />
      <PageHeader
        eyebrow="Credits wallet"
        title={`${returnCase.customer.creditsBalance} green credits`}
        description={`Estimated value ${formatCurrency(returnCase.customer.creditsValue)} from verified lower-waste choices.`}
      />
      <section className="panel list-panel">
        <h2>Recent credit activity</h2>
        {creditEvents.map((event) => (
          <button
            className="credit-row credit-row-button"
            key={event.id}
            type="button"
            onClick={() => onOpenCredit(event)}
          >
            <span>
              <strong>{event.title}</strong>
              <small>{event.detail}</small>
            </span>
            <b>{event.amount}</b>
          </button>
        ))}
      </section>
    </main>
  );
}

function MessagesView({ onNavigate, onOpenHelp, onOpenMessage, onOpenNotifications }) {
  return (
    <main className="studio workspace-page">
      <TopActions
        onNavigate={onNavigate}
        onOpenHelp={onOpenHelp}
        onOpenNotifications={onOpenNotifications}
      />
      <PageHeader
        eyebrow="Messages"
        title="Return updates"
        description="Customer-facing status messages generated by the return resolution flow."
      />
      <section className="panel list-panel">
        {customerMessages.map((message) => (
          <button
            className="message-row message-row-button"
            key={message.id}
            type="button"
            onClick={() => onOpenMessage(message)}
          >
            <MessageCircle size={18} />
            <span>
              <strong>{message.title}</strong>
              <small>{message.detail}</small>
            </span>
          </button>
        ))}
      </section>
    </main>
  );
}

function SettingsView({
  onNavigate,
  onOpenHelp,
  onOpenNotifications,
  onToggleSetting,
  settings,
}) {
  const settingRows = [
    ["orderHistory", "Use order history for fit scoring"],
    ["trustPassport", "Store trust passport after route lock"],
    ["greenLedger", "Allow green-credit ledger updates"],
    ["aiEvidence", "Show AI evidence on customer passport"],
  ];

  return (
    <main className="studio workspace-page">
      <TopActions
        onNavigate={onNavigate}
        onOpenHelp={onOpenHelp}
        onOpenNotifications={onOpenNotifications}
      />
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
              <small>
                Not trained for this prototype. The demo uses AWS Rekognition plus an
                explainable decision layer.
              </small>
            </span>
            <Badge tone="neutral">Not trained</Badge>
          </div>
          <div className="settings-row">
            <span>
              <strong>Quality signal source</strong>
              <small>
                Uploaded scan photos are sent to AWS Rekognition on the deployed API.
              </small>
            </span>
            <Badge>AWS AI</Badge>
          </div>
          <div className="settings-row">
            <span>
              <strong>Customer decision layer</strong>
              <small>
                Deterministic route scoring keeps payout, trust, and impact explainable.
              </small>
            </span>
            <Badge>Active</Badge>
          </div>
        </section>
        <section className="panel settings-panel">
          <h2>Privacy controls</h2>
          {settingRows.map(([key, label]) => (
            <div className="toggle-row" key={key}>
              <span>{label}</span>
              <button
                className={`toggle-switch ${settings[key] ? "on" : ""}`}
                type="button"
                aria-pressed={settings[key]}
                onClick={() => onToggleSetting(key)}
              >
                {settings[key] ? "On" : "Off"}
              </button>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function ReturnsView({
  activeCase,
  aiAnalysis,
  decision,
  media,
  onExplainAi,
  onImageSelect,
  onNavigate,
  onOpenAlternative,
  onOpenBuyer,
  onOpenBuyerList,
  onOpenNotifications,
  onOpenPassport,
  onOpenReturnWindow,
  onOpenRoute,
  onRouteSelect,
  onUpload,
  selectedImage,
  selectedRoute,
  selectedRouteId,
  scanStep,
  setScanStep,
  syncState,
  uploadState,
}) {
  return (
    <main className="studio">
      <TopActions
        onNavigate={onNavigate}
        onOpenHelp={onExplainAi}
        onOpenNotifications={onOpenNotifications}
      />
      <ConnectedOrder onOpenOrders={() => onNavigate("orders")} />
      <ReturnHeader
        onBack={() => onNavigate("home")}
        onExplainWindow={onOpenReturnWindow}
      />

      <div className="studio-grid">
        <section className="primary-column">
          <div className="analysis-grid">
            <ReturnScan
              activeCase={activeCase}
              onImageSelect={onImageSelect}
              onUpload={onUpload}
              scanStep={scanStep}
              selectedImage={selectedImage}
              setScanStep={setScanStep}
              uploadState={uploadState}
            />
            <div className="analysis-stack">
              <GradePanel decision={decision} onExplainAi={onExplainAi} />
              <AiAnalysisPanel aiAnalysis={aiAnalysis} media={media} />
              <SignalCards scan={activeCase.scan} />
            </div>
          </div>

          <NextBestAction
            onOpenRoute={onOpenRoute}
            onSelect={onRouteSelect}
            routes={decision.routes}
            selectedRouteId={selectedRouteId}
          />
          <RouteComparison
            onOpenRoute={onOpenRoute}
            onSelect={onRouteSelect}
            routes={decision.routes}
            selectedRouteId={selectedRouteId}
          />
        </section>

        <MatchRail
          decision={decision}
          onCompare={() => onOpenAlternative(refurbishedAlternatives[0], "compare")}
          onOpenAlternative={onOpenAlternative}
          onOpenBuyer={onOpenBuyer}
          onOpenBuyerList={onOpenBuyerList}
          onOpenPassport={onOpenPassport}
          selectedRouteId={selectedRouteId}
        />
      </div>

      <ImpactBar
        decision={decision}
        selectedRoute={selectedRoute}
        syncState={syncState}
      />
    </main>
  );
}

function DetailList({ children }) {
  return <div className="detail-list">{children}</div>;
}

function DetailRow({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActionDrawer({ drawer, onClose, onNavigate, onRouteSelect }) {
  if (!drawer) return null;

  const { type, payload } = drawer;
  let title = drawer.title;
  let body = null;

  if (type === "profile") {
    title = "Customer profile";
    body = (
      <>
        <DetailList>
          <DetailRow label="Customer" value={returnCase.customer.name} />
          <DetailRow label="Email" value={returnCase.customer.email} />
          <DetailRow label="Green credits" value={returnCase.customer.creditsBalance} />
          <DetailRow
            label="Preferred use"
            value={returnCase.customer.fitProfile.preferredUse}
          />
          <DetailRow
            label="Comfort priority"
            value={`${returnCase.customer.fitProfile.comfortPriority}%`}
          />
        </DetailList>
        <div className="drawer-actions">
          <button type="button" onClick={() => onNavigate("wallet")}>
            Open wallet
          </button>
          <button type="button" onClick={() => onNavigate("settings")}>
            Privacy settings
          </button>
        </div>
      </>
    );
  }

  if (type === "order") {
    title = payload.title;
    body = (
      <>
        <DetailList>
          <DetailRow label="Order ID" value={payload.id} />
          <DetailRow label="Date" value={payload.date} />
          <DetailRow label="Status" value={payload.status} />
          <DetailRow label="Value" value={formatCurrency(payload.value)} />
        </DetailList>
        <p className="drawer-copy">
          NexTurn can estimate resale value and fit risk from order context before a
          customer starts a return.
        </p>
        <div className="drawer-actions">
          <button type="button" onClick={() => onNavigate("returns")}>
            Open returns hub
          </button>
          <button type="button" onClick={() => onNavigate("resale")}>
            See resale demand
          </button>
        </div>
      </>
    );
  }

  if (type === "buyer") {
    title = payload.name;
    body = (
      <>
        <DetailList>
          <DetailRow label="Offer" value={formatCurrency(payload.offer)} />
          <DetailRow label="Green credits" value={payload.credits.toFixed(2)} />
          <DetailRow label="Positive rate" value={`${payload.positiveRate}%`} />
          <DetailRow label="Reviews" value={payload.reviews.toLocaleString()} />
          <DetailRow label="Match reason" value={payload.reason} />
        </DetailList>
        <div className="drawer-actions">
          <button type="button" onClick={() => onRouteSelect("resell")}>
            Select resell route
          </button>
          <button type="button" onClick={() => onNavigate("messages")}>
            Message updates
          </button>
        </div>
      </>
    );
  }

  if (type === "buyer-list") {
    title = "Buyer queue";
    body = (
      <div className="drawer-list">
        {buyerMatches.map((buyer) => (
          <button key={buyer.id} type="button" onClick={() => drawer.openBuyer(buyer)}>
            <img src={buyer.avatar} alt="" />
            <span>
              <strong>{buyer.name}</strong>
              <small>{buyer.reason}</small>
            </span>
            <b>{formatCurrency(buyer.offer)}</b>
          </button>
        ))}
      </div>
    );
  }

  if (type === "alternative" || type === "compare") {
    title = type === "compare" ? "Refurbished vs new" : payload.name;
    body = (
      <>
        <div className="drawer-product">
          <img src={payload.image} alt="" />
          <span>
            <strong>{payload.name}</strong>
            <small>{payload.label}</small>
          </span>
        </div>
        <DetailList>
          <DetailRow label="Price" value={formatCurrency(payload.price)} />
          <DetailRow label="Condition" value={payload.condition} />
          <DetailRow label="Fit score" value={`${payload.fit}%`} />
          <DetailRow label="Predicted return risk" value={`${payload.returnRisk}%`} />
          <DetailRow
            label="New-item risk estimate"
            value={`${Math.min(payload.returnRisk + 18, 42)}%`}
          />
        </DetailList>
        <p className="drawer-copy">
          This keeps the customer in Amazon's trusted flow while nudging them toward
          lower-risk certified refurbished choices.
        </p>
        <div className="drawer-actions">
          <button type="button" onClick={() => onNavigate("orders")}>
            Connect to order
          </button>
          <button type="button" onClick={() => onNavigate("returns")}>
            Use as exchange match
          </button>
        </div>
      </>
    );
  }

  if (type === "route") {
    title = payload.title;
    body = (
      <>
        <DetailList>
          <DetailRow
            label="Payout / value"
            value={payload.payout > 0 ? formatCurrency(payload.payout) : "No cash payout"}
          />
          <DetailRow label="Green credits" value={payload.greenCredits.toFixed(2)} />
          <DetailRow label="Payment time" value={payload.paymentTime} />
          <DetailRow label="Convenience" value={payload.convenience} />
          <DetailRow label="Customer reason" value={payload.customerReason} />
        </DetailList>
        <div className="drawer-actions">
          <button type="button" onClick={() => onRouteSelect(payload.id)}>
            Select this route
          </button>
          <button type="button" onClick={() => onNavigate("impact")}>
            See impact
          </button>
        </div>
      </>
    );
  }

  if (type === "passport") {
    title = "Trust Passport";
    body = (
      <>
        <DetailList>
          <DetailRow label="Passport ID" value={returnCase.trustPassport.id} />
          <DetailRow label="Authenticity" value={returnCase.trustPassport.authenticity} />
          <DetailRow label="Functionality" value={returnCase.trustPassport.functionality} />
          <DetailRow label="Cleaning" value={returnCase.trustPassport.cleaned} />
          <DetailRow label="Warranty" value={`${returnCase.trustPassport.warrantyDays} days`} />
        </DetailList>
        <p className="drawer-copy">
          The passport can be shown to the next owner so customers can trust certified
          second-life items without guessing condition.
        </p>
      </>
    );
  }

  if (type === "ai") {
    title = "AI transparency";
    body = (
      <>
        <DetailList>
          <DetailRow label="AWS AI service" value="Amazon Rekognition DetectLabels" />
          <DetailRow label="Custom training" value="Not used in this prototype" />
          <DetailRow label="Decision layer" value="Explainable route scoring" />
          <DetailRow label="Persistence" value="DynamoDB scan record plus S3 media object" />
        </DetailList>
        <p className="drawer-copy">
          The AI detects visual labels from uploaded product images. NexTurn then uses
          transparent business rules for condition grade, payout route, and green credits
          so the customer can see why a decision was made.
        </p>
      </>
    );
  }

  if (type === "return-window") {
    title = "Return window";
    body = (
      <p className="drawer-copy">
        This connected order has {returnCase.returnWindowDays} days left in the return
        window. NexTurn prioritizes routes that preserve refund value while avoiding
        disposal or low-trust liquidation.
      </p>
    );
  }

  if (type === "notifications") {
    title = "Recent messages";
    body = (
      <div className="drawer-list">
        {customerMessages.map((message) => (
          <button key={message.id} type="button" onClick={() => onNavigate("messages")}>
            <MessageCircle size={18} />
            <span>
              <strong>{message.title}</strong>
              <small>{message.detail}</small>
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (type === "credit") {
    title = payload.title;
    body = (
      <DetailList>
        <DetailRow label="Credit change" value={payload.amount} />
        <DetailRow label="Reason" value={payload.detail} />
        <DetailRow label="Redeemable value" value={formatCurrency(returnCase.customer.creditsValue)} />
      </DetailList>
    );
  }

  if (type === "message") {
    title = payload.title;
    body = <p className="drawer-copy">{payload.detail}</p>;
  }

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="drawer-panel"
        aria-label={title}
        aria-modal="true"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" aria-label="Close panel" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="drawer-body">{body}</div>
      </aside>
    </div>
  );
}

export function App() {
  const initialDecision = useMemo(() => summarizeDecision(returnCase), []);
  const [activeCase, setActiveCase] = useState(returnCase);
  const [activeView, setActiveView] = useState("returns");
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [decision, setDecision] = useState(initialDecision);
  const [drawer, setDrawer] = useState(null);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [media, setMedia] = useState(null);
  const [scanStep, setScanStep] = useState(1);
  const [selectedImage, setSelectedImage] = useState(returnCase.item.image);
  const [selectedRouteId, setSelectedRouteId] = useState(initialDecision.recommended.id);
  const [settings, setSettings] = useState({
    aiEvidence: true,
    greenLedger: true,
    orderHistory: true,
    trustPassport: true,
  });
  const [syncState, setSyncState] = useState({
    status: "idle",
    message: "Local decision ready",
  });
  const [uploadState, setUploadState] = useState({
    status: "idle",
    title: "Ready for upload",
    message: "Upload a fresh product photo to run AWS Rekognition on the deployed app.",
  });

  const selectedRoute =
    decision.routes.find((route) => route.id === selectedRouteId) ??
    decision.recommended;

  function openDrawer(type, payload = {}, extra = {}) {
    setDrawer({ type, payload, ...extra });
  }

  function navigate(view) {
    setActiveView(view);
    setDrawer(null);
  }

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

  async function handleUpload(file) {
    if (file.size > 5 * 1024 * 1024) {
      setUploadState({
        status: "error",
        title: "Upload too large",
        message: "Use a product photo under 5 MB for this prototype.",
      });
      return;
    }

    setScanStep(1);
    setUploadState({
      status: "syncing",
      title: "Analyzing scan",
      message: "Uploading image and requesting AI labels...",
    });
    setSyncState({ status: "syncing", message: "Running AI scan..." });

    try {
      const result = await evaluateScanUpload(file, activeCase.scan);
      setSelectedImage(result.imagePreview);
      setAiAnalysis(result.aiAnalysis);
      setMedia(result.media);

      if (result.case) {
        const nextDecision = summarizeDecision(result.case);
        setActiveCase(result.case);
        setDecision(nextDecision);
        setSelectedRouteId(result.recommendedRoute?.id ?? nextDecision.recommended.id);
      }

      const usedAws = Boolean(result.aiAnalysis?.usedAws);
      setScanStep(2);
      setUploadState({
        status: usedAws ? "synced" : "idle",
        title: usedAws ? "AWS AI complete" : "Upload processed",
        message:
          result.aiAnalysis?.summary ??
          "Scan image was accepted and the condition decision was refreshed.",
      });
      setSyncState({
        status: result.persisted ? "synced" : usedAws ? "synced" : "idle",
        message: usedAws
          ? "AWS Rekognition labels applied"
          : result.aiAnalysis?.summary ?? "Upload kept locally",
      });
    } catch (error) {
      setUploadState({
        status: "error",
        title: "Upload failed",
        message: error.message,
      });
      setSyncState({
        status: "error",
        message: "AI scan unavailable. Existing decision preserved.",
      });
    }
  }

  function toggleSetting(key) {
    setSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  const commonPageProps = {
    onNavigate: navigate,
    onOpenHelp: () => openDrawer("ai"),
    onOpenNotifications: () => openDrawer("notifications"),
  };

  return (
    <div className={`app-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        activeView={activeView}
        collapsed={isSidebarCollapsed}
        onNavigate={navigate}
        onOpenProfile={() => openDrawer("profile")}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
      />
      {activeView === "home" && (
        <HomeView
          {...commonPageProps}
          decision={decision}
          onOpenAlternative={(item) => openDrawer("alternative", item)}
        />
      )}
      {activeView === "orders" && (
        <OrdersView
          {...commonPageProps}
          onOpenOrder={(order) => openDrawer("order", order)}
        />
      )}
      {activeView === "returns" && (
        <ReturnsView
          activeCase={activeCase}
          aiAnalysis={aiAnalysis}
          decision={decision}
          media={media}
          onExplainAi={() => openDrawer("ai")}
          onImageSelect={setSelectedImage}
          onNavigate={navigate}
          onOpenAlternative={(item, type = "alternative") => openDrawer(type, item)}
          onOpenBuyer={(buyer) => openDrawer("buyer", buyer)}
          onOpenBuyerList={() =>
            openDrawer("buyer-list", {}, { openBuyer: (buyer) => openDrawer("buyer", buyer) })
          }
          onOpenNotifications={() => openDrawer("notifications")}
          onOpenPassport={() => openDrawer("passport")}
          onOpenReturnWindow={() => openDrawer("return-window")}
          onOpenRoute={(route) => openDrawer("route", route)}
          onRouteSelect={handleRouteSelect}
          onUpload={handleUpload}
          scanStep={scanStep}
          selectedImage={selectedImage}
          selectedRoute={selectedRoute}
          selectedRouteId={selectedRouteId}
          setScanStep={setScanStep}
          syncState={syncState}
          uploadState={uploadState}
        />
      )}
      {activeView === "resale" && (
        <ResaleDashboardView
          {...commonPageProps}
          onOpenBuyer={(buyer) => openDrawer("buyer", buyer)}
        />
      )}
      {activeView === "impact" && (
        <GreenImpactView
          {...commonPageProps}
          decision={decision}
          onOpenRoute={(route) => openDrawer("route", route)}
        />
      )}
      {activeView === "wallet" && (
        <CreditsWalletView
          {...commonPageProps}
          onOpenCredit={(event) => openDrawer("credit", event)}
        />
      )}
      {activeView === "messages" && (
        <MessagesView
          {...commonPageProps}
          onOpenMessage={(message) => openDrawer("message", message)}
        />
      )}
      {activeView === "settings" && (
        <SettingsView
          {...commonPageProps}
          onToggleSetting={toggleSetting}
          settings={settings}
        />
      )}
      <ActionDrawer
        drawer={drawer}
        onClose={() => setDrawer(null)}
        onNavigate={navigate}
        onRouteSelect={handleRouteSelect}
      />
    </div>
  );
}
