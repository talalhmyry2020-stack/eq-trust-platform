import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// بيانات وهمية لمحاكاة ردود المصانع
const FAKE_FACTORY_RESPONSES = [
  {
    factory_name: "Guangzhou Sunrise Electronics Co., Ltd",
    factory_email: "sales@sunriseelec.com",
    factory_phone: "+86-20-8876-5432",
    factory_country: "الصين",
    response_template: "نشكركم على اهتمامكم بمنتجاتنا. نحن مصنع متخصص منذ 15 عاماً. نرفق لكم عرض السعر المطلوب مع المواصفات الكاملة.",
    price_range: [500, 5000],
    specs: { "الضمان": "سنتان", "الشحن": "FOB شنتشن", "الحد الأدنى للطلب": "100 وحدة", "وقت التسليم": "15-20 يوم عمل" },
  },
  {
    factory_name: "Shenzhen Golden Star Manufacturing",
    factory_email: "export@goldenstar-sz.com",
    factory_phone: "+86-755-2345-6789",
    factory_country: "الصين",
    response_template: "مرحباً، تلقينا طلبكم وسنقدم لكم أفضل عرض. منتجاتنا حاصلة على شهادات CE و ISO 9001.",
    price_range: [300, 4500],
    specs: { "الضمان": "سنة واحدة", "الشحن": "CIF", "الحد الأدنى للطلب": "50 وحدة", "وقت التسليم": "10-15 يوم عمل", "الشهادات": "CE, ISO 9001" },
  },
  {
    factory_name: "Yiwu Happy Trading Co.",
    factory_email: "info@happytrading-yw.com",
    factory_phone: "+86-579-8523-1470",
    factory_country: "الصين",
    response_template: "شكراً لتواصلكم. نحن شركة تجارة خارجية مع شبكة واسعة من المصانع. يمكننا توفير أفضل الأسعار.",
    price_range: [200, 3000],
    specs: { "الضمان": "6 أشهر", "الشحن": "EXW يوو", "الحد الأدنى للطلب": "200 وحدة", "وقت التسليم": "7-12 يوم عمل" },
  },
  {
    factory_name: "Istanbul Quality Exports Ltd.",
    factory_email: "sales@iqexports.com.tr",
    factory_phone: "+90-212-555-7890",
    factory_country: "تركيا",
    response_template: "نرحب بطلبكم. نحن مصنع تركي ذو جودة أوروبية وأسعار تنافسية. مرفق العرض الرسمي.",
    price_range: [800, 8000],
    specs: { "الضمان": "3 سنوات", "الشحن": "FOB إسطنبول", "الحد الأدنى للطلب": "30 وحدة", "وقت التسليم": "20-25 يوم عمل", "الجودة": "معايير أوروبية" },
  },
  {
    factory_name: "Mumbai Industrial Solutions Pvt.",
    factory_email: "exports@mumbaiindustrial.in",
    factory_phone: "+91-22-4567-8901",
    factory_country: "الهند",
    response_template: "نقدر اهتمامكم بمنتجاتنا الهندية عالية الجودة. نقدم أسعاراً تنافسية مع إمكانية التخصيص.",
    price_range: [150, 2500],
    specs: { "الضمان": "سنة واحدة", "الشحن": "FOB مومباي", "الحد الأدنى للطلب": "150 وحدة", "وقت التسليم": "18-25 يوم عمل" },
  },
];

