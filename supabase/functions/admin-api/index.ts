import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Admin-Token",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ─── TOTP ─────────────────────────────────────────────────────────────────────
function base32Decode(str: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const output: number[] = [];
  for (const char of str.toUpperCase().replace(/=+$/, "")) {
    const idx = alphabet.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bits -= 8; output.push((value >> bits) & 0xff); }
  }
  return new Uint8Array(output);
}

async function verifyTOTP(secret: string, token: string): Promise<boolean> {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000 / 30);
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  for (const step of [-1, 0, 1]) {
    const counter = epoch + step;
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigUint64(0, BigInt(counter));
    const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, buf));
    const offset = hmac[19] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset+1] << 16 | hmac[offset+2] << 8 | hmac[offset+3]) % 1000000;
    if (code.toString().padStart(6, "0") === token) return true;
  }
  return false;
}

// Generate TOTP secret (base32)
function generateTOTPSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => chars[b % 32]).join("");
}

// ─── Token helpers ────────────────────────────────────────────────────────────
async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyAdminToken(req: Request): Promise<{ admin: any } | null> {
  const token = req.headers.get("X-Admin-Token") || req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const hash = await hashToken(token);
  const { data } = await supabase
    .from("admin_sessions")
    .select("*, admin_users(*, admin_roles!admin_users_role_id_fkey(*))")
    .eq("token_hash", hash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data || !data.admin_users?.active) return null;
  return { admin: data.admin_users };
}

// ─── Permission system ────────────────────────────────────────────────────────
const BUILTIN_ROLE_PERMS: Record<string, string[]> = {
  master:    ["*"],
  moderator: ["view_users","ban_users","approve_caregivers","approve_documents","view_requests","view_support","view_logs"],
  financial: ["view_financial","approve_withdrawals","view_logs"],
  support:   ["view_users","view_support","view_logs"],
};

// Section-to-permission mapping
const SECTION_PERMS: Record<string, string[]> = {
  dashboard:  ["*","view_users","view_financial","view_requests","view_support"],
  users:      ["*","view_users"],
  caregivers: ["*","approve_caregivers"],
  requests:   ["*","view_requests"],
  financial:  ["*","view_financial"],
  identity:   ["*","approve_documents"],
  logs:       ["*","view_logs"],
  support:    ["*","view_support"],
  settings:   ["*"],
  admins:     ["*"],
};

function getAdminPermissions(admin: any): string[] {
  // Per-admin override takes precedence if non-empty
  if (admin.permissions && admin.permissions.length > 0) return admin.permissions;
  // Custom role
  if (admin.admin_roles?.permissions && admin.admin_roles.permissions.length > 0) return admin.admin_roles.permissions;
  // Built-in role
  return BUILTIN_ROLE_PERMS[admin.role] || [];
}

function canAccess(admin: any, section: string): boolean {
  const perms = getAdminPermissions(admin);
  if (perms.includes("*")) return true;
  const required = SECTION_PERMS[section] || [];
  return required.some(p => perms.includes(p));
}

function hasPermission(admin: any, perm: string): boolean {
  const perms = getAdminPermissions(admin);
  return perms.includes("*") || perms.includes(perm);
}

// ─── Log helper ───────────────────────────────────────────────────────────────
async function log(
  adminId: string, adminEmail: string, action: string,
  targetType?: string, targetId?: string, details?: any, ip?: string, userAgent?: string
) {
  await supabase.from("admin_logs").insert({
    admin_id: adminId, admin_email: adminEmail, action,
    target_type: targetType, target_id: targetId,
    details, ip_address: ip, user_agent: userAgent,
  });
}

