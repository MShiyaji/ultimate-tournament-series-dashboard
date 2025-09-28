# Ultimate Tournament Series Dashboard

A modern web dashboard for tracking, managing, and visualizing results and statistics for competitive Smash Bros Ultimate tournaments, built with Next.js and deployed on Vercel.

## Features

- **Tournament Management**: Create, edit, and view tournaments and their participants.
- **Dynamic Standings**: Track real-time rankings and match outcomes.
- **Rich Data Visualization**: Interactive charts and analytics using [Recharts](https://recharts.org/).
- **Responsive UI**: Built with Radix UI and TailwindCSS for an accessible, fast, and beautiful experience.
- **Authentication & Storage**: Integrated with Supabase for authentication and S3 for storage.
- **Export & Share**: Download and share stats, results, or visualizations.
- **Dark/Light Themes**: User preference support via Next Themes.
- **Custom Components**: Modular React components and hooks for easy extensibility.

## Technologies

- **Framework**: [Next.js](https://nextjs.org/) (TypeScript)
- **UI/UX**: [Radix UI](https://www.radix-ui.com/), [TailwindCSS](https://tailwindcss.com/)
- **State, Forms & Validation**: [React Hook Form](https://react-hook-form.com/), [Zod](https://zod.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Auth & DB**: [Supabase](https://supabase.com/)
- **Storage**: [AWS S3 SDK](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- **Other**: [Lucide Icons](https://lucide.dev/), [cmdk](https://cmdk.vercel.app/), [Embla Carousel](https://www.embla-carousel.com/)

## Project Structure

- `/app` — Next.js app directory
- `/components` — Reusable React components
- `/hooks` — Custom React hooks
- `/lib` — Library utilities
- `/public` — Static assets
- `/styles` — TailwindCSS styles
- `/ultrank-scoring-main` — Custom scoring logic
## License

MIT

## Live Demo

Visit the live site: [ultimate-tournament-series-dashboard.vercel.app](https://ultimate-tournament-series-dashboard.vercel.app)

---

*Made with Next.js, Radix UI, Supabase, and Vercel.*
