import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { api } from "./api";
import type { Extraction, Lead, LeadFormValues, Message } from "./types";
import { emptyLeadForm } from "./types";

const path = window.location.pathname.replace(/\/+$/, "") || "/inbox";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function isEmptyField(value: string) {
  return value.trim() === "";
}

function mergeExtraction(current: LeadFormValues, extraction: Extraction): LeadFormValues {
  return {
    product: isEmptyField(current.product) && extraction.product != null && String(extraction.product).trim() !== ""
      ? String(extraction.product)
      : current.product,
    quantity: isEmptyField(current.quantity) && extraction.quantity != null
      ? String(extraction.quantity)
      : current.quantity,
    material: isEmptyField(current.material) && extraction.material != null && String(extraction.material).trim() !== ""
      ? String(extraction.material)
      : current.material,
    budget: isEmptyField(current.budget) && extraction.budget != null
      ? String(extraction.budget)
      : current.budget,
  };
}

function parseLeadPayload(messageId: string, form: LeadFormValues):
  | { ok: true; payload: { sourceMessageId: string; product: string; quantity: number; material: string | null; budget: number | null } }
  | { ok: false; error: string } {
  const product = form.product.trim();
  const quantity = Number(form.quantity);
  const material = form.material.trim();
  const budgetRaw = form.budget.trim();
  const budget = budgetRaw === "" ? null : Number(budgetRaw);

  if (!product) return { ok: false, error: "Product is required." };
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, error: "Quantity must be a positive whole number." };
  }
  if (budgetRaw !== "" && (!Number.isFinite(budget) || (budget as number) < 0)) {
    return { ok: false, error: "Budget must be a non-negative number." };
  }

  return {
    ok: true,
    payload: {
      sourceMessageId: messageId,
      product,
      quantity,
      material: material === "" ? null : material,
      budget,
    },
  };
}

function Layout({ children }: { children: ReactNode }) {
  const isPipeline = path === "/pipeline";
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/inbox" aria-label="InboxIQ home"><span className="brand-mark">IQ</span><span>InboxIQ</span></a>
        <nav aria-label="Primary navigation">
          <a className={!isPipeline ? "nav-link active" : "nav-link"} href="/inbox" aria-current={!isPipeline ? "page" : undefined}>Inbox</a>
          <a className={isPipeline ? "nav-link active" : "nav-link"} href="/pipeline" aria-current={isPipeline ? "page" : undefined}>Pipeline</a>
        </nav>
        <span className="status-pill"><span className="status-dot" /> Local workspace</span>
      </header>
      {children}
    </div>
  );
}

function StateMessage({ children }: { children: ReactNode }) {
  return <p className="state-message">{children}</p>;
}

function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api.listMessages().then((result) => {
      if (active) { setMessages(result); setState("ready"); }
    }).catch(() => active && setState("error"));
    return () => { active = false; };
  }, []);

  return (
    <main className="page-container">
      <section className="page-heading"><div><p className="eyebrow">Sales workspace</p><h1>Inbox</h1><p className="muted">Review inbound conversations and decide what deserves a follow-up.</p></div><div className="metric-card"><strong>{messages.length}</strong><span>messages</span></div></section>
      <section className="panel" aria-labelledby="messages-heading">
        <div className="panel-heading"><h2 id="messages-heading">Latest messages</h2><span className="muted">Deterministic demo data</span></div>
        {state === "loading" && <StateMessage>Loading inbox…</StateMessage>}
        {state === "error" && <StateMessage>Could not load the inbox. Check that the API is running.</StateMessage>}
        {state === "ready" && <ul className="message-list">{messages.map((message) => <MessageRow key={message.id} message={message} />)}</ul>}
      </section>
    </main>
  );
}

function MessageRow({ message }: { message: Message }) {
  return (
    <li>
      <a className="message-row" href={`/inbox/${message.id}`}>
        <span className="avatar">{message.senderName.slice(0, 1)}</span>
        <span className="message-copy">
          <span className="message-meta"><strong>{message.senderName}</strong><span>{formatDate(message.createdAt)}</span></span>
          <span className="message-subject">{message.subject}</span>
          <span className="message-preview">{message.company} · {message.body}</span>
        </span>
        <span className="row-arrow" aria-hidden="true">→</span>
      </a>
    </li>
  );
}

function DetailPage({ messageId }: { messageId: string }) {
  const [message, setMessage] = useState<Message | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api.getMessage(messageId).then((result) => {
      if (active) { setMessage(result); setState("ready"); }
    }).catch(() => active && setState("error"));
    return () => { active = false; };
  }, [messageId]);

  if (state === "loading") return <main className="page-container"><StateMessage>Loading message…</StateMessage></main>;
  if (state === "error" || !message) return <main className="page-container"><StateMessage>Message not found.</StateMessage></main>;

  return (
    <main className="page-container detail-layout">
      <a className="back-link" href="/inbox">← Back to inbox</a>
      <section className="detail-grid">
        <article className="panel message-detail">
          <p className="eyebrow">Inbound message</p>
          <h1>{message.subject}</h1>
          <dl className="message-facts">
            <div><dt>Sender</dt><dd>{message.senderName} · {message.senderEmail}</dd></div>
            <div><dt>Company</dt><dd>{message.company}</dd></div>
          </dl>
          <div className="message-body">{message.body}</div>
        </article>
        <LeadExtractionPanel messageId={message.id} />
      </section>
    </main>
  );
}

