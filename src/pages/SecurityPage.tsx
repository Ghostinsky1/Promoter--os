import { ArrowLeft, Shield, Lock, Key, Database, Eye, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-[#1140F0]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[#8FD3FF] hover:text-[#6FB8F2] transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-[#8FD3FF]/10 rounded-xl">
            <Shield className="h-8 w-8 text-[#8FD3FF]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white">Security</h1>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-[#A8B2C1]">
          <section>
            <p className="text-lg">
              At PROMOTER OS, security is our top priority. We implement industry-leading security
              measures to protect your data and ensure the integrity of our platform.
            </p>
          </section>

          <section className="bg-[#14171E] rounded-2xl p-8 border border-gray-800">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-[#8FD3FF]/10 rounded-lg">
                <Lock className="h-6 w-6 text-[#8FD3FF]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">Data Encryption</h2>
                <p>
                  All data is encrypted both in transit and at rest. We use TLS 1.3 for data
                  transmission and AES-256 encryption for stored data. Your sensitive information
                  is protected using the same encryption standards used by banks and financial
                  institutions.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-[#14171E] rounded-2xl p-8 border border-gray-800">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-[#8FD3FF]/10 rounded-lg">
                <Key className="h-6 w-6 text-[#8FD3FF]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">Authentication & Access Control</h2>
                <p className="mb-4">
                  We use enterprise-grade authentication powered by Supabase:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Secure password hashing using bcrypt</li>
                  <li>Email verification for new accounts</li>
                  <li>Session management with automatic timeout</li>
                  <li>Row-level security to ensure data isolation between users</li>
                  <li>Organization-based access controls</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="bg-[#14171E] rounded-2xl p-8 border border-gray-800">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-[#8FD3FF]/10 rounded-lg">
                <Database className="h-6 w-6 text-[#8FD3FF]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">Database Security</h2>
                <p className="mb-4">
                  Our database infrastructure is designed with security at every layer:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Automated daily backups with point-in-time recovery</li>
                  <li>Database replication for high availability</li>
                  <li>Network isolation and firewall protection</li>
                  <li>Regular security patches and updates</li>
                  <li>SQL injection prevention through parameterized queries</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="bg-[#14171E] rounded-2xl p-8 border border-gray-800">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-[#8FD3FF]/10 rounded-lg">
                <Eye className="h-6 w-6 text-[#8FD3FF]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">Privacy & Data Protection</h2>
                <p className="mb-4">
                  Your data belongs to you, and we respect your privacy:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>We never sell or share your data with third parties</li>
                  <li>Payment information is handled exclusively by Stripe (PCI-DSS compliant)</li>
                  <li>We collect only the minimum data necessary to provide our service</li>
                  <li>You can export or delete your data at any time</li>
                  <li>GDPR and CCPA compliant data handling</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="bg-[#14171E] rounded-2xl p-8 border border-gray-800">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-[#8FD3FF]/10 rounded-lg">
                <Shield className="h-6 w-6 text-[#8FD3FF]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">Application Security</h2>
                <p className="mb-4">
                  We follow secure development practices:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Regular security audits and penetration testing</li>
                  <li>Input validation and sanitization to prevent XSS attacks</li>
                  <li>CSRF protection on all state-changing operations</li>
                  <li>Content Security Policy (CSP) headers</li>
                  <li>Dependency scanning for vulnerable packages</li>
                  <li>Secure API design with rate limiting</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="bg-[#14171E] rounded-2xl p-8 border border-gray-800">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-[#8FD3FF]/10 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-[#8FD3FF]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">Incident Response</h2>
                <p className="mb-4">
                  We have a comprehensive incident response plan in place:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>24/7 monitoring and alerting for security events</li>
                  <li>Rapid response team for security incidents</li>
                  <li>Transparent communication with affected users</li>
                  <li>Post-incident analysis and remediation</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Infrastructure & Hosting</h2>
            <p className="mb-4">
              PROMOTER OS is built on trusted, secure infrastructure:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Supabase:</strong> Enterprise-grade PostgreSQL database with built-in security</li>
              <li><strong>Vercel/AWS:</strong> SOC 2 compliant hosting infrastructure</li>
              <li><strong>Stripe:</strong> PCI-DSS Level 1 certified payment processing</li>
              <li><strong>Edge Functions:</strong> Serverless functions with isolated execution environments</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Compliance</h2>
            <p className="mb-4">
              We adhere to industry standards and regulations:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>GDPR (General Data Protection Regulation) compliant</li>
              <li>CCPA (California Consumer Privacy Act) compliant</li>
              <li>SOC 2 Type II standards</li>
              <li>Regular third-party security assessments</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Best Practices for Users</h2>
            <p className="mb-4">
              Help us keep your account secure:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Use a strong, unique password</li>
              <li>Never share your login credentials</li>
              <li>Log out when using shared devices</li>
              <li>Review your account activity regularly</li>
              <li>Report suspicious activity immediately</li>
            </ul>
          </section>

          <section className="bg-[#22262F] rounded-2xl p-8 border border-[#8FD3FF]/30">
            <h2 className="text-2xl font-bold text-white mb-4">Report a Security Issue</h2>
            <p className="mb-4">
              If you discover a security vulnerability, please report it responsibly:
            </p>
            <p className="text-white font-semibold">
              Email: support@gozaentertainment.com
            </p>
            <p className="mt-4 text-sm">
              We take all security reports seriously and will respond promptly. We appreciate
              responsible disclosure and will work with you to address any issues quickly.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
