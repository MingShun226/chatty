# 🤖 AvatarLab - AI Chatbot Platform

A powerful SaaS platform for creating AI-powered chatbots with WhatsApp integration, n8n workflows, fine-tuning capabilities, and multi-tenant architecture.

## 🚀 Quick Start

**New to AvatarLab?** Choose your path:

- **[Getting Started](docs/guides/setup/START_HERE.md)** - Your first steps with the platform
- **[Quick Start Guide](docs/guides/setup/QUICK_START.md)** - Set up your first chatbot
- **[WhatsApp Quick Start](docs/guides/whatsapp/QUICK_START_WHATSAPP.md)** - Connect WhatsApp in minutes

## 📚 Documentation

### 🎯 Setup & Getting Started

- **[Getting Started](docs/guides/setup/START_HERE.md)** - Begin here
- **[Quick Start Guide](docs/guides/setup/QUICK_START.md)** - Platform setup
- **[Project Proposal](docs/guides/setup/AvatarHub_Proposal.md)** - Project overview
- **[Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md)** - Complete deployment guide

### 📱 WhatsApp Integration

- **[WhatsApp Setup Guide](docs/guides/whatsapp/WHATSAPP_SETUP_GUIDE.md)** - Complete setup instructions
- **[Quick Start (WhatsApp)](docs/guides/whatsapp/QUICK_START_WHATSAPP.md)** - Get started fast
- **[WhatsApp Web Quick Start](docs/guides/whatsapp/WHATSAPP_WEB_QUICK_START.md)** - Web integration
- **[WhatsApp Integration README](docs/guides/whatsapp/WHATSAPP_INTEGRATION_README.md)** - Technical details
- **[Implementation Summary](docs/guides/whatsapp/WHATSAPP_IMPLEMENTATION_SUMMARY.md)** - What's implemented
- **[Deployment Checklist](docs/guides/whatsapp/WHATSAPP_DEPLOYMENT_CHECKLIST.md)** - Pre-deployment checks
- **[SaaS Deployment](docs/guides/whatsapp/WHATSAPP_SAAS_DEPLOYMENT.md)** - Multi-tenant deployment
- **[UI Guide](docs/guides/whatsapp/WHATSAPP_UI_GUIDE.md)** - User interface documentation
- **[Simplified Flow](docs/guides/whatsapp/SIMPLIFIED_WHATSAPP_FLOW.md)** - Understanding the flow

### 🔄 n8n Integration & Workflows

- **[n8n Integration Guide](docs/guides/n8n/N8N_INTEGRATION_GUIDE.md)** - Complete guide
- **[n8n Setup Instructions](docs/guides/n8n/N8N_SETUP_INSTRUCTIONS.md)** - Step-by-step setup
- **[WhatsApp + n8n Workflow Guide](docs/guides/n8n/WHATSAPP_N8N_WORKFLOW_GUIDE.md)** - Building workflows
- **[N8N Setup Complete Guide](docs/N8N_SETUP_COMPLETE_GUIDE.md)** - Comprehensive N8N setup
- **[Complete N8N Integration Guide](docs/COMPLETE_N8N_INTEGRATION_GUIDE.md)** - Advanced integration

### 🏗️ Architecture & Technical

- **[Architecture Overview](docs/architecture/ARCHITECTURE.md)** - System architecture
- **[Function Calling Architecture](docs/architecture/FUNCTION_CALLING_ARCHITECTURE.md)** - AI function calling
- **[Implementation Complete](docs/architecture/IMPLEMENTATION_COMPLETE.md)** - Implementation status
- **[How It Works (Simple)](docs/HOW_IT_WORKS_SIMPLE.md)** - System overview
- **[Database Design](docs/database-design.md)** - Schema architecture

### 🎓 Chatbot Training & Fine-Tuning

