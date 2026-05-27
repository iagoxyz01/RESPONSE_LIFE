import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FEE_WINDOW_HOURS = 10;      // hours before start that triggers a fee
const FEE_RATE = 0.20;            // 20% of proposed_value
const CAREGIVER_SHARE = 0.5;      // 50% of fee → caregiver  (10% of total)
const PLATFORM_SHARE = 0.5;       // 50% of fee → platform   (10% of total)

// Statuses where fee applies (caregiver confirmed)
const FEE_ELIGIBLE_STATUSES = ["scheduled", "awaiting_payment"];
// Statuses where cancellation is blocked entirely (service already running)
const BLOCKED_STATUSES = ["in_progress", "completed", "cancelled"];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify the user JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "Token inválido" }, 401);

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await req.json();
    const { request_id, reason } = body as { request_id: string; reason: string };

    if (!request_id || !reason) {
      return json({ error: "request_id e reason são obrigatórios" }, 400);
    }

    // ── Fetch the care request ─────────────────────────────────────────────────
    const { data: careReq, error: fetchErr } = await supabase
      .from("care_requests")
      .select("*, patients(id, user_id), caregivers(id, user_id)")
      .eq("id", request_id)
      .maybeSingle();

    if (fetchErr || !careReq) return json({ error: "Atendimento não encontrado" }, 404);

    // ── Ownership check: requester must own the request ────────────────────────
    if (careReq.requester_id !== user.id) {
      return json({ error: "Você não tem permissão para cancelar este atendimento" }, 403);
    }

    // ── Status check ───────────────────────────────────────────────────────────
    if (BLOCKED_STATUSES.includes(careReq.status)) {
      if (careReq.status === "in_progress") {
        return json({
          error: "O atendimento já está em andamento. Entre em contato com o suporte.",
          code: "ALREADY_IN_PROGRESS",
        }, 422);
      }
      if (careReq.status === "cancelled") {
        return json({ error: "Este atendimento já foi cancelado.", code: "ALREADY_CANCELLED" }, 422);
      }
      return json({ error: "Este atendimento não pode ser cancelado.", code: "NOT_CANCELLABLE" }, 422);
    }

    // ── Calculate time until service ────────────────────────────────────────────
    const now = new Date();
    const scheduledAt = new Date(careReq.scheduled_at);
    const msUntilStart = scheduledAt.getTime() - now.getTime();
    const hoursUntilStart = msUntilStart / (1000 * 60 * 60);

    // ── Determine if fee applies ───────────────────────────────────────────────
    const hasCaregiverAssigned = !!careReq.caregiver_id;
    const feeEligible = hasCaregiverAssigned && FEE_ELIGIBLE_STATUSES.includes(careReq.status);
    const withinFeeWindow = hoursUntilStart <= FEE_WINDOW_HOURS && hoursUntilStart > 0;
    const applyFee = feeEligible && withinFeeWindow;

    const proposedValue = Number(careReq.proposed_value) || 0;
    const feeTotal = applyFee ? Math.round(proposedValue * FEE_RATE * 100) / 100 : 0;
    const feeCaregiver = applyFee ? Math.round(feeTotal * CAREGIVER_SHARE * 100) / 100 : 0;
    const feePlatform = applyFee ? feeTotal - feeCaregiver : 0;

    // ── Apply cancellation (atomic updates) ────────────────────────────────────
    const cancelledAt = new Date().toISOString();

    // 1. Update care_request status
    const { error: updateErr } = await supabase
      .from("care_requests")
      .update({
        status: "cancelled",
        cancelled_at: cancelledAt,
        cancelled_by: user.id,
        cancellation_reason: reason,
        cancellation_fee_applied: applyFee,
        cancellation_fee_total: applyFee ? feeTotal : null,
        cancellation_fee_caregiver: applyFee ? feeCaregiver : null,
        cancellation_fee_platform: applyFee ? feePlatform : null,
        updated_at: cancelledAt,
      })
      .eq("id", request_id)
      .eq("requester_id", user.id);

    if (updateErr) return json({ error: "Erro ao cancelar. Tente novamente." }, 500);

    // 2. If fee applies → insert cancellation_fees record + credit caregiver
    if (applyFee && careReq.caregiver_id) {
      await supabase.from("cancellation_fees").insert({
        request_id,
        caregiver_id: careReq.caregiver_id,
        patient_id: careReq.patient_id,
        cancelled_by: user.id,
        proposed_value: proposedValue,
        fee_total: feeTotal,
        fee_caregiver: feeCaregiver,
        fee_platform: feePlatform,
        hours_before_start: Math.round(hoursUntilStart * 100) / 100,
        cancellation_reason: reason,
      });

      // Credit caregiver available_balance atomically
      if (feeCaregiver > 0) {
        await supabase.rpc("increment_caregiver_balance", {
          p_caregiver_id: careReq.caregiver_id,
          p_amount: feeCaregiver,
        });
      }

      // Add to request_logs
      await supabase.from("request_logs").insert({
        request_id,
        event: "cancelled",
        actor_id: user.id,
        actor_role: "patient",
        details: {
          old_status: careReq.status,
          new_status: "cancelled",
          cancellation_reason: reason,
          fee_applied: true,
          fee_total: feeTotal,
          fee_caregiver: feeCaregiver,
          fee_platform: feePlatform,
          hours_before_start: Math.round(hoursUntilStart * 100) / 100,
        },
      });

      // Notify caregiver about fee credit
      const { data: cgProfile } = await supabase
        .from("caregivers")
        .select("user_id")
        .eq("id", careReq.caregiver_id)
        .maybeSingle();

      if (cgProfile) {
        await supabase.from("notifications").insert({
          user_id: cgProfile.user_id,
          type: "cancellation_fee",
          title: "Taxa de cancelamento recebida",
          body: `O paciente cancelou com menos de ${FEE_WINDOW_HOURS}h de antecedência. Você receberá R$ ${feeCaregiver.toFixed(2)} de indenização.`,
          request_id,
        });
      }
    } else {
      // Log without fee
      await supabase.from("request_logs").insert({
        request_id,
        event: "cancelled",
        actor_id: user.id,
        actor_role: "patient",
        details: {
          old_status: careReq.status,
          new_status: "cancelled",
          cancellation_reason: reason,
          fee_applied: false,
        },
      });
    }

    // 3. Notify caregiver of cancellation (if assigned)
    if (careReq.caregiver_id) {
      const { data: cgProfile } = await supabase
        .from("caregivers")
        .select("user_id")
        .eq("id", careReq.caregiver_id)
        .maybeSingle();

      if (cgProfile) {
        await supabase.from("notifications").insert({
          user_id: cgProfile.user_id,
          type: "request_cancelled",
          title: "Atendimento cancelado",
          body: applyFee
            ? `O paciente cancelou o atendimento. Taxa de cancelamento: R$ ${feeCaregiver.toFixed(2)} creditada.`
            : "O paciente cancelou o atendimento.",
          request_id,
        });
      }
    }

    return json({
      success: true,
      fee_applied: applyFee,
      fee_total: feeTotal,
      fee_caregiver: feeCaregiver,
      fee_platform: feePlatform,
      hours_until_start: Math.round(hoursUntilStart * 100) / 100,
    });

  } catch (err) {
    console.error("cancel-request error:", err);
    return json({ error: "Erro interno. Tente novamente." }, 500);
  }
});
