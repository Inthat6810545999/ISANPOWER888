"use client";

import { useId, useState } from "react";
import { Dialog } from "@/components/workspace/Dialog";
import { Icon } from "@/components/workspace/Icon";
import styles from "@/components/workspace/workspace.module.css";
import { CATEGORIES, PRIORITIES, STATUSES, type WorkspaceRequest } from "./types";

// Fixed labels avoid Intl locale-data differences between server and browser (Sep/Sept).
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(value: string) {
  if (!value) return "No due date";
  const date = new Date(`${value}T00:00:00Z`);
  return `${date.getUTCDate()} ${MONTH_LABELS[date.getUTCMonth()]}`;
}

export function StatusBadge({ request }: { request: WorkspaceRequest }) {
  return <div><span className={styles.status} data-status={request.status}>● {STATUSES[request.status]}</span>
    {request.requiresApproval && <small className={styles.approvalNote}>Needs approval</small>}
  </div>;
}

const PAGE_SIZE = 6;

export function RequestTable({ title, requests }: { title: string; requests: WorkspaceRequest[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<WorkspaceRequest | null>(null);
  const detailTitle = useId();
  const headingId = useId();
  const query = search.trim().toLowerCase();
  const filtered = requests.filter((request) =>
    (!status || request.status === status) && (!category || request.category === category) &&
    (!priority || request.priority === priority) &&
    `${request.title} ${request.id} ${request.requester.name} ${request.assignee?.name ?? ""}`.toLowerCase().includes(query),
  ).sort((a, b) => sort === "due"
    ? (a.neededBy || "9999").localeCompare(b.neededBy || "9999")
    : b.createdAt.localeCompare(a.createdAt));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  function clearFilters() {
    setSearch(""); setStatus(""); setCategory(""); setPriority(""); setSort("latest"); setPage(1);
  }

  return <>
    <section className={styles.tableCard} aria-labelledby={headingId}>
      <div className={styles.tableTools}>
        <div className={styles.tableTitle}><h2 id={headingId}>{title} <span className={styles.count}>{filtered.length}</span></h2>
          <p className={styles.tableHint}>Find the right next step.</p>
        </div>
        <div className={styles.filters}>
          <label className={styles.search}><Icon name="search" /><input aria-label="Search requests" placeholder="Search requests, people, or ID…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label>
          <select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>{Object.entries(STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select aria-label="Filter by category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="">All categories</option>{Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select aria-label="Filter by priority" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
            <option value="">Any priority</option>{PRIORITIES.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
          </select>
          <select aria-label="Sort requests" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            <option value="latest">Newest first</option><option value="due">Due date</option>
          </select>
        </div>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>{title} with status, priority, assignee, and due date</caption>
          <thead><tr><th scope="col">Request</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Assigned to</th><th scope="col">Due date</th><th scope="col"><span className={styles.srOnly}>Details</span></th></tr></thead>
          <tbody>{visible.map((request) => <tr key={request.id}>
            <td><div className={styles.requestCell}><span className={styles.categoryIcon}><Icon name={request.category === "access" ? "shield" : request.category === "general" ? "requests" : "flask"} /></span>
              <div><button className={styles.requestTitle} onClick={() => setSelected(request)}>{request.title}</button>
                <p>{request.id} · {CATEGORIES[request.category]} · {request.requester.name}</p></div></div></td>
            <td><StatusBadge request={request} /></td>
            <td><span className={styles.priority} data-priority={request.priority}>▸ {request.priority}</span></td>
            <td>{request.assignee ? <span className={styles.assignee}><span className={styles.avatar}>{request.assignee.initials}</span>{request.assignee.name}</span> : "Unassigned"}</td>
            <td className={styles.date}>{formatDate(request.neededBy)}</td>
            <td><button className={styles.iconButton} aria-label={`View ${request.id}`} onClick={() => setSelected(request)}><Icon name="external" /></button></td>
          </tr>)}</tbody>
        </table>
      </div>
      {filtered.length === 0 && <div className={styles.empty}><Icon name="search" /><h3>No requests found</h3><p>{requests.length ? "Try a different search or clear your filters." : "Requests will appear here when there is something to follow up."}</p>
        {(search || status || category || priority) && <button className={styles.secondaryButton} onClick={clearFilters}>Clear filters</button>}</div>}
      <div className={styles.pagination}><span aria-live="polite">{filtered.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)}` : "0"} of {filtered.length} requests</span>
        <div><button aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button><span>Page {currentPage} of {pageCount}</span><button aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button></div>
      </div>
    </section>
    {selected && <Dialog titleId={detailTitle} onClose={() => setSelected(null)}>
      <div className={styles.dialogHeader}><p className={styles.eyebrow}>{selected.id} · REQUEST DETAILS</p><h2 id={detailTitle}>{selected.title}</h2></div>
      <div className={styles.detailBody}><StatusBadge request={selected} /><p className={styles.description}>{selected.description}</p>
        <dl className={styles.detailGrid}>
          <div><dt>Requested by</dt><dd>{selected.requester.name}</dd></div><div><dt>Assigned to</dt><dd>{selected.assignee?.name ?? "Unassigned"}</dd></div>
          <div><dt>Category</dt><dd>{CATEGORIES[selected.category]}</dd></div><div><dt>Priority</dt><dd className={styles.priority}>{selected.priority}</dd></div>
          <div><dt>Location</dt><dd>{selected.location || "Not specified"}</dd></div><div><dt>Needed by</dt><dd>{formatDate(selected.neededBy)}</dd></div>
        </dl><p className={styles.helper}>Demo request · Changes are kept only until refresh.</p>
      </div>
    </Dialog>}
  </>;
}
