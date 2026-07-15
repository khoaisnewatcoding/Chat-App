import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4 py-12 text-white">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <div className="badge badge-outline badge-lg border-white/30 bg-white/10 text-white/90 backdrop-blur">
            New experience
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Create a space for your conversations.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-200">
            Keep your chats organized, share updates instantly, and stay connected with everyone who matters.
          </p>
        </div>

        <section className="mx-auto w-full max-w-md rounded-[28px] border border-white/20 bg-white/95 p-8 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="mb-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-indigo-600">
              Join ChatApp
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Start chatting with your team in just a few clicks.
            </p>
          </div>

          <form className="space-y-4">
            <label className="form-control w-full">
              <span className="label-text mb-2 text-slate-700">Full name</span>
              <input
                type="text"
                placeholder="Ada Lovelace"
                className="input input-bordered w-full border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
              />
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-2 text-slate-700">Email address</span>
              <input
                type="email"
                placeholder="you@example.com"
                className="input input-bordered w-full border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
              />
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-2 text-slate-700">Password</span>
              <input
                type="password"
                placeholder="••••••••"
                className="input input-bordered w-full border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="checkbox checkbox-primary checkbox-sm" />
              I agree to the terms and privacy policy.
            </label>

            <button type="submit" className="btn btn-primary w-full">
              Sign up
            </button>
          </form>

          <div className="divider text-slate-400">or</div>

          <button className="btn btn-outline btn-primary w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="link link-primary font-medium">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
