import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const uuid = z.string().uuid();
const Slot = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_of_day: z.enum(["morning","afternoon","evening"]),
});
const submitSchema = z.object({
  accessToken: z.string().min(20).max(12000),
  storefrontId: uuid,
  providerId: uuid.nullable(),
  treatmentSlug: z.string().trim().min(1).max(120),
  slots: z.array(Slot).min(1).max(3),
  note: z.string().max(600),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(250),
  phone: z.string().trim().min(7).max(30),
  flexibility: z.enum(["very","somewhat","these times only"]),
  isFirstTime: z.boolean().nullable(),
  consentToContact: z.literal(true),
});
const queueSchema = z.object({
  accessToken: z.string().min(20).max(12000),
  scope: z.enum(["admin","clinic"]),
});
type Clinic = { storefront_id: string; status: string; billing_status: string; verified_at: string | null; owner_user_id: string | null; notification_email: string | null };

function activeClinic(c: Clinic | null): c is Clinic {
  return !!c && c.status === "active" && !!c.verified_at && !!c.owner_user_id && !!c.notification_email &&
    (c.billing_status === "active" || c.billing_status === "trialing");
}
async function auth(token: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("sign in to your TreatMe account again.");
  return { db, user: data.user };
}
function slotToLegacyIso(slot: z.infer<typeof Slot>): string {
  const hour = { morning: 9, afternoon: 14, evening: 18 }[slot.time_of_day];
  // These legacy fields are preferences only; exact local times are stored in requested_slots.
  return new Date(`${slot.date}T${String(hour).padStart(2,"0")}:00:00Z`).toISOString();
}
async function notify(id: string, clinicName: string, audience: "admin" | "clinic", recipient: string | null) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from || !recipient) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [recipient],
        subject: `New TreatMe consultation request for ${clinicName}`,
        text: `A new unconfirmed consultation request is available.\n\nClinic: ${clinicName}\nRequest ID: ${id}\n\nSign in to https://treatmeapp.com/${audience}/requests\n\nNo patient contact information, clinical notes, or scan data is included in this email.`,
      }),
    });
    return res.ok;
  } catch { return false; }
}
export const createSecureConsultationRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    const { db, user } = await auth(data.accessToken);
    const { data: storefront, error: storeError } = await db.from("storefronts")
      .select("id,name").eq("id",data.storefrontId).maybeSingle();
    if (storeError || !storefront) throw new Error("clinic not found.");

    const { count, error: rateError } = await db.from("booking_requests")
      .select("id",{ count: "exact", head: true }).eq("user_id",user.id)
      .gte("created_at",new Date(Date.now()-3600000).toISOString());
    if (rateError) throw new Error("unable to check request limits.");
    if ((count ?? 0)>=5) throw new Error("you've sent too many requests this hour.");

    const { data: account, error: clinicError } = await db.from("clinic_accounts")
      .select("storefront_id,status,billing_status,verified_at,owner_user_id,notification_email")
      .eq("storefront_id",storefront.id).maybeSingle();
    if (clinicError) throw new Error("clinic request routing is unavailable.");
    const partner = activeClinic(account);
    const target = partner ? "clinic" : "admin";
    const times = data.slots.map(slotToLegacyIso);
    const { data: saved, error: saveError } = await db.from("booking_requests")
      .insert({
        user_id:user.id,provider_id:data.providerId,storefront_id:storefront.id,
        treatment_slug:data.treatmentSlug,full_name:data.name,email:data.email,phone:data.phone,
        preferred_1:times[0]??null,preferred_2:times[1]??null,preferred_3:times[2]??null,
        requested_slots:data.slots,flexibility:data.flexibility,is_first_time:data.isFirstTime,
        notes:data.note.trim()||null,status:"new",routing_target:target,
        contact_consent_at:new Date().toISOString(),contact_consent_version:"2026-11-v1",
        notification_status:"pending",
      } as never).select("id").single();
    if (saveError || !saved) throw new Error("unable to save the request.");

    const recipient = partner ? account.notification_email : (process.env.TREATME_BOOKINGS_INBOX ?? null);
    const sent = await notify(saved.id,storefront.name,target,recipient);
    const {error:updateError} = await db.from("booking_requests")
      .update({notification_status:sent?"sent":"failed",notification_attempted_at:new Date().toISOString()} as never)
      .eq("id",saved.id);
    if(updateError)console.error("notification status update failed",saved.id);
    return {id:saved.id,notified:sent};
  });

