import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Bot,
  MessageSquare,
  Zap,
  Shield,
  Clock,
  TrendingUp,
  Users,
  Globe,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Play,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  const features = [
    {
      icon: Bot,
      title: 'AI-Powered Conversations',
      description: 'Intelligent chatbot that understands context and provides human-like responses to your customers.',
    },
    {
      icon: MessageSquare,
      title: 'WhatsApp Integration',
      description: 'Connect directly to WhatsApp Business and manage all conversations from one dashboard.',
    },
    {
      icon: Zap,
      title: 'Instant Setup',
      description: 'Get your AI chatbot running in minutes with our guided setup process and pre-built templates.',
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Enterprise-grade security with encrypted conversations and 99.9% uptime guarantee.',
    },
    {
      icon: Clock,
      title: '24/7 Availability',
      description: 'Never miss a customer inquiry. Your AI assistant works around the clock.',
    },
    {
      icon: TrendingUp,
      title: 'Smart Analytics',
      description: 'Track conversations, measure performance, and gain insights to improve customer experience.',
    },
  ];

  const howItWorks = [
    {
      step: '01',
      title: 'Create Your Chatbot',
      description: 'Sign up and create your AI chatbot in minutes. Customize its personality and knowledge base.',
    },
    {
      step: '02',
      title: 'Connect WhatsApp',
      description: 'Link your WhatsApp Business number with a simple QR code scan.',
    },
    {
      step: '03',
      title: 'Train Your AI',
      description: 'Upload your products, FAQs, and documents. The AI learns your business instantly.',
    },
    {
      step: '04',
      title: 'Go Live',
      description: 'Activate your chatbot and start handling customer conversations automatically.',
    },
  ];

  const faqs = [
    {
      question: 'What is 2ndu?',
      answer: '2ndu is an AI-powered WhatsApp chatbot platform that helps businesses automate customer conversations. Our intelligent chatbots can handle inquiries, process orders, and provide 24/7 customer support.',
    },
    {
      question: 'How does the AI chatbot work?',
      answer: 'Our AI chatbot uses advanced language models to understand customer messages and respond naturally. You train it with your business information, products, and FAQs, and it handles conversations automatically while maintaining your brand voice.',
    },
    {
      question: 'Do I need technical knowledge to set up?',
      answer: 'Not at all! 2ndu is designed to be user-friendly. Our guided setup process walks you through everything, and you can have your chatbot running within minutes without writing any code.',
    },
    {
      question: 'Can the chatbot handle multiple languages?',
      answer: 'Yes! Our AI chatbot supports multiple languages including English, Malay, Chinese, and more. It can automatically detect and respond in the customer\'s preferred language.',
    },
    {
      question: 'What happens if the AI cannot answer a question?',
      answer: 'When the AI encounters a complex query it cannot handle, it can seamlessly transfer the conversation to a human agent or notify you for follow-up. You stay in control of the customer experience.',
    },
    {
      question: 'Is my customer data secure?',
      answer: 'Absolutely. We use enterprise-grade encryption for all data. Your customer conversations and business information are protected with the highest security standards.',
    },
  ];

  const stats = [
    { value: '10K+', label: 'Messages Handled' },
    { value: '99.9%', label: 'Uptime' },
    { value: '24/7', label: 'Availability' },
    { value: '<2s', label: 'Response Time' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] animate-pulse delay-1000" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img src="/2ndu.png" alt="2ndu" className="h-8 w-auto" />
              <span className="text-xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                2ndu
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-white/70 hover:text-white transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-sm text-white/70 hover:text-white transition-colors">
                How It Works
              </a>
              <a href="#faq" className="text-sm text-white/70 hover:text-white transition-colors">
                FAQ
              </a>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Button
                variant="ghost"
                className="text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => navigate('/auth')}
              >
                Sign In
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => navigate('/auth')}
              >
                Get Started Free
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-white/70 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-slate-900 border-b border-white/5"
          >
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block text-white/70 hover:text-white py-2">
                Features
              </a>
              <a href="#how-it-works" className="block text-white/70 hover:text-white py-2">
                How It Works
              </a>
              <a href="#faq" className="block text-white/70 hover:text-white py-2">
                FAQ
              </a>
              <div className="pt-3 border-t border-white/10 space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-center text-white/80"
                  onClick={() => navigate('/auth')}
                >
                  Sign In
                </Button>
                <Button
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={() => navigate('/auth')}
                >
                  Get Started Free
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            style={{ opacity, scale }}
            className="text-center max-w-4xl mx-auto"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary">AI-Powered WhatsApp Chatbot</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            >
              Your Business,{' '}
              <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
                Always Online
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg sm:text-xl text-white/60 mb-10 max-w-2xl mx-auto"
            >
              Transform your customer service with an AI chatbot that handles WhatsApp conversations 24/7.
              Increase sales, reduce response time, and delight your customers.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                onClick={() => navigate('/auth')}
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 px-8 py-6 text-lg rounded-xl"
              >
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </motion.div>

            {/* Scroll Indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="mt-16"
            >
              <a href="#features" className="inline-flex flex-col items-center text-white/40 hover:text-white/60 transition-colors">
                <span className="text-xs mb-2">Scroll to explore</span>
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <ChevronDown className="h-5 w-5" />
                </motion.div>
              </a>
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-white/50 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                Scale Your Business
              </span>
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              Powerful features designed to automate your customer service and boost sales.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300 h-full group">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-white/60 text-sm leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Get Started in{' '}
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                4 Simple Steps
              </span>
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              From setup to live in minutes. No coding required.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="relative"
              >
                {/* Connector Line */}
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
                )}

                <div className="relative z-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25">
                    <span className="text-2xl font-bold text-white">{item.step}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-white/60 text-sm">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Why Businesses Choose{' '}
                <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                  2ndu
                </span>
              </h2>
              <div className="space-y-4">
                {[
                  'Reduce response time from hours to seconds',
                  'Handle unlimited conversations simultaneously',
                  'Convert more leads with instant engagement',
                  'Free up your team for high-value tasks',
                  'Provide consistent, accurate information',
                  'Scale customer service without scaling costs',
                ].map((benefit, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-white/80">{benefit}</span>
                  </motion.div>
                ))}
              </div>
              <Button
                size="lg"
                className="mt-8 bg-primary hover:bg-primary/90"
                onClick={() => navigate('/auth')}
              >
                Start Your Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative"
            >
              {/* Decorative Elements */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-3xl blur-3xl" />
              <div className="relative bg-white/5 border border-white/10 rounded-3xl p-8">
                <div className="space-y-4">
                  {/* Sample Chat Messages */}
                  <div className="flex justify-end">
                    <div className="bg-primary/20 rounded-2xl rounded-tr-md px-4 py-3 max-w-[80%]">
                      <p className="text-sm text-white">Hi, I'm interested in your products. What do you have?</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-white/10 rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%]">
                      <p className="text-sm text-white/90">Hello! Welcome to our store. We have a wide range of products. What category are you interested in?</p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-white/40">
                        <Bot className="h-3 w-3" />
                        <span>AI Assistant</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-primary/20 rounded-2xl rounded-tr-md px-4 py-3 max-w-[80%]">
                      <p className="text-sm text-white">I'm looking for electronics</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-white/10 rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%]">
                      <p className="text-sm text-white/90">Great choice! Here are our top electronics:</p>
                      <ul className="text-sm text-white/70 mt-2 space-y-1">
                        <li>• Smartphones - from RM999</li>
                        <li>• Laptops - from RM1999</li>
                        <li>• Accessories - from RM49</li>
                      </ul>
                      <p className="text-sm text-white/90 mt-2">Would you like details on any of these?</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Frequently Asked{' '}
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                Questions
              </span>
            </h2>
            <p className="text-white/60">
              Everything you need to know about 2ndu.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="bg-white/5 border border-white/10 rounded-xl px-6 data-[state=open]:bg-white/[0.07]"
                >
                  <AccordionTrigger className="text-left text-white hover:text-white/90 hover:no-underline py-5">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-white/60 pb-5">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-blue-500/30 rounded-3xl blur-3xl" />
            <div className="relative bg-gradient-to-r from-primary/10 to-blue-500/10 border border-white/10 rounded-3xl p-12 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Ready to Transform Your Customer Service?
              </h2>
              <p className="text-white/60 mb-8 max-w-2xl mx-auto">
                Join businesses that are already using 2ndu to automate their WhatsApp conversations
                and grow their sales.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  size="lg"
                  className="bg-white text-slate-900 hover:bg-white/90 px-8 py-6 text-lg rounded-xl"
                  onClick={() => navigate('/auth')}
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <p className="text-white/40 text-sm">No credit card required</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/2ndu.png" alt="2ndu" className="h-8 w-auto" />
              <span className="text-lg font-semibold">2ndu</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/50">
              <a href="/terms" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-sm text-white/40">
              © {new Date().getFullYear()} 2ndu. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
