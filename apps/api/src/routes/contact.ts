import type { FastifyInstance } from 'fastify';
import { contactSchema } from '@ai/types';
import { Resend } from 'resend';

// Strip characters that could inject headers into the email subject line.
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n\t]/g, ' ').trim();
}

export default async function contactRoutes(app: FastifyInstance) {
  // Instantiated once at plugin registration, not per request.
  const resend = app.config.RESEND_API_KEY ? new Resend(app.config.RESEND_API_KEY) : null;

  app.post(
    '/contact',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '10 minutes',
        },
      },
    },
    async (request, reply) => {
      const parsed = contactSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ message: 'Invalid request. Please check your input.' });
      }

      const { name, email, message, consent, _honey } = parsed.data;

      // Should never reach here without consent=true due to schema, but
      // guard explicitly so no future schema relaxation silently bypasses this.
      if (!consent) {
        return reply.status(400).send({ message: 'Invalid request. Please check your input.' });
      }

      // Honeypot: bot filled the hidden field — silently accept, with the
      // same response shape as a real success, to avoid leaking that the
      // field is being checked.
      if (_honey !== '') {
        return reply.status(200).send({ message: 'Message received.', delivered: true });
      }

      // Email sending disabled or no Resend key — log the event without the
      // submitter's name/email (PII) and return success, but say so
      // honestly: without `delivered: false` a visitor (e.g. a recruiter)
      // has no way to tell their message was never actually sent anywhere.
      if (!resend || !app.config.ENABLE_EMAIL_SENDING) {
        app.log.info({ msg: 'Contact form submission (email sending disabled)' });
        return reply.status(200).send({ message: 'Message received.', delivered: false });
      }

      // Sanitize name before embedding in the Subject header as defense-in-depth
      // against header injection even though Resend likely escapes this already.
      const safeName = sanitizeHeader(name);
      const subject  = `Portfolio contact: ${safeName}`;

      const text = [`From: ${name} <${email}>`, '', message].join('\n');

      const { error } = await resend.emails.send({
        from:    app.config.MAIL_FROM,
        to:      app.config.MAIL_TO,
        replyTo: email,
        subject,
        text,
      });

      if (error) {
        app.log.error({ msg: 'Resend send error', code: error.name });
        return reply
          .status(500)
          .send({ message: 'Failed to send your message. Please try again later.' });
      }

      return reply
        .status(200)
        .send({ message: "Message received. I'll be in touch soon.", delivered: true });
    },
  );
}