- **[Fine-Tuning Setup Guide](docs/FINE_TUNING_SETUP_GUIDE.md)** - Complete guide to fine-tuning
- **[Fine-Tuning Explained](docs/FINE_TUNING_EXPLAINED.md)** - Understanding fine-tuning concepts
- **[Setup Fine-Tuning](docs/SETUP_FINE_TUNING.md)** - Quick setup instructions
- **[Enhancing Fine-Tuned Models](docs/ENHANCING_FINE_TUNED_MODELS.md)** - Tips for improving performance
- **[Chatbot Fine-Tuning Implementation](docs/CHATBOT_FINE_TUNING_IMPLEMENTATION.md)** - Advanced fine-tuning
- **[Unified Training README](docs/UNIFIED_TRAINING_README.md)** - Complete training system overview

### 🎨 Features & Capabilities

- **[AI Images Quick Start](docs/AI_IMAGES_QUICK_START.md)** - AI image generation setup
- **[AI Images Setup Instructions](docs/AI_IMAGES_SETUP_INSTRUCTIONS.md)** - Detailed image generation guide
- **[RAG Setup Guide](docs/RAG_SETUP_GUIDE.md)** - Retrieval-Augmented Generation
- **[Voice Cloning Setup](docs/VOICE_CLONING_SETUP.md)** - Voice cloning integration
- **[Nano Banana Setup](docs/NANO_BANANA_SETUP.md)** - Nano Banana integration
- **[Gallery Performance Optimization](docs/GALLERY_PERFORMANCE_OPTIMIZATION.md)** - Optimize image galleries

### 🔌 Integration & APIs

- **[API Keys Complete Guide](docs/API_KEYS_COMPLETE.md)** - API key setup and management
- **[API Integration Guide](docs/API_INTEGRATION_GUIDE.md)** - External API integration
- **[Get Avatar Prompt Guide](docs/GET_AVATAR_PROMPT_GUIDE.md)** - Working with avatar prompts

### 📖 Reference

- **[Testing Guide](docs/reference/TESTING_GUIDE.md)** - Testing your chatbots
- **[Prompt Agent Guide](docs/reference/PROMPT_AGENT_GUIDE.md)** - Working with AI prompts
- **[Business Chatbot System Prompt](docs/reference/BUSINESS_CHATBOT_SYSTEM_PROMPT.md)** - Prompt templates
- **[Sample Files README](docs/reference/SAMPLE_FILES_README.md)** - Using sample data
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Cost Warning](docs/COST_WARNING.md)** - Important cost considerations
- **[Version Control Guide](docs/VERSION_CONTROL_GUIDE.md)** - Git workflow and best practices

## 🗂️ Project Structure

```
AvatarLab/
├── src/                           # Frontend source code
│   ├── components/                # React components
│   │   ├── auth/                  # Authentication components
│   │   ├── business-chatbot/      # Business chatbot components
│   │   ├── chatbot-creation/      # Chatbot creation wizard
│   │   ├── dashboard/             # Dashboard components
│   │   ├── n8n/                   # n8n integration components
│   │   └── whatsapp/              # WhatsApp components
│   ├── pages/                     # Application pages
│   ├── services/                  # API services
│   ├── hooks/                     # React hooks
│   └── i18n/                      # Internationalization
├── supabase/                      # Supabase backend
│   ├── functions/                 # Edge functions
│   │   ├── avatar-chat/           # Chat endpoint
│   │   ├── whatsapp-webhook/      # WhatsApp webhook
│   │   └── whatsapp-oauth/        # OAuth handlers
│   └── migrations/                # Database migrations
├── whatsapp-web-service/          # WhatsApp service (Baileys)
├── docs/                          # Documentation
│   ├── guides/                    # User guides
│   │   ├── setup/                 # Getting started
│   │   ├── whatsapp/              # WhatsApp integration
│   │   └── n8n/                   # n8n workflows
│   ├── architecture/              # Technical docs
│   └── reference/                 # API reference
├── sql/                           # SQL scripts
├── examples/                      # Sample files & templates
├── workflows/                     # n8n workflow templates
└── scripts/                       # Utility scripts
```

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **WhatsApp**: Baileys library (WhatsApp Web API)
- **AI**: OpenAI GPT-4o (with fine-tuning support)
- **Automation**: n8n workflows
- **Image Generation**: Flux, DALL-E, Stable Diffusion
- **Voice**: ElevenLabs voice cloning

## 🚦 Installation

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- OpenAI API key
- (Optional) n8n account for workflows

