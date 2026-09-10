import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../server/app.js";
import { prisma } from "../server/db.js";

describe("InboxIQ API", () => {
  it("returns exactly the four seed messages as raw Message objects", async () => {
    const response = await request(app).get("/api/messages");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(4);
    expect(response.body.map((message: { id: string }) => message.id)).toEqual([
      "message-perfect",
      "message-partial",
      "message-failure",
      "message-empty",
    ]);
    expect(response.body[0]).toEqual(expect.objectContaining({ company: "Acme", createdAt: expect.any(String) }));
    expect(response.body[0]).not.toHaveProperty("tags");
  });

  it("returns a raw message detail and no list alias", async () => {
    const detail = await request(app).get("/api/messages/message-perfect");
    const alias = await request(app).get("/api/messages/list");

    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe("message-perfect");
    expect(detail.body).not.toHaveProperty("message");
    expect(alias.status).toBe(404);
  });

  it("starts with no leads", async () => {
    const leads = await request(app).get("/api/leads");

    expect(leads.status).toBe(200);
    expect(leads.body).toEqual([]);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("returns a stable error for malformed API JSON", async () => {
    const response = await request(app)
      .post("/api/ai/extract")
      .set("content-type", "application/json")
      .send('{"messageId":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_json" });
  });

  it("accepts only the strict messageId extraction request", async () => {
    const alias = await request(app).post("/api/ai/extract").send({ id: "message-perfect" });
    const perfect = await request(app).post("/api/ai/extract").send({ messageId: "message-perfect" });

    expect(alias.status).toBe(400);
    expect(perfect.status).toBe(200);
    expect(perfect.body).toEqual({ product: "Desk", quantity: 30, material: "Oak", budget: 50000 });
  });

  it("returns deterministic partial, failure, and empty extraction states", async () => {
    const partial = await request(app).post("/api/ai/extract").send({ messageId: "message-partial" });
    const failure = await request(app).post("/api/ai/extract").send({ messageId: "message-failure" });
    const empty = await request(app).post("/api/ai/extract").send({ messageId: "message-empty" });

    expect(partial.status).toBe(200);
    expect(partial.body).toEqual({ product: "Ergonomic Chair", quantity: null, material: "Black", budget: 12000 });
    expect(failure.status).toBe(500);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({});
  });

  it("creates a lead with NEW status and allows multiple leads for one message", async () => {
    const before = await prisma.lead.count();
    const first = await request(app).post("/api/leads").send({
      sourceMessageId: "message-perfect",
      product: "Desk",
      quantity: 30,
      material: "Oak",
      budget: 50000,
      status: "CONTACTED",
    });
    const second = await request(app).post("/api/leads").send({
      sourceMessageId: "message-perfect",
      product: "Desk",
      quantity: 10,
      material: "",
      budget: null,
    });

    expect(first.status).toBe(201);
    expect(first.body).toEqual(
      expect.objectContaining({
        sourceMessageId: "message-perfect",
        product: "Desk",
        quantity: 30,
        material: "Oak",
        budget: 50000,
        status: "NEW",
        createdAt: expect.any(String),
      }),
    );
    expect(second.status).toBe(201);
    expect(second.body.material).toBeNull();
    expect(second.body.status).toBe("NEW");
    expect(await prisma.lead.count()).toBe(before + 2);
  });

  it("rejects invalid lead payloads without creating records", async () => {
    const before = await prisma.lead.count();
    const missingMessage = await request(app).post("/api/leads").send({
      sourceMessageId: "missing-message",
      product: "Desk",
      quantity: 2,
    });
    const emptyProduct = await request(app).post("/api/leads").send({
      sourceMessageId: "message-perfect",
      product: "   ",
      quantity: 2,
    });
    const badQuantity = await request(app).post("/api/leads").send({
      sourceMessageId: "message-perfect",
      product: "Desk",
      quantity: 0,
    });
    const badBudget = await request(app).post("/api/leads").send({
      sourceMessageId: "message-perfect",
      product: "Desk",
      quantity: 2,
      budget: -1,
    });

    expect(missingMessage.status).toBe(400);
    expect(emptyProduct.status).toBe(400);
    expect(badQuantity.status).toBe(400);
    expect(badBudget.status).toBe(400);
    expect(await prisma.lead.count()).toBe(before);
  });

  it("updates lead status from NEW to CONTACTED only once", async () => {
    const created = await request(app).post("/api/leads").send({
      sourceMessageId: "message-partial",
      product: "Chair",
      quantity: 5,
      material: "Black",
      budget: 12000,
    });

    const updated = await request(app)
      .patch(`/api/leads/${created.body.id}/status`)
      .send({ status: "CONTACTED" });
    const again = await request(app)
      .patch(`/api/leads/${created.body.id}/status`)
      .send({ status: "CONTACTED" });
    const unknown = await request(app).patch("/api/leads/does-not-exist/status").send({ status: "CONTACTED" });
    const invalid = await request(app)
      .patch(`/api/leads/${created.body.id}/status`)
      .send({ status: "NEW" });

    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe("CONTACTED");
    expect(again.status).toBe(409);
    expect(unknown.status).toBe(404);
    expect(invalid.status).toBe(400);

    const persisted = await prisma.lead.findUnique({ where: { id: created.body.id } });
    expect(persisted?.status).toBe("CONTACTED");
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
