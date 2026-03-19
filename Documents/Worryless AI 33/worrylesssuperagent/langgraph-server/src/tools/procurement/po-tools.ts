// Procurement PO tool (OPS-05)
// Tool: createPurchaseOrder (HITL)

import { getPool } from "../shared/db.js";
import { interruptForApproval } from "../../hitl/interrupt-handler.js";
import type { PurchaseOrderInput } from "./types.js";
import type { AgentTypeId } from "../../types/agent-types.js";

// ── Tool 4: Create Purchase Order (HITL) ─────────────────────────

/**
 * OPS-05: Create a purchase order with HITL approval.
 * Interrupts graph execution for user approval before creating the PO.
 * On approval, stores the PO as an agent_asset with asset_type='purchase_order'.
 */
export async function createPurchaseOrder(
  userId: string,
  agentType: string,
  input: PurchaseOrderInput,
): Promise<{ created: boolean; poId?: string; message: string }> {
  const description = `Create purchase order: ${input.quantity}x "${input.itemDescription}" from ${input.supplier} for ${input.totalAmount}`;

  const approval = interruptForApproval({
    action: "create_purchase_order",
    agentType: agentType as AgentTypeId,
    description,
    payload: input as unknown as Record<string, unknown>,
  });

  if (!approval.approved) {
    return {
      created: false,
      message: "Purchase order creation cancelled by user.",
    };
  }

  // Store PO as an agent_asset (no dedicated purchase_orders table yet)
  const pool = getPool();

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO public.agent_assets
       (user_id, agent_type, asset_type, title, content)
     VALUES ($1, $2, 'purchase_order', $3, $4)
     RETURNING id`,
    [
      userId,
      agentType,
      `PO: ${input.quantity}x ${input.itemDescription} from ${input.supplier}`,
      JSON.stringify(input),
    ],
  );

  const poId = rows[0].id;

  return {
    created: true,
    poId,
    message: `Purchase order #${poId} created: ${input.totalAmount} to ${input.supplier}`,
  };
}
