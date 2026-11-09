import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { seedDatabase } from "../src/seed/run.js";
import { Article } from "../src/shared/models.js";
import { staff, useTestApp } from "./helpers.js";

const URL = "/api/v1/admin/curation";
const soon = (h = 24) => new Date(Date.now() + h * 3_600_000).toISOString();

describe("homepage controls page", () => {
  const ctx = useTestApp();
  beforeEach(async () => {
    await seedDatabase();
  });

  it("is for editors, and shows each choice in homepage order with what readers see", async () => {
    expect((await request(ctx.app).get(`${URL}?locale=en`).set((await staff("author")).auth)).status).toBe(403);
    const { auth } = await staff("editor");
    const [a, b] = await Article.find({ locale: "en", status: "published" }).sort({ publishedAt: 1 }).limit(2);
    await request(ctx.app).post(`${URL}/${a!._id}`).set(auth).send({ action: "pin", until: soon() }).expect(200);
    await request(ctx.app).post(`${URL}/${b!._id}`).set(auth).send({ action: "pin", until: soon(48) }).expect(200);

    const res = await request(ctx.app).get(`${URL}?locale=en`).set(auth);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.pins.map((p: { id: string }) => p.id)).toEqual([String(b!._id), String(a!._id)]);
    expect(d.homepage.lead.id).toBe(String(b!._id));
    expect(d.featured.length).toBeGreaterThan(0);
    expect(d.homepage.top).toHaveLength(3);

    // Pinning the older one again brings it back to the front.
    await request(ctx.app).post(`${URL}/${a!._id}`).set(auth).send({ action: "pin", until: soon() }).expect(200);
    expect((await request(ctx.app).get(`${URL}?locale=en`).set(auth)).body.data.homepage.lead.id).toBe(String(a!._id));
    expect(ctx.revalidated.flat()).toContain("articles");
  });

  it("features, picks, flags breaking and undoes each one", async () => {
    const { auth } = await staff("editor");
    const story = (await Article.findOne({ locale: "en", status: "published", isFeatured: false, isEditorsPick: false }))!;
    const act = (body: Record<string, unknown>) => request(ctx.app).post(`${URL}/${story._id}`).set(auth).send(body);
    await act({ action: "feature" }).expect(200);
    await act({ action: "pick" }).expect(200);
    await act({ action: "breaking", until: soon(2) }).expect(200);
    let d = (await request(ctx.app).get(`${URL}?locale=en`).set(auth)).body.data;
    expect(d.featured[0].id).toBe(String(story._id));
    expect(d.picks[0].id).toBe(String(story._id));
    // Featured last, it became the lead; the homepage never repeats the lead in other modules.
    expect(d.homepage.lead.id).toBe(String(story._id));
    expect(d.homepage.editorsPicks.map((x: { id: string }) => x.id)).not.toContain(String(story._id));
    expect(d.breaking.map((x: { id: string }) => x.id)).toContain(String(story._id));

    for (const action of ["unfeature", "unpick", "endBreaking"]) await act({ action }).expect(200);
    d = (await request(ctx.app).get(`${URL}?locale=en`).set(auth)).body.data;
    expect(d.featured.map((x: { id: string }) => x.id)).not.toContain(String(story._id));
    expect(d.breaking).toHaveLength(0);
  });

  it("refuses past times, missing times and unpublished stories", async () => {
    const { auth } = await staff("editor");
    const story = (await Article.findOne({ locale: "en", status: "published" }))!;
    expect((await request(ctx.app).post(`${URL}/${story._id}`).set(auth).send({ action: "pin" })).status).toBe(422);
    expect((await request(ctx.app).post(`${URL}/${story._id}`).set(auth).send({ action: "pin", until: new Date(Date.now() - 1000).toISOString() })).status).toBe(422);
    await Article.updateOne({ _id: story._id }, { status: "draft" });
    expect((await request(ctx.app).post(`${URL}/${story._id}`).set(auth).send({ action: "feature" })).status).toBe(409);
    expect((await request(ctx.app).post(`${URL}/${story._id}`).set(auth).send({ action: "unfeature" })).status).toBe(200);
  });
});