// توليد صورة منتج واقعية بالذكاء الاصطناعي
async function generateProductImage(productName: string, supabase: any): Promise<string> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) {
    console.log("[Negotiation Agent] No LOVABLE_API_KEY, skipping image generation");
    return "";
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: `Generate a professional product photo of "${productName}" on a clean white background, commercial product photography style, high quality, realistic. Ultra high resolution.`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.error("[Negotiation Agent] Image generation failed:", response.status);
      return "";
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl || !imageUrl.startsWith("data:image")) return "";

    // تحويل base64 إلى blob ورفعها
    const base64Data = imageUrl.split(",")[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const filePath = `ai-products/${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
    const { error } = await supabase.storage.from("deal-documents").upload(filePath, bytes, {
      contentType: "image/png",
      upsert: false,
    });

    if (error) {
      console.error("[Negotiation Agent] Upload error:", error);
      return "";
    }

    const { data: urlData } = supabase.storage.from("deal-documents").getPublicUrl(filePath);
    console.log("[Negotiation Agent] ✅ AI product image generated");
    return urlData.publicUrl || "";
  } catch (err) {
    console.error("[Negotiation Agent] Image generation error:", err);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { deal_id } = await req.json();
    if (!deal_id) throw new Error("deal_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // جلب بيانات الصفقة
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) throw new Error("Deal not found");

    console.log(`[Negotiation Agent] Processing deal #${deal.deal_number}`);

    // تحديث المرحلة إلى "جاري التفاوض"
    await supabase.from("deals").update({ current_phase: "negotiating" }).eq("id", deal_id);

    // اختيار 3-4 مصانع عشوائية للتفاوض
    const shuffled = [...FAKE_FACTORY_RESPONSES].sort(() => Math.random() - 0.5);
    const selectedFactories = shuffled.slice(0, 3 + Math.floor(Math.random() * 2));

    const productName = deal.product_type || deal.title || "منتج";
    const companyIntro = `نحن شركة وساطة تجارية دولية متخصصة في الاستيراد. نبحث عن مورد موثوق لمنتج "${productName}" بكميات تجارية. نرجو إرسال عرض سعر رسمي يتضمن: السعر لكل وحدة، الحد الأدنى للطلب، مواصفات المنتج، وصورة حديثة للمنتج.`;

    // توليد صورة واقعية للمنتج بالذكاء الاصطناعي
    console.log(`[Negotiation Agent] Generating AI product image for: ${productName}`);
    const aiProductImage = await generateProductImage(productName, supabase);

    const negotiations = [];

    // محاكاة إرسال الرسائل واستلام الردود
    for (let i = 0; i < selectedFactories.length; i++) {
      const factory = selectedFactories[i];
      const price = factory.price_range[0] + Math.floor(Math.random() * (factory.price_range[1] - factory.price_range[0]));

      // بعض المصانع ترد سريعاً وبعضها بطيئاً (محاكاة)
      const responded = Math.random() > 0.15; // 85% يردون

      const negotiation = {
        deal_id,
        factory_name: factory.factory_name,
        factory_email: factory.factory_email,
        factory_phone: factory.factory_phone,
        factory_country: factory.factory_country,
        product_name: productName,
        message_sent: companyIntro,
        factory_response: responded ? factory.response_template : null,
        offered_price: responded ? price : null,
        currency: "USD",
        product_image_url: responded ? aiProductImage : null,
        specifications: responded ? factory.specs : {},
        status: responded ? "responded" : "pending",
        response_date: responded ? new Date().toISOString() : null,
      };

      negotiations.push(negotiation);
    }

    // إدراج نتائج التفاوض
    const { error: insertError } = await supabase
      .from("deal_negotiations")
      .insert(negotiations);

    if (insertError) {
      console.error("[Negotiation Agent] Insert error:", insertError);
      throw new Error("Failed to save negotiations: " + insertError.message);
    }

    // تحديث مرحلة الصفقة
    await supabase.from("deals").update({ current_phase: "negotiation_complete" }).eq("id", deal_id);

    // إرسال إشعارات للمدير عن كل رد مصنع
    const adminContacts = await supabase.rpc("get_admin_contacts");
    const admins = adminContacts.data || [];

    for (const neg of negotiations) {
      if (neg.status === "responded") {
        for (const admin of admins) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: `رد من ${neg.factory_name}`,
            message: `رد المصنع ${neg.factory_name} على صفقة #${deal.deal_number} بعرض سعر ${neg.offered_price} ${neg.currency} للمنتج "${productName}"`,
            type: "negotiation_response",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }
      }
    }

    // إشعار العميل
    if (deal.client_id) {
      await supabase.from("notifications").insert({
        user_id: deal.client_id,
        title: "نتائج التفاوض جاهزة",
        message: `تم استلام ${negotiations.filter(n => n.status === "responded").length} رد(ود) من المصانع لصفقتك #${deal.deal_number}`,
        type: "negotiation_complete",
        entity_type: "deal",
        entity_id: deal_id,
      });
    }

    console.log(`[Negotiation Agent] Completed deal #${deal.deal_number}: ${negotiations.length} negotiations, ${negotiations.filter(n => n.status === "responded").length} responded`);

    return new Response(JSON.stringify({
      success: true,
      deal_number: deal.deal_number,
      total: negotiations.length,
      responded: negotiations.filter(n => n.status === "responded").length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Negotiation Agent] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
