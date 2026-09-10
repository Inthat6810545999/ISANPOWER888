import { listLabRequests, REQUEST_STATUSES, type LabRequest } from "@/lib/api";
import { changeStatus } from "./actions";
import { RequestForm } from "./RequestForm";

const statusColors: Record<string, string> = {
  submitted: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  under_review: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

function RequestRow({ request }: { request: LabRequest }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">{request.title}</p>
        <p className="text-sm text-black/60 dark:text-white/60">
          {request.type} · {request.requesterEmail}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[request.status] ?? ""}`}
        >
          {request.status}
        </span>

        <form action={changeStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={request._id} />
          <select
            name="status"
            defaultValue={request.status}
            className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20"
          >
            {REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md border border-black/15 px-2 py-1 text-xs dark:border-white/20">
            Update
          </button>
        </form>
      </div>
    </li>
  );
}

export default async function Home() {
  let requests: LabRequest[] = [];
  let error: string | null = null;

  try {
    requests = await listLabRequests();
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not reach the API.";
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold">ISANPOWER888 — Lab Requests</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Submit and track lab resource requests.
        </p>
      </header>

      <section className="rounded-xl border border-black/10 p-5 dark:border-white/15">
        <h2 className="mb-4 text-lg font-medium">New request</h2>
        <RequestForm />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">All requests</h2>

        {error ? (
          <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error} Is the API running?
          </p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No requests yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((request) => (
              <RequestRow key={request._id} request={request} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
