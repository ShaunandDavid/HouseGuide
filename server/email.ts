import { MailService } from '@sendgrid/mail';

// Allow development without SendGrid
let mailService: MailService | null = null;

if (process.env.SENDGRID_API_KEY) {
  mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
} else if (process.env.NODE_ENV === 'production') {
  throw new Error("SENDGRID_API_KEY environment variable must be set in production");
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    if (!mailService) {
      console.log('DEV: Email would be sent (SendGrid not configured):', params.subject);
      return true; // Simulate success in development
    }
    
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return true;
  } catch (error: any) {
    console.error('SendGrid email error:', error);
    if (error.response?.body?.errors) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body.errors, null, 2));
    }
    return false;
  }
}

export function generateVerificationEmail(email: string, token: string, houseName: string, baseUrl: string) {
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
  
  // Using a verified sender email - you'll need to update this with your verified SendGrid sender
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com';
  
  return {
    to: email,
    from: fromEmail,
    subject: `Verify your email for ${houseName} - HouseGuide`,
    text: `Welcome to HouseGuide! Please verify your email address by clicking this link: ${verifyUrl}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
            .header { background: #1976D2; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .button { display: inline-block; background: #1976D2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to HouseGuide</h1>
            </div>
            <div class="content">
              <h2>Verify Your Email Address</h2>
              <p>Thank you for registering your facility "${houseName}" with HouseGuide!</p>
              <p>To complete your registration and start managing your residents, please verify your email address:</p>
              <a href="${verifyUrl}" class="button">Verify Email Address</a>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
              <p>This link will expire in 24 hours for security reasons.</p>
            </div>
            <div class="footer">
              <p>HouseGuide - Residential Care Management</p>
              <p>If you didn't create this account, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
      </html>
    `
  };
}