function LeadExtractionPanel({ messageId }: { messageId: string }) {
  const formId = useId();
  const [form, setForm] = useState<LeadFormValues>(emptyLeadForm);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const busy = extracting || saving;

  function updateField<K extends keyof LeadFormValues>(key: K, value: LeadFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setValidationError(null);
    setSaveSuccess(false);
  }

  async function handleExtract() {
    setExtracting(true);
    setExtractError(null);
    setValidationError(null);
    setSaveSuccess(false);
    try {
      const extraction = await api.extract(messageId);
      setForm((current) => mergeExtraction(current, extraction));
    } catch {
      setExtractError("Extraction failed. You can still fill the form manually.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveSuccess(false);
    const parsed = parseLeadPayload(messageId, form);
    if (!parsed.ok) {
      setValidationError(parsed.error);
      return;
    }

    setSaving(true);
    setValidationError(null);
    try {
      await api.createLead(parsed.payload);
      setSaveSuccess(true);
    } catch {
      setValidationError("Could not save the lead. Check your input and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="panel extraction-panel" aria-label="Lead extraction">
      <p className="eyebrow">Next step</p>
      <h2 className="extraction-title">Lead details</h2>
      <p className="muted extraction-copy">Extract fields with AI, edit them, then save a lead to the pipeline.</p>

      <div className="extraction-actions">
        <button type="button" className="button button-secondary" onClick={handleExtract} disabled={busy}>
          {extracting ? "Extracting…" : "Extract with AI"}
        </button>
      </div>

      {extractError && <p className="alert" role="alert">{extractError}</p>}

      <form className="lead-form" onSubmit={handleSave} noValidate>
        <div className="field">
          <label htmlFor={`${formId}-product`}>Product</label>
          <input
            id={`${formId}-product`}
            name="product"
            value={form.product}
            onChange={(event) => updateField("product", event.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor={`${formId}-quantity`}>Quantity</label>
          <input
            id={`${formId}-quantity`}
            name="quantity"
            inputMode="numeric"
            value={form.quantity}
            onChange={(event) => updateField("quantity", event.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor={`${formId}-material`}>Material</label>
          <input
            id={`${formId}-material`}
            name="material"
            value={form.material}
            onChange={(event) => updateField("material", event.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor={`${formId}-budget`}>Budget</label>
          <input
            id={`${formId}-budget`}
            name="budget"
            inputMode="decimal"
            value={form.budget}
            onChange={(event) => updateField("budget", event.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </div>

        {validationError && <p className="alert" role="alert">{validationError}</p>}
        {saveSuccess && <p className="success" role="status">Lead saved. View it in the pipeline.</p>}

        <button type="submit" className="button button-primary" disabled={busy}>
          {saving ? "Saving…" : "Save lead"}
        </button>
      </form>
    </aside>
  );
}

function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api.listLeads().then((result) => {
      if (active) { setLeads(result); setState("ready"); }
    }).catch(() => active && setState("error"));
    return () => { active = false; };
  }, []);

  function handleLeadUpdated(updated: Lead) {
    setLeads((current) => current.map((lead) => (lead.id === updated.id ? updated : lead)));
  }

  return (
    <main className="page-container">
      <section className="page-heading"><div><p className="eyebrow">Revenue view</p><h1>Pipeline</h1><p className="muted">Saved leads will appear here.</p></div><div className="metric-card"><strong>{leads.length}</strong><span>leads</span></div></section>
      <section className="panel" aria-labelledby="pipeline-heading">
        <div className="panel-heading"><h2 id="pipeline-heading">Leads</h2></div>
        {state === "loading" && <StateMessage>Loading pipeline…</StateMessage>}
        {state === "error" && <StateMessage>Could not load the pipeline.</StateMessage>}
        {state === "ready" && (leads.length === 0 ? <p className="state-message">No leads yet.</p> : (
          <ul className="lead-list">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onUpdated={handleLeadUpdated} />
            ))}
          </ul>
        ))}
      </section>
    </main>
  );
}

function LeadCard({ lead, onUpdated }: { lead: Lead; onUpdated: (lead: Lead) => void }) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMarkContacted() {
    setUpdating(true);
    setError(null);
    try {
      const updated = await api.markLeadContacted(lead.id);
      onUpdated(updated);
    } catch {
      setError("Could not update lead status.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <li className="lead-card">
      <div className="lead-card-body">
        <h3>{lead.product}</h3>
        <p>{lead.quantity} unit{lead.quantity === 1 ? "" : "s"}{lead.material ? ` · ${lead.material}` : ""}</p>
        <span className="muted">{lead.status} · {lead.budget === null ? "Budget unknown" : `${lead.budget}`}</span>
        {error && <p className="alert" role="alert">{error}</p>}
      </div>
      {lead.status === "NEW" && (
        <button type="button" className="button button-secondary" onClick={handleMarkContacted} disabled={updating}>
          {updating ? "Updating…" : "Mark as contacted"}
        </button>
      )}
    </li>
  );
}

export function App() {
  const content = path === "/pipeline" ? <PipelinePage /> : path.startsWith("/inbox/") ? <DetailPage messageId={decodeURIComponent(path.slice("/inbox/".length))} /> : <InboxPage />;
  return <Layout>{content}</Layout>;
}
