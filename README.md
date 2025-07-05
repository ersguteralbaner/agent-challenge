# 📩 Email Assistant Agent – Nosana Builders Challenge Submission

![Agent-101](./assets/NosanaBuildersChallengeAgents.jpg)

## 🧠 Agent Description

This AI-powered Gmail assistant helps you manage your inbox smarter and faster. Built with [Mastra](https://github.com/mastra-ai/mastra) and deployed on [Nosana](https://nosana.com), this agent is designed for:

* 📬 **Latest Email Overview**: Displays recent emails in a clean view
* 🧠 **Email Summarization**: Summarizes any email
* ⚠️ **Phishing Detection**: Flags potentially suspicious emails
* ✍️ **AI Draft Suggestions**: Generates smart replies based on context

Perfect for overloaded inboxes or productivity-focused users who want AI support in day-to-day email management.

---

## ✨ Setup Instructions

1. **Clone the repo**

   ```bash
   git clone https://github.com/your-username/email-assistant.git
   cd email-assistant
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Run local LLM with Ollama**

   ```bash
   ollama serve
   ollama pull qwen2.5:1.5b
   ollama run qwen2.5:1.5b
   ```

4. **Start dev server**

   ```bash
   pnpm run dev
   ```

---

## 🔐 Environment Variables

Create a `.env` file with the following variables:

```env
# Gmail API
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REFRESH_TOKEN=your-oauth-refresh-token

# LLM config (Ollama default)
OPENAI_API_BASE=http://localhost:11434
OPENAI_API_KEY=ollama-placeholder-key


---

## 🐳 Docker Build & Run

### 🔨 Build the image

```bash
docker build -t yourusername/email-assistant:latest .
```

### ▶️ Run the container

```bash
docker run -p 8080:8080 --env-file .env yourusername/email-assistant:latest
```

Then visit: [http://localhost:8080](http://localhost:8080)

---

## 💡 Example Usage

Once running, you can interact with the agent via chat interface. Try prompts like:

* *“Fetch the 5 latest mails”*
* *“Summarize mail with ID 123456”*
* *“Check if mail with ID 123456 is phishing.”*
* *“Draft a response to mail with ID 1234xas156”*


---

## 📦 Submission Details

* 🐳 Docker Image: [docker.io/ersguteralbaner/email-assistant](https://hub.docker.com/r/ersguteralbaner/email-assistant)
* 📹 Video Demo: [Watch on Vimeo](https://vimeo.com/1098995566?share=copy)
* ✅ Nosana Proof: [Job Dashboard](https://dashboard.nosana.com/jobs/6NzmpfKuzTPyoE977xnxoniQCUyNHk95dd7zHTqAcrZy)
