# Q-Master AI - Intelligent Study Platform

An AI-powered study platform designed to help students learn more effectively using evidence-based principles from Cognitive Psychology. This project explores various AI models and learning techniques to provide diverse testing methods and personalized study experiences.

## Project Background

This project started as an exploration of Lovable Cloud and their free Gemini week promotion. While the foundation was built with Lovable, I've since transitioned to local development to experiment with different AI models and implement research-backed learning strategies.

**Original Lovable Project**: https://lovable.dev/projects/5e87171c-6c8c-47e4-ba3f-e485dd0e8891

## Purpose & Philosophy

Q-Master AI is built around cognitive science principles to maximize learning effectiveness:

- **Active Recall**: Generate AI-powered multiple-choice questions from study materials
- **Spaced Repetition**: Track performance and identify areas needing review
- **Elaboration**: AI-generated explanations and evidence-based feedback
- **Varied Practice**: Multiple testing formats including MCQs and summary writing
- **Metacognition**: Detailed performance analytics and feedback

## Features

### Current Capabilities
- 📄 **Multi-format Input**: Upload PDFs, paste text, or provide URLs
- 🤖 **AI Question Generation**: Create custom MCQs with explanations and source citations
- ✍️ **Summary Writing Practice**: Generate key points and get AI feedback on coverage, conciseness, and originality
- 📊 **Performance Tracking**: Track attempts, identify weak areas, and retry incorrect questions
- 📁 **Organization**: Folder system for documents and study sets
- 🎨 **Modern UI**: Clean, responsive interface with dark mode support

### AI Model Experimentation
Currently exploring and comparing:
- DeepSeek Chat v3.1 (free tier)
- Google Gemini models
- Other open-source alternatives

The flexible architecture allows easy switching between models to evaluate performance, cost, and quality trade-offs.

## Technologies

**Frontend:**
- React + TypeScript
- Vite
- shadcn/ui components
- Tailwind CSS
- Radix UI primitives

**Backend:**
- Supabase (Database & Auth)
- Edge Functions (Deno runtime)
- OpenRouter API gateway

**AI Integration:**
- Multiple LLM providers via OpenRouter
- Custom prompt engineering for educational content
- RAG-based question generation with source attribution

## Local Development

### Prerequisites
- Node.js & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Supabase CLI (optional, for local backend development)

### Setup

```sh
# Clone the repository
git clone https://github.com/yourusername/q-master-ai.git

# Navigate to project directory
cd q-master-ai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file with:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

For Supabase Edge Functions, configure:
```
LOVABLE_API_KEY=your_openrouter_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui base components
│   ├── ConfigCard.tsx  # Question generation settings
│   ├── FileUpload.tsx  # Document upload interface
│   └── MCQQuestion.tsx # Quiz display component
├── pages/              # Application pages
│   ├── Index.tsx       # Main quiz flow
│   ├── Auth.tsx        # Authentication
│   └── study/          # Study mode features
├── hooks/              # Custom React hooks
├── lib/                # API clients and utilities
└── integrations/       # Third-party integrations

supabase/
├── functions/          # Edge functions
│   ├── parse-content/  # Content extraction
│   ├── generate-mcqs/  # MCQ generation
│   └── summarize-document/ # Summary evaluation
└── migrations/         # Database schema
```

## Learning Science Integration

### Active Recall Testing
- AI generates questions directly from study materials
- Immediate feedback with explanations
- Source citations link questions back to content

### Summary Writing Practice
- AI identifies key concepts from documents
- Provides example summaries as models
- Evaluates student summaries on:
  - **Coverage**: Presence of essential ideas
  - **Conciseness**: Appropriate length and focus
  - **Originality**: Degree of paraphrasing vs. copying

### Retrieval Practice
- Retry incorrect questions
- Review full study sets
- Performance analytics across sessions

## Roadmap

- [ ] Flashcard generation with spaced repetition algorithms
- [ ] Concept mapping and knowledge graph visualization
- [ ] Peer comparison and collaborative study features
- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Integration with learning management systems

## Contributing

This is currently a personal learning project, but feedback and suggestions are welcome! Feel free to open issues or reach out with ideas.

## License

MIT License - feel free to use this code for your own learning and experimentation.

## Acknowledgments

- Built with [Lovable](https://lovable.dev) as the initial foundation
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Database and auth powered by [Supabase](https://supabase.com)
- AI capabilities via [OpenRouter](https://openrouter.ai)

---

**Note**: This project is under active development as I explore AI models and learning science principles. The codebase and features are evolving rapidly.