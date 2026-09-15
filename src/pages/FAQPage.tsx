import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}

function FAQItem({ question, answer, isOpen, onClick }: FAQItemProps) {
  return (
    <div className="bg-[#1A1D1F] rounded-xl border border-gray-800 overflow-hidden hover:border-[#C4FF0D]/30 transition-colors">
      <button
        onClick={onClick}
        className="w-full px-6 py-5 flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-semibold text-white pr-4">{question}</h3>
        <ChevronDown
          className={`h-5 w-5 text-[#C4FF0D] flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-6 pb-5 text-[#A8B3B8]">
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'What is PROMTP?',
      answer:
        'PROMTP is a professional offer management platform designed specifically for concert promoters and event organizers. It helps you create, manage, and analyze event offers with advanced calculation tools, AI-powered insights, and professional PDF generation.',
    },
    {
      question: 'How does the free trial work?',
      answer:
        'You get full access to PROMTP for 7 days, completely free. No credit card required to start. You can create unlimited offers, use all features including AI insights, and export professional PDFs. Cancel anytime during the trial with no charges.',
    },
    {
      question: 'What happens after the trial ends?',
      answer:
        'After your 7-day trial, you can choose a plan that fits your needs. If you don\'t select a plan, your account will revert to view-only mode where you can access your existing offers but cannot create new ones. Your data is never deleted.',
    },
    {
      question: 'Can I cancel my subscription anytime?',
      answer:
        'Yes, absolutely. You can cancel your subscription at any time with no penalties or cancellation fees. Your access will continue until the end of your current billing period, and you can reactivate your subscription anytime.',
    },
    {
      question: 'What payment methods do you accept?',
      answer:
        'We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our secure payment processor, Stripe. We do not store any payment information on our servers.',
    },
    {
      question: 'How does the AI Deal Analyzer work?',
      answer:
        'Our AI analyzes your deal structure, ticket pricing, expenses, and comparable market data to provide intelligent insights. It evaluates profit margins, identifies risks, suggests pricing optimizations, and gives you data-driven recommendations to improve your deals.',
    },
    {
      question: 'Can I use my own templates?',
      answer:
        'Yes! You can create unlimited custom templates for different types of events, venues, or artists. Save your frequently used settings, expense categories, and deal structures. Templates make creating new offers incredibly fast.',
    },
    {
      question: 'Is my data secure?',
      answer:
        'Absolutely. We use bank-level encryption for all data (AES-256), secure authentication, and industry-standard security practices. Your data is backed up daily and protected by row-level security. We never share your data with third parties. See our Security page for more details.',
    },
    {
      question: 'Can multiple people in my organization use PROMTP?',
      answer:
        'Yes! Our Professional and Enterprise plans support multiple team members. You can invite colleagues, set permissions, and collaborate on offers together. Each team member gets their own login.',
    },
    {
      question: 'What types of deal structures do you support?',
      answer:
        'PROMTP supports all common deal structures including flat guarantees, percentage of gross splits, guarantee plus percentage deals, and backend deals. You can customize revenue splits, add bonuses, and configure complex profit-sharing arrangements.',
    },
    {
      question: 'Can I export my offers to PDF?',
      answer:
        'Yes! Generate professional, branded PDF offers with one click. PDFs include all deal terms, ticket scaling, expenses, settlement details, and your company branding. Perfect for sending to artists, managers, and agents.',
    },
    {
      question: 'Do you offer refunds?',
      answer:
        'While our subscriptions are non-refundable, we encourage you to use the 7-day free trial to fully test the platform before subscribing. If you experience issues with the service, contact our support team and we\'ll work to resolve them.',
    },
    {
      question: 'How do tours work in PROMTP?',
      answer:
        'You can group multiple shows into tours, making it easy to manage multi-date runs. Create a tour, add shows, and track the overall profitability across all dates. Perfect for routing artists through multiple markets.',
    },
    {
      question: 'Can I track deposits and payments?',
      answer:
        'Yes! Track artist deposits, venue deposits, balance due dates, and payment status. Get automatic calculations for deposit amounts based on your deal terms, and mark payments as received to stay organized.',
    },
    {
      question: 'What kind of analytics do you provide?',
      answer:
        'View comprehensive analytics including total revenue across all shows, average profit margins, break-even attendance, revenue by event type, monthly trends, and more. Understand your business performance at a glance.',
    },
    {
      question: 'Is there a mobile app?',
      answer:
        'PROMTP is a responsive web application that works perfectly on mobile devices, tablets, and desktops. Access your offers from anywhere with an internet connection. No app download required.',
    },
    {
      question: 'What if I need help or have questions?',
      answer:
        'We offer email support for all users. Professional and Enterprise plans include priority support with faster response times. We also provide comprehensive documentation and video tutorials to help you get the most out of PROMTP.',
    },
    {
      question: 'Can I import data from spreadsheets?',
      answer:
        'While PROMTP doesn\'t currently have automated spreadsheet import, you can quickly recreate your offers using our templates feature. Once set up, you\'ll save hours compared to manual spreadsheet work.',
    },
    {
      question: 'Do you offer discounts for annual plans?',
      answer:
        'Yes! Save up to 20% by choosing annual billing instead of monthly. Annual plans are billed once per year and provide significant savings for long-term users.',
    },
    {
      question: 'What makes PROMTP different from spreadsheets?',
      answer:
        'PROMTP eliminates manual calculations, reduces errors, provides AI-powered insights, generates professional PDFs instantly, tracks all your offers in one place, and gives you analytics across your entire business. It\'s purpose-built for promoters, not general-purpose like spreadsheets.',
    },
  ];

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

        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-[#A8B3B8]">
            Everything you need to know about PROMTP
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>

        <div className="mt-12 p-8 bg-gradient-to-br from-[#1A1D1F] to-[#252A2E] rounded-2xl border border-[#C4FF0D]/30 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Still have questions?</h2>
          <p className="text-[#A8B3B8] mb-6">
            Can't find the answer you're looking for? Our support team is here to help.
          </p>
          <a
            href="mailto:support@promtp.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#C4FF0D] text-black font-semibold rounded-lg hover:bg-[#A3D60A] transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
