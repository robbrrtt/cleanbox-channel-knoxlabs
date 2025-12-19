import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const ALLOWED_VARIANTS = new Set(["51363259973952"]);

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const secret = request.headers.get("X-Partner-Secret") || "";
  if (!process.env.PARTNER_SECRET || secret !== process.env.PARTNER_SECRET) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const { admin } = await authenticate.admin(request);
  const body = await request.json().catch(() => ({}));

  const variantId = String(body.variant_id || "").trim();
  const qty = Math.max(1, parseInt(body.quantity || "1", 10));
  const activation = String(body.activation_code || "").trim();
  const email = String(body.email || "").trim();

  if (!ALLOWED_VARIANTS.has(variantId)) {
    return json({ error: "Variant not allowed" }, { status: 400 });
  }

  const payload: any = {
    draft_order: {
      ...(email ? { email } : {}),
      line_items: [{ variant_id: Number(variantId), quantity: qty }],
      tags: "source:cleanbox,channel:cleanbox",
      note: `Partner=Cleanbox${activation ? ` | Activation=${activation}` : ""}`,
      note_attributes: [
        { name: "order_source", value: "Cleanbox" },
        { name: "partner", value: "Cleanbox" },
        ...(activation
          ? [{ name: "activation_code_community", value: activation }]
          : []),
      ],
    },
  };

  const res = await admin.rest.resources.DraftOrder.post({
    session: admin.session,
    body: payload,
  });

  const draft = (res as any)?.body?.draft_order;
  if (!draft?.invoice_url) {
    return json({ error: "No invoice_url returned" }, { status: 500 });
  }

  return json({
    invoice_url: draft.invoice_url,
    draft_order_id: draft.id,
  });
}
