import React from 'react';
import { Link } from 'react-router-dom';
import LegalLayout from '../../components/LegalLayout';
import { CONTACT_EMAIL, MIN_AGE, LEGAL_LAST_UPDATED } from '../../lib/legal';

export default function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated={LEGAL_LAST_UPDATED}>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of PitchNest. By creating an account or using the
        service, you agree to these Terms and our{' '}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2>1. Service description</h2>
      <p>
        PitchNest provides AI-powered pitch practice tools, including simulated investor conversations, deck analysis,
        session recordings, and performance reports. The service is for educational and practice purposes only.
      </p>

      <h2>2. Not financial or investment advice</h2>
      <p>
        AI-generated feedback, scores, and personas are <strong>not</strong> investment advice, legal advice, or a
        guarantee of funding. PitchNest does not connect you with real investors unless explicitly stated in a future
        product feature. You are solely responsible for business and fundraising decisions.
      </p>

      <h2>3. Eligibility</h2>
      <p>
        You must be at least {MIN_AGE} years old (or the minimum age in your jurisdiction) and able to form a binding contract.
        You must provide accurate registration information.
      </p>

      <h2>4. Your account</h2>
      <ul>
        <li>You are responsible for safeguarding your password and all activity under your account.</li>
        <li>You may delete your account at any time via Settings or our{' '}
          <Link to="/delete-account">Delete Account</Link> page.</li>
        <li>We may suspend or terminate accounts that violate these Terms or applicable law.</li>
      </ul>

      <h2>5. Your content</h2>
      <p>
        You retain ownership of pitch decks, recordings, and other content you upload. You grant PitchNest a limited
        license to host, process, and analyze that content solely to provide the service (including sending it to AI
        providers as described in the Privacy Policy).
      </p>
      <p>
        You represent that you have the right to upload your content and that it does not infringe third-party rights or
        violate law.
      </p>
      <p>
        Content in a shared business workspace remains available to its other active members if you leave or delete your
        account. Your membership and public team identity are removed. A workspace with no other active member is deleted.
      </p>

      <h2>6. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service for unlawful, harmful, or abusive purposes.</li>
        <li>Attempt to reverse engineer, scrape, or overload our systems.</li>
        <li>Misrepresent AI output as human investor communication in misleading ways.</li>
        <li>Upload malware or content you do not have rights to use.</li>
      </ul>

      <h2>7. Subscriptions and payments</h2>
      <p>
        Paid access periods, prices, currencies, and durations are shown before purchase and processed through
        Flutterwave&apos;s hosted checkout. Card details are handled by Flutterwave rather than PitchNest. Deleting an
        account ends access to any remaining paid period and does not itself create a refund; contact support for payment
        questions.
      </p>

      <h2>8. Intellectual property</h2>
      <p>
        PitchNest&apos;s brand, software, and design are owned by us or our licensors. These Terms do not grant you
        ownership of our intellectual property.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. AI outputs may be
        inaccurate or incomplete.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, PITCHNEST AND ITS TEAM SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL,
        SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF
        THE SERVICE.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may modify these Terms. Material changes will be posted with an updated date. Continued use after changes
        constitutes acceptance.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These Terms are governed by the laws applicable in the jurisdiction where PitchNest operates, without regard to
        conflict-of-law rules. Disputes will be resolved in competent courts unless otherwise required by consumer
        protection law in your country.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these Terms:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        {' '}· <Link to="/support">Support</Link> · <Link to="/privacy">Privacy Policy</Link>
      </p>
    </LegalLayout>
  );
}
