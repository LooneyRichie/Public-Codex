# Public Codex 🖋️

> A secure platform for publishing and protecting creative content.

Public Codex is a modern content publishing platform that combines creativity with security to protect and celebrate authorship. Built with React and Node.js, it features encrypted storage, immutable authorship records, and comprehensive copyright protection designed for creators in the digital age.

## ✨ Features

### For Creators
- **Intuitive Editor**: Beautiful, distraction-free writing environment
- **Automatic Copyright Protection**: Every poem is timestamped and protected
- **License Selection**: Choose from Creative Commons or All Rights Reserved
- **Semantic Discovery**: Your poems are discoverable by meaning, not just keywords
- **Author Profiles**: Showcase your voice and build your following
- **Image Uploads**: Add images or title illustrations to poems, with author attribution

### For Readers
- **Semantic Search**: Find poems by mood, theme, or meaning
- **Discovery Feed**: Explore new voices and trending works
- **Curated Collections**: Browse themed anthologies and featured works
- **Respectful Engagement**: Comment and connect while respecting authorship

### Technical Excellence
- **Hybrid Database Architecture**: Redis + Vector DB + Document store
- **In-memory fallback for authentication and poems in development/demo mode**

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │────│   Node.js API   │────│   MongoDB       │
│                 │    │                 │    │   (Documents)   │
│ • Modern UI     │    │ • Express       │    │                 │
│ • Context APIs  │    │ • JWT Auth      │    └─────────────────┘
│ • React Query   │    │ • Rate Limiting │    
│ • Tailwind CSS  │    │ • Validation    │    ┌─────────────────┐
└─────────────────┘    └─────────────────┘    │   Redis Cache   │
                                             │                 │
                       ┌─────────────────┐    │ • Sessions      │
                       │   Vector DB     │    │ • Real-time     │
                       │   (Pinecone)    │    │ • Performance   │
                       │                 │    └─────────────────┘
                       │ • Semantic      │    
                       │   Search        │    ┌─────────────────┐
                       │ • Embeddings    │    │   Ledger DB     │
                       │ • Discovery     │    │                 │
                       └─────────────────┘    │ • Immutable     │
                                             │ • Timestamped   │
                                             │ • Cryptographic │
                                             └─────────────────┘
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- MongoDB (local or cloud)
- Redis server
- Pinecone account (for vector search)
- OpenAI API key (for embeddings)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/LooneyRichie/public-codex.git
   cd public-codex
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   ```bash
   # Server environment
   cp server/.env.example server/.env
   # Edit server/.env with your configuration
   
   # Client environment
   cp client/.env.example client/.env
   # Edit client/.env with your configuration
   ```

4. **Start the development servers**
   ```bash
   npm run dev
   ```

   This will start:
   - React client on `http://localhost:3000`
   - Node.js API on `http://localhost:5000`

## 🔧 Configuration

### Server Configuration

Key environment variables for the server:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/poets-codex
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key

# Vector Search
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=poets-codex
OPENAI_API_KEY=your-openai-api-key

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_MAX_REQUESTS=100
```

### Client Configuration

```env
# API Connection
REACT_APP_API_URL=http://localhost:5000/api

# Features
REACT_APP_ENABLE_REGISTRATION=true
REACT_APP_ENABLE_COMMENTS=true
```

## 📚 API Reference

### Authentication
- `POST /api/auth/register` - Register new user (in-memory or MongoDB)
- `POST /api/auth/login` - User login (in-memory or MongoDB)
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Poems
- `GET /api/poems` - List poems (with filters)
- `POST /api/poems` - Create new poem
- `GET /api/poems/:id` - Get specific poem
- `PUT /api/poems/:id` - Update poem
- `DELETE /api/poems/:id` - Delete poem

### Search
- `GET /api/search` - Text search poems
- `POST /api/search/semantic` - Semantic similarity search
- `GET /api/search/by-mood/:mood` - Find poems by mood
- `GET /api/search/by-style/:style` - Find poems by style

### Users
- `GET /api/users/:username` - Get user profile
- `GET /api/users/:username/poems` - Get user's poems
- `POST /api/users/:username/follow` - Follow user

## 🎨 Key Components

### Frontend Components

```
src/
├── components/
│   ├── auth/          # Authentication forms
│   ├── layout/        # Navigation, footer
│   ├── poems/         # Poem cards, editor
│   ├── search/        # Search interface
│   └── ui/            # Reusable UI components
├── pages/             # Route components
├── context/           # React contexts
├── hooks/             # Custom hooks
└── services/          # API clients
```

### Backend Services

```
server/src/
├── models/            # MongoDB schemas
├── routes/            # Express routes
├── controllers/       # Business logic
├── services/          # External services
│   ├── VectorService  # Pinecone integration
│   └── LedgerService  # Authorship protection
└── middleware/        # Auth, validation, etc.
```

## 🔒 Authorship Protection

Poet's Codex implements a multi-layered approach to authorship protection:

1. **Automatic Copyright**: Every poem receives a copyright notice
2. **Immutable Ledger**: Cryptographic proof of creation and ownership
3. **Content Hashing**: SHA-256 hashes for tamper detection
4. **Timestamping**: Precise creation and modification tracking
5. **License Management**: Flexible Creative Commons integration

## 🧠 Semantic Search

The platform uses advanced AI to understand poetry beyond keywords:

- **Vector Embeddings**: OpenAI's text-embedding-ada-002 model
- **Similarity Search**: Find poems by meaning and theme
- **Mood Detection**: Categorize emotional content
- **Style Recognition**: Identify poetic forms and techniques

## 🌍 Deployment

### Production Checklist

- [ ] Set up production MongoDB cluster
- [ ] Configure Redis for production
- [ ] Set up Pinecone index
- [ ] Configure environment variables
- [ ] Set up CI/CD pipeline
- [ ] Configure monitoring and logging
- [ ] Set up backup systems
- [ ] Enable SSL/TLS
- [ ] Configure CDN for static assets

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 🌐 Deployment

### Quick Deploy to GitHub Pages

1. **Fork or Clone** this repository
2. **Update configuration** in `client/package.json` with your GitHub username
3. **Push to GitHub** and enable GitHub Pages in repository settings
4. **Automatic deployment** via GitHub Actions

### Production Deployment Options

- **GitHub Pages**: Frontend-only deployment (included workflows)
- **Vercel**: Full-stack deployment with serverless functions
- **Railway**: Complete platform deployment with database
- **Render**: Full application hosting with persistent storage

📋 **See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions**

### Environment Variables for Production

```env
# Required
JWT_SECRET=your-super-secure-jwt-secret
NODE_ENV=production

# Optional (for enhanced features)
MONGODB_URI=your-mongodb-connection-string
REDIS_URL=your-redis-connection-string
PINECONE_API_KEY=your-pinecone-api-key
OPENAI_API_KEY=your-openai-api-key
```

## 🤝 Contributing

We welcome contributions to Public Codex! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for embedding technology
- Pinecone for vector database services
- The poetry community for inspiration
- All contributors and supporters

---

*"In the digital age, words need both wings to soar and armor to endure."*

**Poet's Codex** - Where poetry meets technology, and authorship is sacred.
