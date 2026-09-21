import { describe, it, expect } from 'vitest';
import { contactSchema } from './contact.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const valid = {
  name:    'Dana Schmitt',
  email:   'dana@example.com',
  message: 'Hello, I would love to work with you on a project.',
  consent: true as const,
  _honey:  '',
};

function parse(overrides: Partial<typeof valid & { _honey: string }>) {
  return contactSchema.safeParse({ ...valid, ...overrides });
}

// ─── Valid submission ─────────────────────────────────────────────────────────

describe('valid submission', () => {
  it('accepts a clean payload', () => {
    expect(parse({}).success).toBe(true);
  });

  it('trims whitespace from name', () => {
    const result = parse({ name: '  Dana  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Dana');
  });

  it('trims whitespace from email', () => {
    const result = parse({ email: '  dana@example.com  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('dana@example.com');
  });

  it('trims whitespace from message', () => {
    const result = parse({ message: '  ' + valid.message + '  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.message).toBe(valid.message);
  });

  it('defaults _honey to empty string when omitted', () => {
    const result = contactSchema.safeParse({ name: valid.name, email: valid.email, message: valid.message, consent: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data._honey).toBe('');
  });
});

// ─── Required fields ──────────────────────────────────────────────────────────

describe('required fields', () => {
  it('rejects empty name', () => {
    expect(parse({ name: '' }).success).toBe(false);
  });

  it('rejects whitespace-only name', () => {
    expect(parse({ name: '   ' }).success).toBe(false);
  });

  it('rejects single-character name', () => {
    expect(parse({ name: 'A' }).success).toBe(false);
  });

  it('rejects empty message', () => {
    expect(parse({ message: '' }).success).toBe(false);
  });

  it('rejects whitespace-only message (becomes empty after trim)', () => {
    expect(parse({ message: '          ' }).success).toBe(false);
  });

  it('rejects short message', () => {
    expect(parse({ message: 'Hi there!' }).success).toBe(false);
  });
});

// ─── Email validation ─────────────────────────────────────────────────────────

describe('email validation', () => {
  it('rejects plain text as email', () => {
    expect(parse({ email: 'notanemail' }).success).toBe(false);
  });

  it('rejects email missing domain', () => {
    expect(parse({ email: 'user@' }).success).toBe(false);
  });

  it('rejects email missing @', () => {
    expect(parse({ email: 'user.example.com' }).success).toBe(false);
  });

  it('rejects email header injection via CR', () => {
    expect(parse({ email: 'user@example.com\rBCC: attacker@evil.com' }).success).toBe(false);
  });

  it('rejects email header injection via LF', () => {
    expect(parse({ email: 'user@example.com\nBCC: attacker@evil.com' }).success).toBe(false);
  });

  it('rejects email header injection via CRLF', () => {
    expect(parse({ email: 'user@example.com\r\nBCC: attacker@evil.com' }).success).toBe(false);
  });

  it('rejects email over 254 characters', () => {
    const long = 'a'.repeat(244) + '@example.com'; // 256 chars
    expect(parse({ email: long }).success).toBe(false);
  });
});

// ─── Length limits ────────────────────────────────────────────────────────────

describe('length limits', () => {
  it('rejects name over 100 characters', () => {
    expect(parse({ name: 'A'.repeat(101) }).success).toBe(false);
  });

  it('accepts name of exactly 100 characters', () => {
    expect(parse({ name: 'A'.repeat(100) }).success).toBe(true);
  });

  it('rejects message over 5000 characters', () => {
    expect(parse({ message: 'A'.repeat(5001) }).success).toBe(false);
  });

  it('accepts message of exactly 5000 characters', () => {
    expect(parse({ message: 'A'.repeat(5000) }).success).toBe(true);
  });
});

// ─── Injection / malicious input ─────────────────────────────────────────────

describe('injection and malicious input', () => {
  it('accepts script tag in message (treated as plain text on backend)', () => {
    // The backend sends plain text email — no HTML rendering, so script tags are inert.
    // The schema does not strip them; the route must never render them as HTML.
    const result = parse({ message: '<script>alert("xss")</script> — testing input handling.' });
    expect(result.success).toBe(true);
  });

  it('accepts HTML in message (plain text email makes it inert)', () => {
    const result = parse({ message: '<img src=x onerror=alert(1)> testing.' });
    expect(result.success).toBe(true);
  });

  it('accepts SQL-like input in message', () => {
    const result = parse({ message: "' OR '1'='1 — this is a message about security testing." });
    expect(result.success).toBe(true);
  });

  it('accepts template literal in message (treated as plain text)', () => {
    const result = parse({ message: '${process.env.SECRET} is not expanded here.' });
    expect(result.success).toBe(true);
  });
});

// ─── Consent ──────────────────────────────────────────────────────────────────

describe('privacy consent', () => {
  it('accepts consent: true', () => {
    expect(parse({ consent: true }).success).toBe(true);
  });

  it('rejects consent: false', () => {
    expect(contactSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });

  it('rejects missing consent', () => {
    const { consent: _omit, ...withoutConsent } = valid;
    expect(contactSchema.safeParse(withoutConsent).success).toBe(false);
  });

  it('rejects consent: "true" (string, not boolean)', () => {
    expect(contactSchema.safeParse({ ...valid, consent: 'true' }).success).toBe(false);
  });
});

// ─── Honeypot ─────────────────────────────────────────────────────────────────

describe('honeypot field', () => {
  it('passes when _honey is empty string', () => {
    expect(parse({ _honey: '' }).success).toBe(true);
  });

  it('passes when _honey is filled — route handles silently, schema does not reject', () => {
    // Schema accepts any string; the route checks and returns 200 silently.
    const result = parse({ _honey: 'bot was here' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data._honey).toBe('bot was here');
  });
});

// ─── Unknown fields ───────────────────────────────────────────────────────────

describe('unknown fields', () => {
  it('rejects a payload with an extra top-level field', () => {
    const result = contactSchema.safeParse({ ...valid, extra: 'not allowed' });
    expect(result.success).toBe(false);
  });
});
