import nodemailer from "nodemailer";

const isGmail =
  process.env.SMTP_PROVIDER?.toLowerCase() === "gmail" ||
  process.env.SMTP_HOST === "smtp.gmail.com";

function getTrimmedEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

const smtpUser = getTrimmedEnv("SMTP_USER");
const googleClientId = getTrimmedEnv("GOOGLE_CLIENT_ID");
const googleClientSecret = getTrimmedEnv("GOOGLE_CLIENT_SECRET");
const googleRefreshToken = getTrimmedEnv("GOOGLE_REFRESH_TOKEN");

const hasGmailOAuth2 = Boolean(
  isGmail && smtpUser && googleClientId && googleClientSecret && googleRefreshToken,
);

const auth = {
  type: "OAuth2" as const,
  user: smtpUser,
  clientId: googleClientId,
  clientSecret: googleClientSecret,
  refreshToken: googleRefreshToken,
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || (isGmail ? "465" : "587")),
  secure: (process.env.SMTP_SECURE === "true") || (isGmail && process.env.SMTP_PORT !== "587"),
  auth,
});

function getFromHeader(): string {
  const configuredFrom = process.env.SMTP_FROM?.trim();
  if (configuredFrom) {
    return configuredFrom;
  }

  const smtpUser = process.env.SMTP_USER?.trim();
  const fromName = process.env.SMTP_FROM_NAME?.trim();

  if (smtpUser && fromName) {
    return `${fromName} <${smtpUser}>`;
  }

  return smtpUser || "noreply@dashboard.local";
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  requireConfigured?: boolean;
}): Promise<{ messageId: string | null }> {
  if (!process.env.SMTP_HOST) {
    if (options.requireConfigured) {
      throw new Error("SMTP is not configured. Please set SMTP_HOST and SMTP_USER.");
    }
    console.log("[Email] SMTP not configured, skipping:", options.subject);
    return { messageId: null };
  }

  if (options.requireConfigured) {
    if (!smtpUser) {
      throw new Error("SMTP is not configured. Please set SMTP_USER.");
    }

    if (!isGmail) {
      throw new Error(
        "Email transport must use Gmail SMTP. Set SMTP_PROVIDER=gmail and SMTP_HOST=smtp.gmail.com.",
      );
    }

    if (!hasGmailOAuth2) {
      throw new Error(
        "Gmail OAuth2 is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.",
      );
    }
  }

  try {
    const info = await transporter.sendMail({
      from: getFromHeader(),
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return { messageId: info.messageId || null };
  } catch (error: any) {
    const message = error?.message || "Unknown SMTP error";
    throw new Error(`Failed to send email: ${message}`);
  }
}

export async function sendRegistrationEmail(userEmail: string, userName: string) {
  return sendEmail({
    to: userEmail,
    subject: "Welcome to Academic Project Dashboard",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
        <h2 style="color: #4f46e5; margin-bottom: 12px;">Registration successful</h2>
        <p style="margin: 0 0 12px;">Hi ${userName},</p>
        <p style="margin: 0 0 12px;">Your account has been created successfully. You can now sign in and start using the dashboard.</p>
        <p style="margin: 0; color: #6b7280; font-size: 13px;">If you did not register for this account, please contact your administrator.</p>
      </div>
    `,
  });
}

export async function sendReviewScheduledEmail(
  studentEmail: string,
  projectTitle: string,
  reviewDate: Date,
  reviewType: string
) {
  return sendEmail({
    to: studentEmail,
    subject: `Review Scheduled: ${projectTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Review Scheduled</h2>
        <p>A <strong>${reviewType.replace("_", " ")}</strong> review has been scheduled for your project:</p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Project:</strong> ${projectTitle}</p>
          <p style="margin: 8px 0 0;"><strong>Date:</strong> ${reviewDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <p>Please ensure your work is up to date before the review.</p>
      </div>
    `,
  });
}

export async function sendFeedbackEmail(
  studentEmail: string,
  projectTitle: string,
  score: number,
  feedback: string
) {
  return sendEmail({
    to: studentEmail,
    subject: `Review Feedback: ${projectTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Review Feedback Received</h2>
        <p>Your project has received a review:</p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Project:</strong> ${projectTitle}</p>
          <p style="margin: 8px 0 0;"><strong>Score:</strong> ${score}/10</p>
          <p style="margin: 8px 0 0;"><strong>Feedback:</strong> ${feedback}</p>
        </div>
        <p>Log in to your dashboard to view the complete review details.</p>
      </div>
    `,
  });
}
