"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useMode } from "@/lib/mode";
import { kindLabel, statusLabel, type KnowledgeItem } from "@/lib/knowledgeTypes";
import { useKnowledge } from "@/lib/useKnowledge";
import { useReference } from "./References";
import { SkeletonRows } from "./Skeleton";
import AddDialog from "./AddDialog";
import UploadZone, { DOC_ACCEPT, type UploadItem } from "./UploadZone";

const DOC_MIME = DOC_ACCEPT.split(",");
const titleOf = (name: string) =>
	name
		.replace(/\.[^.]+$/, "")
		.replace(/[_]+/g, " ")
		.trim() || name;

// All laws, norms and rules that apply globally (to every project), as one list; entries not yet sorted are only shown to creators; superseded ones are listed last. Tapping one opens its text.
export default function Rules({
	query,
	adding,
	onCloseAdd,
}: {
	query: string;
	adding: boolean;
	onCloseAdd: () => void;
}) {
	const { items, save, uploadDoc } = useKnowledge();
	const { open } = useReference();
	const creator = useMode() === "creator";

	// Each dropped document becomes an entry (named after the file, still to be sorted) with the document attached.
	const addDocs = async (files: UploadItem[]): Promise<string | null> => {
		const ok = files.filter(({ file }) => DOC_MIME.includes(file.type));
		for (const { file } of ok) {
			const entry = await save({ title: titleOf(file.name), kind: "unsorted" });
			await uploadDoc(entry.id, file);
		}
		return ok.length ? null : "Use PDF, HTML, text or image files.";
	};

	const q = query.trim().toLowerCase();
	const { current, superseded } = useMemo(() => {
		const shown = (items ?? [])
			.filter((i) => creator || i.kind !== "unsorted")
			.filter(
				(i) =>
					!q ||
					`${i.title} ${i.ref} ${i.summary} ${i.region} ${(i.aliases ?? []).join(" ")}`.toLowerCase().includes(q),
			);
		const rank = (i: KnowledgeItem) => (i.kind === "unsorted" ? 0 : 1); // new, unsorted entries first
		const order = (a: KnowledgeItem, b: KnowledgeItem) =>
			rank(a) - rank(b) ||
			a.kind.localeCompare(b.kind) ||
			a.ref.localeCompare(b.ref) ||
			a.title.localeCompare(b.title);
		return {
			current: shown.filter((i) => i.status !== "withdrawn").sort(order),
			superseded: shown.filter((i) => i.status === "withdrawn").sort(order),
		};
	}, [items, q, creator]);

	const row = (i: KnowledgeItem) => (
		<button
			key={i.id}
			className={`rulerow${i.status === "withdrawn" ? " old" : ""}`}
			onClick={(e) => open(i, e.currentTarget)}
		>
			<span className="rule-ref">{i.ref || "—"}</span>
			<span className="rule-main">
				<strong>{i.title}</strong>
				<small>{i.summary}</small>
			</span>
			<span className="rule-tags">
				<span className={`kbadge k-${i.kind}`}>{kindLabel(i.kind)}</span>
				{i.status !== "in-force" && <span className={`kstatus s-${i.status}`}>{statusLabel(i.status)}</span>}
				{i.region && <span className="chip">{i.region}</span>}
			</span>
		</button>
	);

	return (
		<div className="rules">
			{adding && creator && (
				<AddDialog title="Add rules" onClose={onCloseAdd}>
					<UploadZone
						upload={addDocs}
						onUploaded={onCloseAdd}
						accept={DOC_ACCEPT}
						hint="PDF, HTML, text or image — each file becomes a new entry"
					/>
				</AddDialog>
			)}
			{items === null && <SkeletonRows rows={8} />}
			{items && current.length + superseded.length === 0 && (
				<div className="naming-empty">{q ? `No rules match “${query}”.` : "No rules yet."}</div>
			)}
			<div className="rulelist">{current.map(row)}</div>
			{superseded.length > 0 && (
				<>
					<h2 className="rule-group">Superseded</h2>
					<div className="rulelist">{superseded.map(row)}</div>
				</>
			)}
			{creator && (
				<p className="kn-hint">
					Add or edit entries, upload documents and see how they relate in the{" "}
					<Link href="/knowledge/catalog">catalog</Link>.
				</p>
			)}
		</div>
	);
}
