import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0F1113]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[#C4FF0D] hover:text-[#A3D60A] transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8">Terms of Service</h1>

        <div className="prose prose-invert max-w-none space-y-8 text-[#A8B3B8]">
          <section>
            <p className="text-lg mb-6">
              Last Updated: December 2024
            </p>
            <p>
              Please read these Terms of Service carefully before using PROMTP. By accessing or
              using our service, you agree to be bound by these terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Acceptance of Terms</h2>
            <p>
              By creating an account or using PROMTP, you acknowledge that you have read,
              understood, and agree to be bound by these Terms of Service and our Privacy Policy.
              If you do not agree, you may not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Description of Service</h2>
            <p>
              PROMTP is a professional offer management platform designed for concert promoters
              and event organizers. Our service helps you create, manage, and analyze event offers
              with advanced calculation tools and AI-powered insights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Account Registration</h2>
            <h3 className="text-xl font-semibold text-white mb-3">Eligibility</h3>
            <p className="mb-4">
              You must be at least 18 years old and legally capable of entering into binding
              contracts to use PROMTP.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3">Account Security</h3>
            <p className="mb-4">
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activities that occur under your account. Notify us immediately of any
              unauthorized access.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3">Accurate Information</h3>
            <p>
              You agree to provide accurate, current, and complete information during registration
              and to update it as necessary to maintain its accuracy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Subscription and Payment</h2>
            <h3 className="text-xl font-semibold text-white mb-3">Free Trial</h3>
            <p className="mb-4">
              New users receive a 7-day free trial. You may cancel at any time during the trial
              period without being charged.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3">Billing</h3>
            <p className="mb-4">
              After the trial period, your subscription will automatically renew based on your
              selected plan unless you cancel. All fees are non-refundable except as required by law.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3">Cancellation</h3>
            <p>
              You may cancel your subscription at any time. Your access will continue until the
              end of your current billing period.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Acceptable Use</h2>
            <p className="mb-4">You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Use the service for any illegal purpose or in violation of any laws</li>
              <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
              <li>Transmit any viruses, malware, or harmful code</li>
              <li>Interfere with or disrupt the service or servers</li>
              <li>Use automated systems to access the service without permission</li>
              <li>Reverse engineer or attempt to extract source code</li>
              <li>Share your account with others or create multiple accounts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Intellectual Property</h2>
            <h3 className="text-xl font-semibold text-white mb-3">Our Rights</h3>
            <p className="mb-4">
              PROMTP and all associated content, features, and functionality are owned by us
              and protected by copyright, trademark, and other intellectual property laws.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3">Your Content</h3>
            <p>
              You retain all rights to the content you create using PROMTP. By using our service,
              you grant us a limited license to store, process, and display your content solely
              to provide the service to you.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Data and Privacy</h2>
            <p>
              Your use of PROMTP is also governed by our Privacy Policy. We implement
              industry-standard security measures to protect your data, but we cannot guarantee
              absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Limitation of Liability</h2>
            <p>
              PROMTP is provided "as is" without warranties of any kind. We are not liable for
              any indirect, incidental, special, consequential, or punitive damages arising from
              your use of the service. Our total liability shall not exceed the amount you paid
              us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Service Modifications</h2>
            <p>
              We reserve the right to modify, suspend, or discontinue any aspect of the service
              at any time. We will provide notice of material changes when reasonably possible.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Termination</h2>
            <p>
              We may terminate or suspend your account immediately, without prior notice, if you
              breach these Terms. Upon termination, your right to use the service will cease
              immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable laws.
              Any disputes shall be resolved in the appropriate courts.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes
              by email or through the service. Your continued use after changes constitutes
              acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Contact Information</h2>
            <p>
              If you have questions about these Terms, please contact us at support@promtp.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
