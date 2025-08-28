import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
};

interface SlackNotificationRequest {
  eventType: string;
  data: any;
}

interface SlackMessage {
  text: string;
  blocks?: any[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
    if (!slackWebhookUrl) {
      console.error("SLACK_WEBHOOK_URL environment variable is missing");
      return new Response(
        JSON.stringify({ error: "Missing SLACK_WEBHOOK_URL configuration" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const { eventType, data }: SlackNotificationRequest = await req.json();
    console.log(`Processing Slack notification for event: ${eventType}`, data);

    let slackMessage: SlackMessage;

    switch (eventType) {
      case "user_added":
        slackMessage = {
          text: `🎉 New hire added: ${data.full_name || data.first_name + ' ' + data.last_name || 'Unknown'} (${data.email}) has been invited to claim their Alteryx welcome kit`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `🎉 *New hire added*\n*Name:* ${data.full_name || data.first_name + ' ' + data.last_name || 'Unknown'}\n*Email:* ${data.email}\n*Added:* ${new Date(data.created_at).toLocaleString()}`
              }
            }
          ]
        };
        break;

      case "order_placed":
        slackMessage = {
          text: `📦 Order placed: ${data.user_name} ordered a ${data.tee_size || 'Unknown'} t-shirt (Order #${data.order_number || data.order_id})`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `📦 *Order placed*\n*Customer:* ${data.user_name}\n*Email:* ${data.user_email}\n*Size:* ${data.tee_size || 'Unknown'}\n*Order #:* ${data.order_number || data.order_id}\n*Date:* ${new Date(data.date_submitted).toLocaleString()}`
              }
            }
          ]
        };
        break;

      case "login_error":
        const errorDetails = data.metadata ? JSON.stringify(data.metadata, null, 2) : 'No additional details';
        slackMessage = {
          text: `🚨 Login error: ${data.event_type} for ${data.user_email || 'Unknown user'} - ${data.severity}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `🚨 *Login Error Alert*\n*Error Type:* ${data.event_type}\n*User:* ${data.user_email || 'Unknown'}\n*Severity:* ${data.severity}\n*IP Address:* ${data.ip_address || 'Unknown'}\n*Time:* ${new Date(data.created_at).toLocaleString()}`
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Details:*\n\`\`\`${errorDetails}\`\`\``
              }
            }
          ]
        };
        break;

      case "order_shipped":
        slackMessage = {
          text: `🚛 Order shipped: ${data.user_name}'s order #${data.order_number || data.order_id} has been shipped with tracking ${data.tracking_number}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `🚛 *Order shipped*\n*Customer:* ${data.user_name}\n*Email:* ${data.user_email}\n*Order #:* ${data.order_number || data.order_id}\n*Size:* ${data.tee_size || 'Unknown'}\n*Tracking #:* ${data.tracking_number}\n*Carrier:* ${data.shipping_carrier || 'Unknown'}`
              }
            }
          ]
        };
        break;

      default:
        console.log(`Unknown event type: ${eventType}`);
        return new Response(
          JSON.stringify({ error: `Unknown event type: ${eventType}` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
    }

    // Send message to Slack
    console.log("Sending message to Slack:", slackMessage);
    
    const slackResponse = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackMessage),
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      console.error("Slack API error:", slackResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send Slack notification",
          details: errorText 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log("Slack notification sent successfully");
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Slack notification sent successfully",
        eventType,
        sentAt: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("Error in send-slack-notification function:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
};

serve(handler);