async function queueAuth(token:string,scope:"admin"|"clinic"){
  const {db,user}=await auth(token);
  if(scope==="admin"){
    const {data:admin,error}=await db.from("treatme_admins").select("user_id").eq("user_id",user.id).maybeSingle();
    if(error||!admin)throw new Error("you do not have TreatMe admin access.");
    return {db,ids:[] as string[]};
  }
  const {data:accounts,error}=await db.from("clinic_accounts")
    .select("storefront_id,status,billing_status,verified_at,owner_user_id,notification_email")
    .eq("owner_user_id",user.id);
  if(error)throw new Error("couldn't verify clinic access.");
  const ids=(accounts??[]).filter(activeClinic).map(c=>c.storefront_id);
  if(!ids.length)throw new Error("no active verified clinic is linked to this account.");
  return {db,ids};
}
export const getConsultationQueue = createServerFn({method:"POST"})
  .inputValidator((input:unknown)=>queueSchema.parse(input))
  .handler(async ({data})=>{
    const {db,ids}=await queueAuth(data.accessToken,data.scope);
    let q=db.from("booking_requests")
      .select("id,created_at,storefront_id,full_name,email,phone,treatment_slug,notes,requested_slots,status,notification_status,routing_target")
      .eq("routing_target",data.scope).order("created_at",{ascending:false}).limit(100);
    if(data.scope==="clinic")q=q.in("storefront_id",ids);
    const {data:rows,error}=await q;
    if(error)throw new Error("unable to load consultation requests.");
    const storeIds=[...new Set((rows??[]).map(r=>r.storefront_id).filter((v):v is string=>!!v))];
    const {data:stores}=storeIds.length?await db.from("storefronts").select("id,name").in("id",storeIds)
      :{data:[] as {id:string;name:string}[]};
    const names=new Map((stores??[]).map(s=>[s.id,s.name]));
    return (rows??[]).map(row=>({...row,clinic_name:names.get(row.storefront_id??"")??"clinic"}));
  });
export const updateConsultationStatus=createServerFn({method:"POST"})
  .inputValidator((input:unknown)=>queueSchema.extend({id:uuid,status:z.enum(["contacting","pending","declined"])}).parse(input))
  .handler(async ({data})=>{
    const {db,ids}=await queueAuth(data.accessToken,data.scope);
    let q=db.from("booking_requests").update({status:data.status,updated_at:new Date().toISOString()})
      .eq("id",data.id).eq("routing_target",data.scope);
    if(data.scope==="clinic")q=q.in("storefront_id",ids);
    const {data:row,error}=await q.select("id").maybeSingle();
    if(error||!row)throw new Error("request not found or access denied.");
    return {updated:true};
  });
export const getBrandedClinic=createServerFn({method:"GET"})
  .inputValidator((input:unknown)=>z.object({slug:z.string().trim().min(1).max(200)}).parse(input))
  .handler(async ({data})=>{
    const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
    const {data:store}=await db.from("storefronts").select("id,slug,name,city,logo_url,brand_accent")
      .eq("slug",data.slug).maybeSingle();
    if(!store)return null;
    const {data:account}=await db.from("clinic_accounts")
      .select("storefront_id,status,billing_status,verified_at,owner_user_id,notification_email")
      .eq("storefront_id",store.id).maybeSingle();
    return activeClinic(account)?store:null;
  });
