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

export const brandHeader = `
  <div style="background:#002155;padding:16px 24px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;font-size:20px;letter-spacing:2px;">TCET CENTRE OF EXCELLENCE</h1>
    <div style="height:4px;background:#F7941D;margin-top:8px;"></div>
  </div>
`;

export const brandFooter = `
  <div style="background:#f5f4f0;padding:16px 24px;text-align:center;font-size:11px;color:#747782;font-family:Arial,sans-serif;">
    <p style="margin:0;">Thakur College of Engineering &amp; Technology, Kandivali (E), Mumbai - 400101</p>
    <p style="margin:4px 0 0;">&copy; 2026 TCET Centre of Excellence. All Rights Reserved.</p>
  </div>
`;

export function wrapEmailBody(innerHtml: string): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#faf9f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:24px auto;border:1px solid #c4c6d3;overflow:hidden;">
    ${brandHeader}
    <div style="padding:24px;background:#ffffff;">${innerHtml}</div>
    ${brandFooter}
  </div>
</body></html>`;
}

export async function sendRegistrationEmail(userEmail: string, userName: string) {
  return sendEmail({
    to: userEmail,
    subject: "Welcome to Academic Project Dashboard",
    html: wrapEmailBody(`
      <h2 style="color:#002155;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;">Registration Successful</h2>
      <p style="color:#434651;font-size:14px;margin:0 0 4px;">Dear <strong>${userName}</strong>,</p>
      <p style="color:#434651;font-size:14px;margin:12px 0;">Your account has been created successfully. You can now sign in and start using the Academic Project Dashboard.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/student/projects" style="background:#002155;color:#ffffff;padding:12px 32px;text-decoration:none;font-weight:bold;font-size:14px;letter-spacing:1px;display:inline-block;">GO TO DASHBOARD</a>
      </div>
      <p style="color:#747782;font-size:12px;margin:0;">If you did not register for this account, please contact your administrator.</p>
    `),
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
    html: wrapEmailBody(`
      <h2 style="color:#002155;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;">Review Scheduled</h2>
      <p style="color:#434651;font-size:14px;margin:0 0 4px;">A <strong>${reviewType.replace("_", " ")}</strong> review has been scheduled for your project:</p>
      <div style="background:#f5f4f0;border-left:4px solid #F7941D;padding:16px;margin:16px 0;">
        <p style="margin:0 0 6px;color:#002155;"><strong>Project:</strong> ${projectTitle}</p>
        <p style="margin:0;color:#434651;"><strong>Date:</strong> ${reviewDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>
      <p style="color:#434651;font-size:14px;margin:0;">Please ensure your work is up to date before the review.</p>
    `),
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
    html: wrapEmailBody(`
      <h2 style="color:#002155;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;">Review Feedback Received</h2>
      <p style="color:#434651;font-size:14px;margin:0 0 4px;">Your project has received a review:</p>
      <div style="background:#f5f4f0;border-left:4px solid #F7941D;padding:16px;margin:16px 0;">
        <p style="margin:0 0 6px;color:#002155;"><strong>Project:</strong> ${projectTitle}</p>
        <p style="margin:0 0 6px;color:#434651;"><strong>Score:</strong> ${score}/10</p>
        <p style="margin:0;color:#434651;"><strong>Feedback:</strong> ${feedback}</p>
      </div>
      <p style="color:#434651;font-size:14px;margin:0;">Log in to your dashboard to view the complete review details.</p>
    `),
  });
}