### Setup Steps

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd AvatarLab

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
# See sql/RUN_THIS_SQL_FIRST.sql

# Start development server
npm run dev

# Start WhatsApp service (in another terminal)
cd whatsapp-web-service
npm install
npm start
```

### Database Setup

1. Create a Supabase project
2. Run SQL scripts in order:
   - `sql/RUN_THIS_SQL_FIRST.sql` - Initial setup
   - `sql/SAFE_SQL_SETUP.sql` - WhatsApp tables
   - Database migrations in `supabase/migrations/`
3. Configure environment variables

## 🔐 Environment Variables

### Main Application (`.env`)

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### WhatsApp Service (`whatsapp-web-service/.env`)

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=3001
```

## 📦 Resources

### SQL Scripts (`sql/`)

- `RUN_THIS_SQL_FIRST.sql` - Initial database setup ⭐
- `SAFE_SQL_SETUP.sql` - Safe re-runnable setup
- `fix_rls_policy.sql` - Fix Row Level Security
- `database_check_queries.sql` - Diagnostic queries
- `get_schema.sql` - Export database schema

### Sample Files (`examples/`)

- `sample_products.csv` - Product import template
- `sample_products.xlsx` - Product import (Excel)
- `sample_knowledge_base.md` - Knowledge base example
- `product_upload_template.csv` - CSV template
- `ABC Electronics sample knowledge base.pdf` - Complete example

### n8n Workflows (`workflows/`)

- `n8n-workflow-template.json` - Basic WhatsApp chatbot ⭐
- `WhatsApp Chatbot - AI Agent.json` - Advanced AI agent workflow
- `WhatsApp Chatbot - Simplified.json` - Simple chatbot workflow
- `Appointment Booking (Calendly).json` - Calendly integration example

### Utility Scripts (`scripts/`)

- `start-whatsapp-service.bat` - Start WhatsApp service (Windows)
- `insert-whatsapp-connection.js` - Database connection helper
- `test-webhook.ps1` - Test n8n webhooks
- `test-whatsapp-send.ps1` - Test WhatsApp messaging
- `subscribe-app-to-waba.ps1` - WhatsApp Business API setup

## 🌟 Key Features

### 🤖 AI Chatbots
- **Multi-tenant SaaS** - Each user has isolated chatbots
- **Custom System Prompts** - Full AI customization
- **Business Context** - Industry-specific configurations
- **Compliance Rules** - Enforce business rules
- **Response Guidelines** - Maintain brand voice

### 📱 WhatsApp Integration
- **QR Code Connection** - No Meta approval needed
- **Instant Setup** - Connect in 2-5 seconds
- **Multi-Device** - Stable connection via Baileys
- **Message History** - Context-aware conversations

### 🔄 n8n Workflows
- **AI Agents** - Powerful automation
- **Custom Tools** - Integrate any API
- **Multi-Workflow** - Each chatbot has own workflow
- **Visual Builder** - No-code automation

### 💬 Conversations
- **Product Management** - Sell products via WhatsApp
- **Knowledge Base** - RAG-powered responses
- **Conversation History** - Context-aware replies
- **Multi-Language** - i18n support

### 🎓 Training & Fine-Tuning
- **Custom Training** - Train on your conversations
- **Fine-Tuning** - OpenAI GPT-4o fine-tuning
- **Voice Cloning** - Clone voices with ElevenLabs
- **Image Generation** - AI-generated images

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

Built with [Lovable](https://lovable.dev) - The AI-powered web development platform

## 📝 License

See LICENSE file for details.

## 🆘 Support

- **Documentation**: Check the relevant guide in [`docs/`](docs/)
- **WhatsApp Setup**: See [WhatsApp Setup Guide](docs/guides/whatsapp/WHATSAPP_SETUP_GUIDE.md)
- **n8n Integration**: See [n8n Integration Guide](docs/guides/n8n/N8N_INTEGRATION_GUIDE.md)
- **Troubleshooting**: See [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
- **Issues**: Open an issue on GitHub

---

**Ready to build your AI chatbot?** Start with the [Getting Started Guide](docs/guides/setup/START_HERE.md)! 🚀
