import type { Extraction, Lead, Message } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

async function sendJson<T>(url: string, method: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error(`Request failed (${response.status})`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

export const api = {
  listMessages: () => getJson<Message[]>("/api/messages"),
  getMessage: (messageId: string) => getJson<Message>(`/api/messages/${encodeURIComponent(messageId)}`),
  listLeads: () => getJson<Lead[]>("/api/leads"),
  extract: (messageId: string) => sendJson<Extraction>("/api/ai/extract", "POST", { messageId }),
  createLead: (payload: {
    sourceMessageId: string;
    product: string;
    quantity: number;
    material: string | null;
    budget: number | null;
  }) => sendJson<Lead>("/api/leads", "POST", payload),
  markLeadContacted: (leadId: string) =>
    sendJson<Lead>(`/api/leads/${encodeURIComponent(leadId)}/status`, "PATCH", { status: "CONTACTED" }),
};
