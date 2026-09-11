// src/modules/sponsorship/welcomeEmailTemplate.ts
//
// The browser's view of the welcome email renderer.
//
// The renderer lives beside the send-welcome edge function, the one place Deno
// will bundle it from, and the preview dialog reaches across to the same file,
// so the email an admin reads before sending is the email that sends.

export {
  escapeHtml,
  renderWelcomeEmail,
  renderWelcomeEmailText,
  welcomeSubject,
} from "../../../supabase/functions/send-welcome/template";

export type { WelcomeEmailData, WelcomeLanguage } from "../../../supabase/functions/send-welcome/template";
