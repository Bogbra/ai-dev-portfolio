'use client';

import { useState, useRef } from 'react';
import { useInView } from 'motion/react';
import { motion } from 'motion/react';
import { easings } from '@/components/motion/easings';
import { contactSchema } from '@ai/types';
import { submitContact } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useLang } from '@/lib/i18n';

type FormState = 'idle' | 'loading' | 'success' | 'error';

type FieldErrors = {
  name?: string;
  email?: string;
  message?: string;
  consent?: string;
};

export function ContactSection() {
  const { t } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  const [formState, setFormState] = useState<FormState>('idle');
  const [serverError, setServerError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [delivered, setDelivered] = useState(true);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState('loading');
    setServerError('');
    setFieldErrors({});

    const form = e.currentTarget;
    const data = new FormData(form);

    const rawPayload = {
      name:    String(data.get('name')    ?? ''),
      email:   String(data.get('email')   ?? ''),
      message: String(data.get('message') ?? ''),
      consent: data.get('consent') === 'on',
      _honey:  String(data.get('_honey')  ?? ''),
    };

    const parsed = contactSchema.safeParse(rawPayload);

    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key === 'name' || key === 'email' || key === 'message' || key === 'consent') {
          // Use translated error messages instead of Zod's English-only messages
          if (!errors[key]) errors[key] = t.contact.errors[key];
        }
      }
      setFieldErrors(errors);
      setFormState('idle');
      return;
    }

    const result = await submitContact(parsed.data);

    if (result.ok) {
      setDelivered(result.data.delivered);
      setFormState('success');
      form.reset();
    } else {
      setServerError(result.error);
      setFormState('error');
    }
  }

  return (
    <section id="contact" className="py-24 md:py-32 px-8 md:px-16 lg:px-20 bg-surface">
      <div className="max-w-[1920px] mx-auto">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.6, ease: easings.outExpo }}
          className="mb-16 md:max-w-2xl"
        >
          <p className="font-mono text-sm text-muted tracking-[0.18em] uppercase mb-4">
            {t.contact.label}
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-fg tracking-tight leading-tight md:max-w-md">
            {t.contact.headline}
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, ease: easings.outExpo, delay: 0.15 }}
          className="w-full md:max-w-xl"
        >
          {formState === 'success' ? (
            <div
              role="status"
              aria-live="polite"
              className="border border-accent/30 bg-accent/5 rounded-lg p-8"
            >
              <p className="font-mono text-sm text-muted tracking-widest uppercase mb-3">
                {t.contact.successStatus}
              </p>
              <p className="text-base md:text-lg text-fg font-medium mb-2">
                {delivered ? t.contact.successTitle : t.contact.successTitleNoDelivery}
              </p>
              <p className="text-base text-muted mb-6">
                {delivered ? t.contact.successBody : t.contact.successBodyNoDelivery}
              </p>
              <button
                onClick={() => setFormState('idle')}
                className="font-mono text-base text-muted hover:text-fg transition-colors duration-150 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm"
              >
                {t.contact.sendAnother}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="w-full">
              {/* Honeypot — hidden from real users, caught server-side */}
              <input
                type="text"
                name="_honey"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute opacity-0 pointer-events-none h-0 w-0"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                <Field
                  label={t.contact.nameLabel}
                  id="contact-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  error={fieldErrors.name}
                  placeholder={t.contact.namePlaceholder}
                />
                <Field
                  label={t.contact.emailLabel}
                  id="contact-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  error={fieldErrors.email}
                  placeholder={t.contact.emailPlaceholder}
                />
              </div>

              <div className="mb-6">
                <label
                  htmlFor="contact-message"
                  className="block font-mono text-base text-muted mb-2"
                >
                  {t.contact.messageLabel} <span className="text-accent">*</span>
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  rows={6}
                  placeholder={t.contact.messagePlaceholder}
                  aria-describedby={fieldErrors.message ? 'contact-message-error' : undefined}
                  aria-invalid={fieldErrors.message ? true : undefined}
                  className={[
                    'w-full bg-bg border rounded-md px-4 py-3 font-mono text-base text-fg placeholder:text-muted/50',
                    'focus:outline-none focus:border-accent transition-colors duration-150 resize-y min-h-[120px]',
                    fieldErrors.message ? 'border-[var(--color-danger)]' : 'border-border',
                  ].join(' ')}
                />
                {fieldErrors.message && (
                  <p id="contact-message-error" role="alert" className="font-mono text-base text-[var(--color-danger)] mt-1.5">
                    {fieldErrors.message}
                  </p>
                )}
              </div>

              {/* Privacy consent */}
              <div className="mb-6">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="contact-consent"
                    name="consent"
                    required
                    aria-describedby={fieldErrors.consent ? 'contact-consent-error' : undefined}
                    aria-invalid={fieldErrors.consent ? true : undefined}
                    style={{ accentColor: 'var(--color-fg)', marginTop: '3px' }}
                    className="h-4 w-4 flex-shrink-0 cursor-pointer border border-border rounded-sm bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                  />
                  <label htmlFor="contact-consent" className="font-mono text-base text-muted leading-relaxed cursor-pointer">
                    {t.contact.consentText}
                    <a
                      href="/datenschutz"
                      className="text-fg underline underline-offset-2 hover:opacity-70 transition-opacity duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm"
                    >
                      {t.contact.consentLink}
                    </a>
                    {t.contact.consentPeriod}
                  </label>
                </div>
                {fieldErrors.consent && (
                  <p id="contact-consent-error" role="alert" className="font-mono text-base text-[var(--color-danger)] mt-2 ml-7">
                    {fieldErrors.consent}
                  </p>
                )}
              </div>

              {serverError && formState === 'error' && (
                <div
                  role="alert"
                  className="mb-5 border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 rounded-md px-4 py-3"
                >
                  <p className="font-mono text-base text-[var(--color-danger)]">{serverError}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={formState === 'loading'}
                className="w-full"
              >
                {formState === 'loading' ? t.contact.loading : t.contact.submit}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}

type FieldProps = {
  label: string;
  id: string;
  name: string;
  type: string;
  autoComplete: string;
  required?: boolean | undefined;
  error?: string | undefined;
  placeholder?: string | undefined;
};

function Field({ label, id, name, type, autoComplete, required, error, placeholder }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block font-mono text-base text-muted mb-2">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        className={[
          'w-full bg-bg border rounded-md px-4 py-3 font-mono text-base text-fg placeholder:text-muted/50',
          'focus:outline-none focus:border-accent transition-colors duration-150',
          error ? 'border-[var(--color-danger)]' : 'border-border',
        ].join(' ')}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="font-mono text-base text-[var(--color-danger)] mt-1.5">
          {error}
        </p>
      )}
    </div>
  );
}
