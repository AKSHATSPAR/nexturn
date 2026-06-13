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
  Settings,
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

const navItems = [
  ["Home", Home],
  ["Orders", ShoppingBag],
  ["Returns hub", RefreshCcw],
  ["Resale dashboard", Store],
  ["Green impact", Leaf],
  ["Credits wallet", WalletCards],
  ["Messages", MessageCircle],
  ["Settings", Settings],
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

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Recycle size={22} strokeWidth={2.7} />
        </div>
        <span>NexTurn</span>
      </div>

      <nav className="nav-list" aria-label="Primary navigation">
        {navItems.map(([label, Icon], index) => (
          <button
            className={`nav-item ${label === "Returns hub" ? "active" : ""} ${
              index === 6 ? "nav-spaced" : ""
            }`}
            key={label}
            type="button"
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
        <button type="button">View activity</button>
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

function ConnectedOrder() {
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
      <button type="button">
        View order <ExternalLink size={15} />
      </button>
    </section>
  );
}

function ReturnHeader() {
  return (
    <header className="return-header">
      <div>
        <button className="back-link" type="button">
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

      <TrustPassport selectedRouteId={selectedRouteId} />
    </aside>
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

function ImpactBar({ decision, selectedRoute }) {
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
    </section>
  );
}

export function App() {
  const decision = useMemo(() => summarizeDecision(returnCase), []);
  const [selectedRouteId, setSelectedRouteId] = useState(decision.recommended.id);
  const [scanStep, setScanStep] = useState(1);

  const selectedRoute =
    decision.routes.find((route) => route.id === selectedRouteId) ??
    decision.recommended;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="studio">
        <div className="top-actions" aria-label="Notifications">
          <Bell size={18} />
          <CircleHelp size={18} />
        </div>
        <ConnectedOrder />
        <ReturnHeader />

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
              onSelect={setSelectedRouteId}
              routes={decision.routes}
              selectedRouteId={selectedRouteId}
            />
            <RouteComparison
              onSelect={setSelectedRouteId}
              routes={decision.routes}
              selectedRouteId={selectedRouteId}
            />
          </section>

          <MatchRail selectedRouteId={selectedRouteId} />
        </div>

        <ImpactBar decision={decision} selectedRoute={selectedRoute} />
      </main>
    </div>
  );
}
