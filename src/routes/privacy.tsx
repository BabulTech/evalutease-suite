import { createFileRoute, Link } from "@tanstack/react-router";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

const UPDATED = "29 May 2026";

// react-doctor-disable-next-line react-doctor/only-export-components
function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Back to Jancho
        </Link>

        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Last updated: {UPDATED}
        </p>

        <div className="prose prose-invert mt-8 max-w-none text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:mt-3 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-primary">
          <p>
            Jancho (&ldquo;Jancho&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is an
            AI-powered assessment platform operated by BabulTech. This policy
            explains what information we collect, how we use it, and the choices
            you have. By using the Jancho website or mobile app, you agree to
            this policy.
          </p>

          <h2>1. Information we collect</h2>
          <ul>
            <li>
              <strong>Account details</strong> you provide at signup: name,
              email address, mobile number, and your selected role (e.g.
              teacher, student, employer).
            </li>
            <li>
              <strong>Content you create</strong>: quizzes, questions,
              participant records, sessions, reports, and reviews.
            </li>
            <li>
              <strong>Payment verification</strong>: when you upgrade a plan you
              may upload a payment screenshot (EasyPaisa / JazzCash / bank). We
              store it only to verify and activate your subscription.
            </li>
            <li>
              <strong>AI usage</strong>: counts and metadata of AI features you
              use (e.g. question generation, grading) to enforce plan limits and
              bill credits. We do not use your content to train AI models.
            </li>
            <li>
              <strong>Device &amp; push tokens</strong>: on mobile, if you enable
              notifications we store a push token (Firebase Cloud Messaging) to
              deliver alerts. You can disable this anytime in Settings.
            </li>
            <li>
              <strong>Usage activity</strong>: basic logs (actions, timestamps)
              used for security, auditing, and product analytics.
            </li>
          </ul>

          <h2>2. How we use your information</h2>
          <ul>
            <li>To provide and operate the assessment platform.</li>
            <li>To authenticate you and keep your account secure.</li>
            <li>To process plan upgrades and apply credits.</li>
            <li>To send notifications you have opted into.</li>
            <li>To understand usage and improve the product.</li>
            <li>To comply with legal obligations.</li>
          </ul>

          <h2>3. Service providers we use</h2>
          <p>
            We share data only with infrastructure providers that process it on
            our behalf:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> — authentication, database, and file
              storage.
            </li>
            <li>
              <strong>Vercel</strong> — application hosting.
            </li>
            <li>
              <strong>Firebase Cloud Messaging (Google)</strong> — push
              notification delivery.
            </li>
            <li>
              <strong>Anthropic (Claude)</strong> — AI features such as question
              generation and grading.
            </li>
          </ul>
          <p>
            We do not sell your personal information to anyone.
          </p>

          <h2>4. Data retention</h2>
          <p>
            We keep your data for as long as your account is active. You can
            request deletion of your account and associated data by contacting
            us (see below). Some records may be retained where required for
            legal, security, or accounting purposes.
          </p>

          <h2>5. Your rights</h2>
          <ul>
            <li>Access, correct, or update your account information in Settings.</li>
            <li>Disable push notifications at any time.</li>
            <li>Request a copy or deletion of your data by emailing us.</li>
          </ul>

          <h2>6. Security</h2>
          <p>
            Access to data is protected by row-level security and role-based
            access controls. Connections are encrypted in transit. No system is
            perfectly secure, but we take reasonable measures to protect your
            information.
          </p>

          <h2>7. Children</h2>
          <p>
            Jancho is intended for educational and professional use. Where a
            participant is a minor, an account-holding teacher or organization is
            responsible for obtaining any consent required by local law.
          </p>

          <h2>8. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. Material changes will be
            reflected by updating the &ldquo;Last updated&rdquo; date above.
          </p>

          <h2>9. Contact us</h2>
          <p>
            For privacy questions or data requests, contact BabulTech:
          </p>
          <ul>
            <li>
              Email: <a href="mailto:contact@babultech.com">contact@babultech.com</a>
            </li>
            <li>Phone: +92 310 2700403</li>
            <li>
              Web: <a href="https://www.babultech.com/contact">babultech.com/contact</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
