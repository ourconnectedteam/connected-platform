import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { type, payload } = await req.json();

        if (!RESEND_API_KEY) {
            throw new Error("Missing RESEND_API_KEY");
        }

        let subject = "Notification from Connected";
        let html = "<p>Notification</p>";
        const to = payload.email; // Recipient

        // Templates
        if (type === "booking_confirmation") {
            subject = "Booking Confirmed! 🎉";
            html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #007AFF;">Booking Confirmed!</h2>
            <p>Hi ${payload.studentName},</p>
            <p>Your session with <strong>${payload.providerName}</strong> has been successfully scheduled.</p>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Date:</strong> ${payload.date}</p>
                <p><strong>Time:</strong> ${payload.time}</p>
                <p><strong>Link:</strong> <a href="${payload.link}">Join Meeting</a></p>
            </div>
            <p>See you there!</p>
            <p>The Connected Team</p>
        </div>
      `;
        } else if (type === "welcome") {
            subject = "Welcome to Connected!";
            html = `<p>Welcome ${payload.name}, we are glad to have you!</p>`;
        }

        // Call Resend API
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Connected <onboarding@resend.dev>", // Change this to your verify domain later
                to: [to],
                subject: subject,
                html: html,
            }),
        });

        const data = await res.json();

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
