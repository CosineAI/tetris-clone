
# Static Site Template (HTML + Tailwind CSS)

A minimal template for building fast, responsive websites using plain HTML and [Tailwind CSS](https://tailwindcss.com). No JavaScript frameworks or bundlers — just clean markup and utility-first styling.

---

## 🚀 Features

- ⚡️ Tailwind CSS via CLI
- 🧱 No JavaScript required
- 🗂 Simple folder structure
- 🔁 Watch mode for development

---

## 🛠 Setup

```bash
# Install dependencies (after cloning or creating project)
npm install

# Start Tailwind in watch mode (for development)
npx tailwindcss -i ./src/styles.css -o ./dist/output.css --watch
```

Open `index.html` in your browser to view the result.

---

## 📦 Build for Production

```bash
npx tailwindcss -i ./src/styles.css -o ./dist/output.css --minify
```

---

## 📚 Learn More

- [Tailwind CSS Docs](https://tailwindcss.com/docs/installation)
- [Using Tailwind CLI](https://tailwindcss.com/docs/installation/using-postcss)
