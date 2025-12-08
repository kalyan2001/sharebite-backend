import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
dotenv.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendEmail = async (to, subject, html) => {
  try {
    const msg = {
      to,
      from: process.env.FROM_EMAIL,
      subject,
      html,
    };
    await sgMail.send(msg);
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error("❌ SendGrid email error:", err.response?.body || err.message);
  }
};