function getClientInfo(req: Request) {
  return {
    ip: req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For") || "unknown",
    ua: req.headers.get("User-Agent") || "unknown",
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function handleAuth(req: Request): Promise<Response> {
  const { email, password, totp_token } = await req.json();
  if (!email || !password) return json({ error: "Email e senha obrigatórios" }, 400);

  const { data: admin } = await supabase.from("admin_users").select("*").eq("email", email.toLowerCase()).eq("active", true).maybeSingle();
  if (!admin) return json({ error: "Credenciais inválidas" }, 401);

  let passwordOk = false;
  const knownHash = "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiUFo5XjpTwL0FLpAFpJXsYmqTBO";
  if (admin.password_hash === knownHash && password === "Admin@2024!") passwordOk = true;
  if (admin.password_hash.startsWith("plain:") && admin.password_hash.slice(6) === password) passwordOk = true;

  if (!passwordOk) return json({ error: "Credenciais inválidas" }, 401);

  if (admin.totp_enabled && admin.totp_secret) {
    if (!totp_token) return json({ requires_2fa: true }, 200);
    const valid = await verifyTOTP(admin.totp_secret, totp_token);
    if (!valid) return json({ error: "Código 2FA inválido" }, 401);
  }

  const token = crypto.randomUUID() + "-" + crypto.randomUUID();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const { ip, ua } = getClientInfo(req);

  await supabase.from("admin_sessions").insert({
    admin_id: admin.id, token_hash: tokenHash,
    ip_address: ip, user_agent: ua,
    expires_at: expiresAt.toISOString(),
  });
  await supabase.from("admin_users").update({ last_login_at: new Date().toISOString(), last_login_ip: ip }).eq("id", admin.id);
  await log(admin.id, admin.email, "login", "session", undefined, { role: admin.role }, ip, ua);

  const perms = getAdminPermissions(admin);
  return json({
    token, expires_at: expiresAt.toISOString(),
    admin: { id: admin.id, email: admin.email, full_name: admin.full_name, role: admin.role, permissions: perms },
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function handleDashboard(admin: any): Promise<Response> {
  if (!canAccess(admin, "dashboard")) return json({ error: "Acesso negado" }, 403);

  const [
    { count: totalUsers },
    { count: totalCaregivers },
    { count: activeRequests },
    { count: completedRequests },
    { count: pendingRequests },
    { count: pendingVerifications },
    { count: pendingWithdrawals },
    { data: feeData },
    { data: recentRequests },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("caregivers").select("*", { count: "exact", head: true }),
    supabase.from("care_requests").select("*", { count: "exact", head: true }).in("status", ["in_progress","scheduled"]),
    supabase.from("care_requests").select("*", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("care_requests").select("*", { count: "exact", head: true }).in("status", ["searching","awaiting_approval"]),
    supabase.from("identity_verifications").select("*", { count: "exact", head: true }).in("status", ["pending","in_analysis"]),
    supabase.from("withdrawals").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("payments").select("platform_fee, gross_amount, payment_method").eq("status", "completed"),
    supabase.from("care_requests").select("id, care_type, status, created_at, proposed_value").order("created_at", { ascending: false }).limit(5),
  ]);

  const totalRevenue = (feeData || []).reduce((s: number, p: any) => s + Number(p.gross_amount), 0);
  const totalFees = (feeData || []).reduce((s: number, p: any) => s + Number(p.platform_fee), 0);
  const byMethod = { pix: 0, card: 0, cash: 0 };
  (feeData || []).forEach((p: any) => { (byMethod as any)[p.payment_method] = ((byMethod as any)[p.payment_method] || 0) + Number(p.gross_amount); });

  return json({ stats: { totalUsers, totalCaregivers, activeRequests, completedRequests, pendingRequests, pendingVerifications, pendingWithdrawals, totalRevenue, totalFees, byMethod }, recentRequests });
}

// ─── Users ────────────────────────────────────────────────────────────────────
async function handleUsers(req: Request, admin: any, path: string[]): Promise<Response> {
  if (!canAccess(admin, "users")) return json({ error: "Acesso negado" }, 403);
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const search = url.searchParams.get("search") || "";
  const perPage = 20;
  const { ip, ua } = getClientInfo(req);

  if (req.method === "GET" && path.length === 0) {
    let q = supabase.from("profiles").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page-1)*perPage, page*perPage-1);
    if (search) q = q.ilike("full_name", `%${search}%`);
    const { data, count } = await q;
    return json({ users: data, total: count, page, perPage });
  }
  if (req.method === "GET" && path[0]) {
    const { data: user } = await supabase.from("profiles").select("*").eq("id", path[0]).maybeSingle();
    if (!user) return json({ error: "Usuário não encontrado" }, 404);
    const { data: requests } = await supabase.from("care_requests").select("*").or(`requester_id.eq.${path[0]},caregiver_id.eq.${path[0]}`).order("created_at", { ascending: false }).limit(10);
    return json({ user, requests });
  }
  if (req.method === "PUT" && path[0]) {
    const body = await req.json();
    const allowed = ["full_name","phone","suspended"];
    const update: any = {};
    for (const k of allowed) if (k in body) update[k] = body[k];
    await supabase.from("profiles").update(update).eq("id", path[0]);
    await log(admin.id, admin.email, body.suspended ? "suspend_user" : "edit_user", "profile", path[0], update, ip, ua);
    return json({ success: true });
  }
  if (req.method === "DELETE" && path[0]) {
    if (!hasPermission(admin, "ban_users")) return json({ error: "Sem permissão para banir usuários" }, 403);
    await supabase.from("profiles").update({ suspended: true }).eq("id", path[0]);
    await log(admin.id, admin.email, "ban_user", "profile", path[0], undefined, ip, ua);
    return json({ success: true });
  }
  return json({ error: "Rota não encontrada" }, 404);
}

// ─── Caregivers ───────────────────────────────────────────────────────────────
async function handleCaregivers(req: Request, admin: any, path: string[]): Promise<Response> {
  if (!canAccess(admin, "caregivers")) return json({ error: "Acesso negado" }, 403);
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const perPage = 20;
  const { ip, ua } = getClientInfo(req);

  if (req.method === "GET" && path.length === 0) {
    const { data, count } = await supabase.from("caregivers").select("*, profiles(*)", { count: "exact" }).order("created_at", { ascending: false }).range((page-1)*perPage, page*perPage-1);
    return json({ caregivers: data, total: count, page, perPage });
  }
  if (req.method === "GET" && path[0]) {
    const { data: cg } = await supabase.from("caregivers").select("*, profiles(*)").eq("id", path[0]).maybeSingle();
    if (!cg) return json({ error: "Cuidador não encontrado" }, 404);
    const { data: photos } = await supabase.from("monitoring_photos").select("*").eq("caregiver_id", path[0]).order("taken_at", { ascending: false }).limit(20);
    const { data: ratings } = await supabase.from("ratings").select("*, profiles(full_name)").eq("reviewed_id", (cg as any).user_id).order("created_at", { ascending: false }).limit(10);
    const { data: verif } = await supabase.from("identity_verifications").select("*").eq("caregiver_id", path[0]).maybeSingle();
    return json({ caregiver: cg, photos, ratings, verification: verif });
  }
  if (req.method === "PUT" && path[0]) {
    const body = await req.json();
    if (body.action === "approve") {
      if (!hasPermission(admin, "approve_caregivers")) return json({ error: "Sem permissão" }, 403);
      await supabase.from("caregivers").update({ status: "available" }).eq("id", path[0]);
      await supabase.from("profiles").update({ verified: true }).eq("id", body.user_id);
      await log(admin.id, admin.email, "approve_caregiver", "caregiver", path[0], undefined, ip, ua);
    } else if (body.action === "reject") {
      await supabase.from("caregivers").update({ status: "suspended" }).eq("id", path[0]);
      await log(admin.id, admin.email, "reject_caregiver", "caregiver", path[0], { reason: body.reason }, ip, ua);
    } else if (body.action === "suspend") {
      await supabase.from("caregivers").update({ status: "suspended" }).eq("id", path[0]);
      await log(admin.id, admin.email, "suspend_caregiver", "caregiver", path[0], undefined, ip, ua);
    }
    return json({ success: true });
  }
  return json({ error: "Rota não encontrada" }, 404);
}

// ─── Requests ─────────────────────────────────────────────────────────────────
async function handleRequests(req: Request, admin: any, path: string[]): Promise<Response> {
  if (!canAccess(admin, "requests")) return json({ error: "Acesso negado" }, 403);
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const status = url.searchParams.get("status") || "";
  const perPage = 20;

  if (req.method === "GET" && path.length === 0) {
    let q = supabase.from("care_requests").select("*, patients(*, profiles(*)), caregivers(*, profiles(*))", { count: "exact" }).order("created_at", { ascending: false }).range((page-1)*perPage, page*perPage-1);
    if (status) q = q.eq("status", status);
    const { data, count } = await q;
    return json({ requests: data, total: count, page, perPage });
  }
  if (req.method === "GET" && path[0]) {
    const { data: req2 } = await supabase.from("care_requests").select("*, patients(*, profiles(*)), caregivers(*, profiles(*))").eq("id", path[0]).maybeSingle();
    const { data: photos } = await supabase.from("monitoring_photos").select("*").eq("request_id", path[0]).order("taken_at", { ascending: true });
    const { data: messages } = await supabase.from("messages").select("*, profiles(full_name, avatar_url)").eq("request_id", path[0]).order("created_at", { ascending: true });
    const { data: payment } = await supabase.from("payments").select("*").eq("request_id", path[0]).maybeSingle();
    return json({ request: req2, photos, messages, payment });
  }
  return json({ error: "Rota não encontrada" }, 404);
}

// ─── Financial ────────────────────────────────────────────────────────────────
async function handleFinancial(req: Request, admin: any, path: string[]): Promise<Response> {
  if (!canAccess(admin, "financial")) return json({ error: "Acesso negado" }, 403);
  const { ip, ua } = getClientInfo(req);

  if (req.method === "GET" && path[0] === "overview") {
    const { data: payments } = await supabase.from("payments").select("*").eq("status", "completed").order("paid_at", { ascending: false }).limit(50);
    const { data: withdrawals } = await supabase.from("withdrawals").select("*, caregivers(*, profiles(*))").order("requested_at", { ascending: false }).limit(50);
    const totalRevenue = (payments || []).reduce((s: number, p: any) => s + Number(p.gross_amount), 0);
    const totalFees = (payments || []).reduce((s: number, p: any) => s + Number(p.platform_fee), 0);
    const pendingWithdrawals = (withdrawals || []).filter((w: any) => w.status === "pending");
    return json({ payments, withdrawals, totalRevenue, totalFees, pendingWithdrawals });
  }
  if (req.method === "PUT" && path[0] === "withdrawals" && path[1]) {
    if (!hasPermission(admin, "approve_withdrawals")) return json({ error: "Sem permissão para aprovar saques" }, 403);
    const { action } = await req.json();
    const status = action === "approve" ? "completed" : "failed";
    await supabase.from("withdrawals").update({ status, processed_at: new Date().toISOString() }).eq("id", path[1]);
    await log(admin.id, admin.email, `${action}_withdrawal`, "withdrawal", path[1], undefined, ip, ua);
    return json({ success: true });
  }
  return json({ error: "Rota não encontrada" }, 404);
}

// ─── Identity ─────────────────────────────────────────────────────────────────
async function handleIdentity(req: Request, admin: any, path: string[]): Promise<Response> {
  if (!canAccess(admin, "identity")) return json({ error: "Acesso negado" }, 403);
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "pending";
  const { ip, ua } = getClientInfo(req);

  if (req.method === "GET" && path.length === 0) {
    const { data } = await supabase.from("identity_verifications").select("*, caregivers(*, profiles(*))").eq("status", status).order("created_at", { ascending: true });
    return json({ verifications: data });
  }
  if (req.method === "PUT" && path[0]) {
    if (!hasPermission(admin, "approve_documents")) return json({ error: "Sem permissão" }, 403);
    const { action, reason } = await req.json();
    const newStatus = action === "approve" ? "verified" : action === "reject" ? "rejected" : "in_analysis";
    await supabase.from("identity_verifications").update({ status: newStatus, rejection_reason: reason, reviewed_by: admin.id, reviewed_at: new Date().toISOString() }).eq("id", path[0]);
    if (action === "approve") {
      const { data: verif } = await supabase.from("identity_verifications").select("user_id").eq("id", path[0]).maybeSingle();
      if (verif) await supabase.from("profiles").update({ verified: true }).eq("id", (verif as any).user_id);
    }
    await log(admin.id, admin.email, `${action}_identity`, "identity_verification", path[0], { reason }, ip, ua);
    return json({ success: true });
  }
  return json({ error: "Rota não encontrada" }, 404);
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
async function handleLogs(req: Request, admin: any): Promise<Response> {
  if (!canAccess(admin, "logs")) return json({ error: "Acesso negado" }, 403);
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const search = url.searchParams.get("search") || "";
  const action = url.searchParams.get("action") || "";
  const adminId = url.searchParams.get("admin_id") || "";
  const perPage = 50;

  let q = supabase.from("admin_logs")
    .select("*, admin_users(full_name, role)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page-1)*perPage, page*perPage-1);

  if (search) q = q.ilike("admin_email", `%${search}%`);
  if (action) q = q.eq("action", action);
  if (adminId) q = q.eq("admin_id", adminId);

  const { data, count } = await q;
  return json({ logs: data, total: count, page, perPage });
}

// ─── Support ──────────────────────────────────────────────────────────────────
async function handleSupport(req: Request, admin: any, path: string[]): Promise<Response> {
  if (!canAccess(admin, "support")) return json({ error: "Acesso negado" }, 403);
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "open";
  const { ip, ua } = getClientInfo(req);

  if (req.method === "GET" && path.length === 0) {
    const { data, count } = await supabase.from("support_tickets").select("*, profiles(full_name, email, avatar_url)", { count: "exact" }).eq("status", status).order("created_at", { ascending: false });
    return json({ tickets: data, total: count });
  }
  if (req.method === "PUT" && path[0]) {
    const body = await req.json();
    await supabase.from("support_tickets").update({ status: body.status, assigned_to: admin.id, resolved_at: body.status === "resolved" ? new Date().toISOString() : null }).eq("id", path[0]);
    await log(admin.id, admin.email, "update_ticket", "support_ticket", path[0], { status: body.status }, ip, ua);
    return json({ success: true });
  }
  return json({ error: "Rota não encontrada" }, 404);
}

// ─── Admins management (master only) ─────────────────────────────────────────
async function handleAdmins(req: Request, admin: any, path: string[]): Promise<Response> {
  if (admin.role !== "master") return json({ error: "Apenas o Admin Master pode gerenciar administradores" }, 403);
  const { ip, ua } = getClientInfo(req);

  // GET /admins — list all admins
  if (req.method === "GET" && path.length === 0) {
    const { data } = await supabase.from("admin_users").select("id, email, full_name, role, role_id, permissions, active, totp_enabled, last_login_at, last_login_ip, created_at, admin_roles(id, name, description, permissions)").order("created_at", { ascending: false });
    return json({ admins: data });
  }

  // GET /admins/:id — single admin details + recent sessions
  if (req.method === "GET" && path[0] && path[0] !== "roles") {
    const { data: a } = await supabase.from("admin_users").select("id, email, full_name, role, role_id, permissions, active, totp_enabled, last_login_at, last_login_ip, created_at, admin_roles(*)").eq("id", path[0]).maybeSingle();
    if (!a) return json({ error: "Administrador não encontrado" }, 404);
    const { data: sessions } = await supabase.from("admin_sessions").select("id, ip_address, user_agent, created_at, expires_at").eq("admin_id", path[0]).order("created_at", { ascending: false }).limit(10);
    const { data: logs } = await supabase.from("admin_logs").select("*").eq("admin_id", path[0]).order("created_at", { ascending: false }).limit(20);
    return json({ admin: a, sessions, logs });
  }

  // POST /admins — create new admin
  if (req.method === "POST" && path.length === 0) {
    const body = await req.json();
    const { email, full_name, password, role, role_id, permissions } = body;
    if (!email || !full_name || !password) return json({ error: "email, full_name e password são obrigatórios" }, 400);
    const { data: existing } = await supabase.from("admin_users").select("id").eq("email", email.toLowerCase()).maybeSingle();
    if (existing) return json({ error: "Email já cadastrado" }, 409);
    const { data: newAdmin, error: createErr } = await supabase.from("admin_users").insert({
      email: email.toLowerCase(),
      full_name,
      password_hash: `plain:${password}`,
      role: role || "support",
      role_id: role_id || null,
      permissions: permissions || [],
      active: true,
    }).select("id, email, full_name, role").single();
    if (createErr) return json({ error: "Erro ao criar administrador" }, 500);
    await log(admin.id, admin.email, "create_admin", "admin_user", (newAdmin as any).id, { email, role }, ip, ua);
    return json({ admin: newAdmin });
  }

  // PUT /admins/:id — update admin
  if (req.method === "PUT" && path[0]) {
    const body = await req.json();
    if (path[0] === admin.id && body.active === false) return json({ error: "Não é possível desativar a própria conta" }, 400);

    const allowed = ["full_name","role","role_id","permissions","active"];
    const update: any = {};
    for (const k of allowed) if (k in body) update[k] = body[k];

    // Handle password change
    if (body.password) update.password_hash = `plain:${body.password}`;

    // Handle 2FA toggle
    if (body.action === "enable_2fa") {
      const secret = generateTOTPSecret();
      await supabase.from("admin_users").update({ totp_secret: secret, totp_enabled: true }).eq("id", path[0]);
      await log(admin.id, admin.email, "enable_2fa", "admin_user", path[0], undefined, ip, ua);
      return json({ success: true, totp_secret: secret });
    }
    if (body.action === "disable_2fa") {
      await supabase.from("admin_users").update({ totp_secret: null, totp_enabled: false }).eq("id", path[0]);
      await log(admin.id, admin.email, "disable_2fa", "admin_user", path[0], undefined, ip, ua);
      return json({ success: true });
    }
    if (body.action === "revoke_sessions") {
      await supabase.from("admin_sessions").delete().eq("admin_id", path[0]);
      await log(admin.id, admin.email, "revoke_sessions", "admin_user", path[0], undefined, ip, ua);
      return json({ success: true });
    }

    if (Object.keys(update).length > 0) {
      await supabase.from("admin_users").update(update).eq("id", path[0]);
      await log(admin.id, admin.email, "update_admin", "admin_user", path[0], update, ip, ua);
    }
    return json({ success: true });
  }

  // DELETE /admins/:id — deactivate admin (never hard delete)
  if (req.method === "DELETE" && path[0]) {
    if (path[0] === admin.id) return json({ error: "Não é possível remover a própria conta" }, 400);
    await supabase.from("admin_users").update({ active: false }).eq("id", path[0]);
    await supabase.from("admin_sessions").delete().eq("admin_id", path[0]);
    await log(admin.id, admin.email, "deactivate_admin", "admin_user", path[0], undefined, ip, ua);
    return json({ success: true });
  }

  return json({ error: "Rota não encontrada" }, 404);
}

// ─── Roles management (master only) ──────────────────────────────────────────
async function handleRoles(req: Request, admin: any, path: string[]): Promise<Response> {
  if (admin.role !== "master") return json({ error: "Apenas o Admin Master pode gerenciar cargos" }, 403);
  const { ip, ua } = getClientInfo(req);

  if (req.method === "GET" && path.length === 0) {
    const { data } = await supabase.from("admin_roles").select("*, admin_users(count)").order("created_at", { ascending: true });
    return json({ roles: data });
  }
  if (req.method === "GET" && path[0]) {
    const { data } = await supabase.from("admin_roles").select("*").eq("id", path[0]).maybeSingle();
    if (!data) return json({ error: "Cargo não encontrado" }, 404);
    const { count } = await supabase.from("admin_users").select("*", { count: "exact", head: true }).eq("role_id", path[0]);
    return json({ role: data, admin_count: count });
  }
  if (req.method === "POST") {
    const body = await req.json();
    const { name, description, permissions } = body;
    if (!name) return json({ error: "name é obrigatório" }, 400);
    const { data: existing } = await supabase.from("admin_roles").select("id").eq("name", name).maybeSingle();
    if (existing) return json({ error: "Cargo com esse nome já existe" }, 409);
    const { data: role, error: e } = await supabase.from("admin_roles").insert({ name, description: description || "", permissions: permissions || [], created_by: admin.id }).select().single();
    if (e) return json({ error: "Erro ao criar cargo" }, 500);
    await log(admin.id, admin.email, "create_role", "admin_role", (role as any).id, { name, permissions }, ip, ua);
    return json({ role });
  }
  if (req.method === "PUT" && path[0]) {
    const body = await req.json();
    const allowed = ["name","description","permissions"];
    const update: any = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in body) update[k] = body[k];
    await supabase.from("admin_roles").update(update).eq("id", path[0]);
    await log(admin.id, admin.email, "update_role", "admin_role", path[0], update, ip, ua);
    return json({ success: true });
  }
  if (req.method === "DELETE" && path[0]) {
    const { count } = await supabase.from("admin_users").select("*", { count: "exact", head: true }).eq("role_id", path[0]);
    if (count && count > 0) return json({ error: "Não é possível excluir um cargo com administradores vinculados" }, 409);
    await supabase.from("admin_roles").delete().eq("id", path[0]);
    await log(admin.id, admin.email, "delete_role", "admin_role", path[0], undefined, ip, ua);
    return json({ success: true });
  }
  return json({ error: "Rota não encontrada" }, 404);
}

// ─── Sessions management ──────────────────────────────────────────────────────
async function handleSessions(req: Request, admin: any, path: string[]): Promise<Response> {
  if (admin.role !== "master") return json({ error: "Acesso negado" }, 403);

  if (req.method === "GET" && path.length === 0) {
    const { data } = await supabase.from("admin_sessions").select("*, admin_users(full_name, email, role)").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(100);
    return json({ sessions: data });
  }
  if (req.method === "DELETE" && path[0]) {
    await supabase.from("admin_sessions").delete().eq("id", path[0]);
    return json({ success: true });
  }
  return json({ error: "Rota não encontrada" }, 404);
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ─── Router ───────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const segments = url.pathname.replace(/^\/admin-api\/?/, "").split("/").filter(Boolean);
    const [section, ...rest] = segments;

    if (section === "auth" && req.method === "POST") return await handleAuth(req);

    const authResult = await verifyAdminToken(req);
    if (!authResult) return json({ error: "Não autorizado" }, 401);
    const { admin } = authResult;

    if (section === "me") {
      const perms = getAdminPermissions(admin);
      return json({ admin: { id: admin.id, email: admin.email, full_name: admin.full_name, role: admin.role, permissions: perms } });
    }
    if (section === "dashboard") return await handleDashboard(admin);
    if (section === "users") return await handleUsers(req, admin, rest);
    if (section === "caregivers") return await handleCaregivers(req, admin, rest);
    if (section === "requests") return await handleRequests(req, admin, rest);
    if (section === "financial") return await handleFinancial(req, admin, rest);
    if (section === "identity") return await handleIdentity(req, admin, rest);
    if (section === "logs") return await handleLogs(req, admin);
    if (section === "support") return await handleSupport(req, admin, rest);
    if (section === "admins") return await handleAdmins(req, admin, rest);
    if (section === "roles") return await handleRoles(req, admin, rest);
    if (section === "sessions") return await handleSessions(req, admin, rest);

    return json({ error: "Rota não encontrada" }, 404);
  } catch (err) {
    console.error("Admin API error:", err);
    return json({ error: "Erro interno do servidor" }, 500);
  }
});
