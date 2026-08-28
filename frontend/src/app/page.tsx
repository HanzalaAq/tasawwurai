import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-xl text-center">
        {/* Logo / Title */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/20">
            <svg
              className="h-8 w-8 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.708 50.708 0 0 1 7.74-3.342"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Tasawwur<span className="text-blue-400">AI</span>
          </h1>
        </div>

        <p className="mb-8 text-lg leading-relaxed text-gray-400">
          AI-powered real-time educational visualization platform.
          Speak naturally while teaching and watch interactive visualizations
          come to life.
        </p>

        {/* Quick start */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/session/demo"
            className="rounded-xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-colors hover:bg-blue-500"
          >
            Open Classroom
          </Link>
          <Link
            href="http://localhost:8000/docs"
            className="rounded-xl border border-gray-700 px-8 py-3 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-800"
          >
            API Docs
          </Link>
        </div>

        {/* Architecture info */}
        <div className="mt-16 grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-2xl font-bold text-white">Frontend</p>
            <p className="mt-1 text-sm text-gray-500">Next.js + React + TypeScript</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">Backend</p>
            <p className="mt-1 text-sm text-gray-500">Python + FastAPI</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">Real-time</p>
            <p className="mt-1 text-sm text-gray-500">WebSockets</p>
          </div>
        </div>
      </div>
    </main>
  );
}
