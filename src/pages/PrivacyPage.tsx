import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPage() {
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

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8">Privacy Policy</h1>

        <div className="prose prose-invert max-w-none space-y-8 text-[#A8B3B8]">
          <section>
            <p className="text-lg mb-6">
              Last Updated: December 2024
            </p>
            <p>
              At PROMTP, we take your privacy seriously. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Information We Collect</h2>
            <h3 className="text-xl font-semibold text-white mb-3">Account Information</h3>
            <p className="mb-4">
              When you create an account, we collect your email address, name, and password.
              This information is necessary to provide you with access to our platform.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3">Usage Data</h3>
            <p className="mb-4">
              We collect information about how you interact with our service, including the offers
              you create, templates you use, and features you access. This helps us improve our platform.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3">Payment Information</h3>
            <p>
              Payment processing is handled by Stripe. We do not store your credit card information
              on our servers. Please refer to Stripe's privacy policy for information on how they
              handle payment data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>To provide and maintain our service</li>
              <li>To process your subscription and payments</li>
              <li>To send you important updates and notifications</li>
              <li>To respond to your inquiries and support requests</li>
              <li>To improve and optimize our platform</li>
              <li>To ensure security and prevent fraud</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your information.
              Your data is encrypted in transit and at rest. We use Supabase for data storage,
              which provides enterprise-grade security features including row-level security
              and regular backups.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Data Retention</h2>
            <p>
              We retain your information for as long as your account is active or as needed to
              provide you services. If you delete your account, we will delete your personal
              information within 30 days, except where we are required to retain it for legal purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Third-Party Services</h2>
            <p className="mb-4">
              We use the following third-party services:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Supabase:</strong> Database and authentication services</li>
              <li><strong>Stripe:</strong> Payment processing</li>
              <li><strong>OpenAI:</strong> AI-powered insights and analysis (optional features)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Your Rights</h2>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Export your data</li>
              <li>Opt-out of marketing communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Cookies and Tracking</h2>
            <p>
              We use essential cookies to maintain your session and remember your preferences.
              We do not use tracking cookies for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              significant changes by email or through our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or how we handle your information,
              please contact us at privacy@promtp.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
